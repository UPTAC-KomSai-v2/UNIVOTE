import csv
import hashlib
import io
import uuid
from collections import Counter
from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import ExtractHour, TruncDate
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Voter, Candidate, Admin, Auditor, Election, Ballot, BallotLine, ElectionEnrollment
from .permissions import (
    CannotVoteUntilPasswordChanged,
    IsAdmin,
    IsAdminOrReadOnly,
    IsAuditor,
    IsVoterRole,
)
from .serializers import (
    CandidateSelfProfileUpdateSerializer,
    CandidateSerializer,
    ElectionSerializer,
)


def _client_ip_for_audit(request):
    """Best-effort client IP. Behind a reverse proxy, configure Django accordingly."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return (request.META.get("REMOTE_ADDR") or "")[:45]


def _server_user_agent_truncated(request):
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


def get_user_role(user):
    """Resolve the canonical role for an authenticated user.

    The order matters: a user who is both a Voter and a Candidate is
    surfaced as a Candidate for the **published** election only (since
    candidates have stricter rules).
    """
    if Admin.objects.filter(user=user).exists():
        return "admin"
    if Auditor.objects.filter(user=user).exists():
        return "auditor"
    published = _get_published_election()
    if published is not None and Candidate.objects.filter(
        voter__user=user, election=published
    ).exists():
        return "candidate"
    if Voter.objects.filter(user=user).exists():
        return "voter"
    return "unknown"


# Create your views here.
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(email=email, password=password)

    if user is None:
        return Response({ "message": "Invalid credentials" }, status=400)

    role = get_user_role(user)

    # JWT Token Generation
    refresh = RefreshToken.for_user(user)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user_id": user.id,
        "email": user.email,
        "role": role,
        "must_change_password": user.must_change_password,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return the authenticated user's profile and canonical role.

    The frontend uses this as the source of truth for route protection
    so that role information cannot be spoofed via localStorage.
    """
    user = request.user
    return Response({
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": get_user_role(user),
        "must_change_password": user.must_change_password,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """Set a new password after first login (CSV voters start with student number)."""
    user = request.user
    current = (request.data.get("current_password") or "").strip()
    new_pw = (request.data.get("new_password") or "").strip()
    confirm = (request.data.get("new_password_confirm") or "").strip()

    if not user.check_password(current):
        return Response(
            {"current_password": ["Current password is incorrect."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if new_pw != confirm:
        return Response(
            {"new_password_confirm": ["New passwords do not match."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    voter = Voter.objects.filter(user=user).first()
    if voter and new_pw == voter.student_number:
        return Response(
            {
                "new_password": [
                    "You cannot use your student number as your new password."
                ]
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(new_pw, user=user)
    except ValidationError as exc:
        return Response(
            {"new_password": list(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_pw)
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])

    return Response({"detail": "Password updated successfully."})


class ElectionViewSet(viewsets.ModelViewSet):
    """
    CRUD for elections plus convenience actions:

      GET  /api/elections/              - list all elections
      POST /api/elections/              - create a new election (status=draft)
      GET  /api/elections/{id}/         - retrieve one
      PATCH /api/elections/{id}/        - update fields (admin only)
      DELETE /api/elections/{id}/       - delete draft only (admin); rejected if ballots exist
      POST /api/elections/purge_drafts/ - delete all ballot-free drafts (admin housekeeping)
      GET  /api/elections/active/       - currently published election (or 204)
      POST /api/elections/{id}/publish/   - mark this election as published
      POST /api/elections/{id}/unpublish/ - revert to draft (only if no votes yet)
    """

    queryset = Election.objects.all()
    serializer_class = ElectionSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def perform_destroy(self, instance):
        if instance.status != Election.Status.DRAFT:
            raise DRFValidationError("Only draft elections can be deleted.")
        if Ballot.objects.filter(election=instance).exists():
            raise DRFValidationError(
                "Cannot delete an election that has submitted ballots."
            )
        instance.delete()

    @action(detail=False, methods=["post"])
    def purge_drafts(self, request):
        """Remove draft elections that have no ballots (admin cleanup).

        POST /api/elections/purge_drafts/
        """
        deleted_ids = []
        with transaction.atomic():
            for election in Election.objects.filter(status=Election.Status.DRAFT).order_by(
                "id"
            ):
                if Ballot.objects.filter(election=election).exists():
                    continue
                pk = election.pk
                election.delete()
                deleted_ids.append(pk)
        return Response({"deleted_count": len(deleted_ids), "deleted_ids": deleted_ids})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def active(self, request):
        election = (
            Election.objects.filter(status=Election.Status.PUBLISHED)
            .order_by("-published_at", "-created_at")
            .first()
        )
        if election is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(election).data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        election = self.get_object()

        Election.objects.filter(status=Election.Status.PUBLISHED).exclude(
            pk=election.pk
        ).update(status=Election.Status.ARCHIVED)

        election.status = Election.Status.PUBLISHED
        election.published_at = timezone.now()
        election.save(update_fields=["status", "published_at", "updated_at"])

        return Response(self.get_serializer(election).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        election = self.get_object()

        if election.state == "ended":
            return Response(
                {
                    "detail": "This election has already ended. "
                              "Archive it instead to start a new one."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if election.state == "ongoing":
            return Response(
                {"detail": "Cannot unpublish an election while voting is in progress."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        election.status = Election.Status.DRAFT
        election.published_at = None
        election.save(update_fields=["status", "published_at", "updated_at"])

        return Response(self.get_serializer(election).data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        election = self.get_object()

        if election.status == Election.Status.ARCHIVED:
            return Response(
                {"detail": "Election is already archived."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        election.status = Election.Status.ARCHIVED
        election.save(update_fields=["status", "updated_at"])

        return Response(self.get_serializer(election).data)


def _get_published_election():
    """Return the most recently published election, or None.

    Includes scheduled, in-window, and ended-but-not-archived phases.
    Use this for admin-side candidate CRUD tied to the published cycle.
    """
    return (
        Election.objects.filter(status=Election.Status.PUBLISHED)
        .order_by("-published_at", "-created_at")
        .first()
    )


def _get_votable_election():
    """Return the published election voters may cast ballots in now, or None.

    Matches ``Election.is_voting_open``: published and current time within
    ``[start_datetime, end_datetime]``.
    """
    now = timezone.now()
    return (
        Election.objects.filter(
            status=Election.Status.PUBLISHED,
            start_datetime__lte=now,
            end_datetime__gte=now,
        )
        .order_by("-published_at", "-created_at")
        .first()
    )


MAX_COUNCILOR_SELECTIONS = 7


@api_view(["POST"])
@permission_classes(
    [
        IsAuthenticated,
        CannotVoteUntilPasswordChanged,
        IsVoterRole,
    ]
)
def cast_ballot_view(request):
    """Atomically record one ballot per voter per election.

    POST /api/voters/cast-ballot/

    Security:
    - Caller identity comes from the JWT (server-side); payload cannot spoof another voter.
    - Election must be the single votable window (published + in datetime range).
    - The voter must have an ``ElectionEnrollment`` row for that election.
    - Candidate IDs are verified against this election and position rules.
    - UniqueConstraint prevents double submission (race → HTTP 409).

    Body JSON:
      election_id: int
      chairperson: { abstain: bool, candidate_voter_id?: int }
      vice_chairperson: { abstain: bool, candidate_voter_id?: int }
      councilors: { abstain: bool, candidate_voter_ids?: int[] }
    """
    voter = Voter.objects.filter(user=request.user).first()
    if voter is None:
        return Response(
            {"detail": "Only registered voters may cast a ballot."},
            status=status.HTTP_403_FORBIDDEN,
        )

    election = _get_votable_election()
    if election is None:
        return Response(
            {"detail": "Voting is not open."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        election_id = int(request.data.get("election_id"))
    except (TypeError, ValueError):
        return Response(
            {"detail": "Invalid election_id."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if election_id != election.id:
        return Response(
            {"detail": "Election does not match the active ballot."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not ElectionEnrollment.objects.filter(election=election, voter=voter).exists():
        return Response(
            {"detail": "You are not enrolled for this election."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Ballot.objects.filter(voter=voter, election=election).exists():
        return Response(
            {"detail": "You have already submitted a ballot for this election."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    chair = request.data.get("chairperson") or {}
    vice = request.data.get("vice_chairperson") or {}
    council = request.data.get("councilors") or {}

    if not isinstance(chair, dict) or not isinstance(vice, dict) or not isinstance(
        council, dict
    ):
        return Response(
            {"detail": "Invalid payload shape."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cand_qs = Candidate.objects.filter(election=election)
    lines_spec = []
    errors = {}

    def add_seat(section_key, section_data, position_value):
        abstain = bool(section_data.get("abstain"))
        cid = section_data.get("candidate_voter_id")
        if abstain:
            if cid is not None:
                errors[section_key] = "Do not send a candidate when abstaining."
                return
            lines_spec.append(
                {"position": position_value, "abstain": True, "candidate": None}
            )
            return
        if cid is None:
            errors[section_key] = "Select a candidate or abstain."
            return
        try:
            cid_int = int(cid)
        except (TypeError, ValueError):
            errors[section_key] = "Invalid candidate id."
            return
        cand = cand_qs.filter(voter_id=cid_int, position=position_value).first()
        if cand is None:
            errors[section_key] = "Invalid candidate for this position."
            return
        lines_spec.append(
            {"position": position_value, "abstain": False, "candidate": cand}
        )

    add_seat("chairperson", chair, Candidate.Position.CHAIRPERSON)
    add_seat("vice_chairperson", vice, Candidate.Position.VICE_CHAIRPERSON)

    cabst = bool(council.get("abstain"))
    c_ids_raw = council.get("candidate_voter_ids")

    if cabst:
        if c_ids_raw:
            errors["councilors"] = (
                "Do not send candidate ids when abstaining from councilors."
            )
        else:
            lines_spec.append(
                {
                    "position": Candidate.Position.COUNCILOR,
                    "abstain": True,
                    "candidate": None,
                }
            )
    else:
        if not isinstance(c_ids_raw, list):
            errors["councilors"] = "candidate_voter_ids must be a list."
        else:
            seen = set()
            cleaned = []
            for raw in c_ids_raw:
                try:
                    x = int(raw)
                except (TypeError, ValueError):
                    errors["councilors"] = "Invalid councilor candidate id."
                    break
                if x in seen:
                    continue
                seen.add(x)
                cleaned.append(x)

            if "councilors" not in errors:
                if len(cleaned) < 1:
                    errors["councilors"] = (
                        "Select at least one councilor or abstain."
                    )
                elif len(cleaned) > MAX_COUNCILOR_SELECTIONS:
                    errors["councilors"] = (
                        f"At most {MAX_COUNCILOR_SELECTIONS} councilors."
                    )
                else:
                    for vid in cleaned:
                        cand = cand_qs.filter(
                            voter_id=vid,
                            position=Candidate.Position.COUNCILOR,
                        ).first()
                        if cand is None:
                            errors["councilors"] = "Invalid councilor candidate."
                            break
                        lines_spec.append(
                            {
                                "position": Candidate.Position.COUNCILOR,
                                "abstain": False,
                                "candidate": cand,
                            }
                        )

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    expected_min_lines = 3
    if len(lines_spec) < expected_min_lines:
        return Response(
            {"detail": "Incomplete ballot."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    latency_ms = None
    raw_lat = request.data.get("client_latency_ms")
    if raw_lat is not None:
        try:
            latency_ms = int(raw_lat)
            if latency_ms < 1:
                latency_ms = 1
            elif latency_ms > 600_000:
                latency_ms = 600_000
        except (TypeError, ValueError):
            latency_ms = None

    fp_hash = ""
    raw_fp = request.data.get("device_fingerprint")
    if isinstance(raw_fp, str):
        stripped = raw_fp.strip()
        if len(stripped) > 512:
            stripped = stripped[:512]
        if stripped:
            fp_hash = hashlib.sha256(stripped.encode("utf-8")).hexdigest()

    install_id = ""
    raw_install = request.data.get("client_install_id")
    if isinstance(raw_install, str):
        s = raw_install.strip()
        if len(s) <= 36:
            try:
                uuid.UUID(s)
                install_id = s
            except ValueError:
                install_id = ""

    submit_ip = _client_ip_for_audit(request)
    submit_ua = _server_user_agent_truncated(request)

    try:
        with transaction.atomic():
            ballot = Ballot.objects.create(
                voter=voter,
                election=election,
                client_submit_latency_ms=latency_ms,
                device_fingerprint_hash=fp_hash,
                submission_ip=submit_ip,
                submission_user_agent=submit_ua,
                client_install_id=install_id,
            )
            BallotLine.objects.bulk_create(
                [
                    BallotLine(
                        ballot=ballot,
                        position=row["position"],
                        candidate=row["candidate"],
                        abstain=row["abstain"],
                    )
                    for row in lines_spec
                ]
            )
    except IntegrityError:
        return Response(
            {"detail": "A ballot was already recorded."},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(
        {"detail": "Ballot recorded.", "ballot_id": ballot.pk},
        status=status.HTTP_201_CREATED,
    )


LINE_POSITION_ORDER = {"Chairperson": 0, "Vice Chairperson": 1, "Councilor": 2}


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsVoterRole])
def voting_receipt_view(request):
    """Return the authenticated voter's most recently submitted ballot (read-only).

    GET /api/voters/voting-receipt/

    Used for the voting receipt page. Does not require an active voting window.
    """
    voter = Voter.objects.filter(user=request.user).first()
    if voter is None:
        return Response(
            {"detail": "Only registered voters may view a voting receipt."},
            status=status.HTTP_403_FORBIDDEN,
        )

    ballot = (
        Ballot.objects.filter(voter=voter)
        .select_related("election")
        .prefetch_related("lines__candidate__voter__user")
        .order_by("-submitted_at")
        .first()
    )

    if ballot is None:
        return Response({"ballot": None})

    raw_lines = list(ballot.lines.all())
    raw_lines.sort(
        key=lambda L: (LINE_POSITION_ORDER.get(L.position, 99), L.pk),
    )

    lines_out = []
    for line in raw_lines:
        row = {
            "position": line.position,
            "abstain": line.abstain,
            "candidate": None,
        }
        if not line.abstain and line.candidate_id:
            c = line.candidate
            u = c.voter.user
            row["candidate"] = {
                "voter_id": c.pk,
                "full_name": f"{u.first_name} {u.last_name}".strip(),
                "first_name": u.first_name,
                "last_name": u.last_name,
                "alias": c.alias or "",
                "party": c.party or "",
            }
        lines_out.append(row)

    return Response(
        {
            "ballot": {
                "id": ballot.pk,
                "submitted_at": ballot.submitted_at,
                "election": ElectionSerializer(ballot.election).data,
                "lines": lines_out,
            }
        }
    )


@api_view(["GET"])
@permission_classes(
    [
        IsAuthenticated,
        CannotVoteUntilPasswordChanged,
        IsVoterRole,
    ]
)
def ballot_session_view(request):
    """Return this voter's per-enrollment public ID and ballot data.

    GET /api/voters/ballot-session/

    ``voter_public_id`` is ``ElectionEnrollment.public_voter_id`` for the votable
    election when enrolled (new UUID each enrollment row); otherwise empty string.

    Returns election and candidates only while voting is open (published and within
    the voting window). Scheduled or ended published elections yield ``election: null``
    and no candidates.

    ``is_enrolled`` is true only when the voter has an ``ElectionEnrollment``
    row for the votable election. If voting is open but the voter is not
    enrolled, ``election`` is still returned (for context) but ``candidates``
    is empty so the UI cannot present a ballot.
    """
    voter = Voter.objects.filter(user=request.user).first()
    if voter is None:
        return Response(
            {"detail": "Only registered voters may access the ballot."},
            status=status.HTTP_403_FORBIDDEN,
        )

    election = _get_votable_election()
    election_data = None
    candidates_data = []
    enrollment_for_ballot = None

    if election is not None:
        enrollment_for_ballot = ElectionEnrollment.objects.filter(
            election=election, voter=voter
        ).first()
        election_data = ElectionSerializer(election).data
        if enrollment_for_ballot is not None:
            qs = (
                Candidate.objects.select_related("voter__user", "election")
                .filter(election=election)
                .order_by("position", "voter__user__last_name")
            )
            candidates_data = CandidateSerializer(
                qs, many=True, context={"request": request}
            ).data

    voter_public_id_out = ""
    if enrollment_for_ballot is not None:
        voter_public_id_out = str(enrollment_for_ballot.public_voter_id)

    has_cast_ballot = False
    if election is not None:
        has_cast_ballot = Ballot.objects.filter(
            voter=voter, election=election
        ).exists()

    published = _get_published_election()
    current_cycle = {
        "election": None,
        "voting_open": False,
        "is_enrolled": False,
        "has_cast_ballot": False,
    }
    if published is not None:
        current_cycle["election"] = ElectionSerializer(published).data
        current_cycle["voting_open"] = published.is_voting_open
        current_cycle["is_enrolled"] = ElectionEnrollment.objects.filter(
            election=published, voter=voter
        ).exists()
        current_cycle["has_cast_ballot"] = Ballot.objects.filter(
            election=published, voter=voter
        ).exists()

    return Response(
        {
            "voter_public_id": voter_public_id_out,
            "election": election_data,
            "candidates": candidates_data,
            "has_cast_ballot": has_cast_ballot,
            "is_enrolled": enrollment_for_ballot is not None,
            "current_cycle": current_cycle,
        }
    )


def candidate_profile_payload(candidate, request):
    voter = candidate.voter
    election_id = candidate.election_id
    voter_public_for_election = ""
    if election_id is not None:
        en = ElectionEnrollment.objects.filter(
            election_id=election_id, voter=voter
        ).first()
        if en is not None:
            voter_public_for_election = str(en.public_voter_id)
    u = voter.user
    photo_url = None
    if candidate.profile_photo:
        photo_url = request.build_absolute_uri(candidate.profile_photo.url)
    election_name = candidate.election.name if candidate.election_id else None
    return {
        "voter_public_id": voter_public_for_election,
        "first_name": u.first_name or "",
        "last_name": u.last_name or "",
        "student_number": voter.student_number,
        "email": u.email,
        "full_name": f"{u.first_name or ''} {u.last_name or ''}".strip(),
        "alias": candidate.alias or "",
        "party": candidate.party or "",
        "position": candidate.position or "",
        "description": candidate.description or "",
        "profile_photo_url": photo_url,
        "election_name": election_name,
    }


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, CannotVoteUntilPasswordChanged])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def candidate_self_profile_view(request):
    """GET/PATCH the logged-in user's candidate ballot-facing profile.

    Candidates may edit alias, description, and profile photo only.
    Party and position are read-only (admin-managed).
    """
    published = _get_published_election()
    if published is None:
        return Response(
            {"detail": "Only candidates may access this resource."},
            status=status.HTTP_404_NOT_FOUND,
        )

    candidate = (
        Candidate.objects.select_related("voter__user", "election")
        .filter(voter__user=request.user, election=published)
        .first()
    )
    if candidate is None:
        return Response(
            {"detail": "Only candidates may access this resource."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response(candidate_profile_payload(candidate, request))

    serializer = CandidateSelfProfileUpdateSerializer(
        candidate,
        data=request.data,
        partial=True,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    candidate.refresh_from_db()
    return Response(candidate_profile_payload(candidate, request))


def _resolve_auditor_eligible_voters_queryset(election):
    """Voters counted as eligible for turnout and auditor summaries.

    Uses **only** ``ElectionEnrollment`` rows for this election — the same roster
    admins manage in **Voter roster** / CSV auto-enroll. If nobody is enrolled yet,
    the eligible count is zero. Voting still requires enrollment (see ``cast_ballot_view``).
    """
    return Voter.objects.filter(election_enrollments__election=election).distinct()


def _auditor_norm_demo(val):
    s = (val or "").strip()
    return s if s else "Unspecified"


def _auditor_year_level_bucket(yl_raw):
    """Map voter year_level into chart buckets ``1``..``4`` or ``5+``, or None."""
    s = _auditor_norm_demo(yl_raw)
    if s in ("1", "2", "3", "4"):
        return s
    try:
        n = int(float(s))
        if 1 <= n <= 4:
            return str(n)
        if n >= 5:
            return "5+"
    except (ValueError, TypeError):
        pass
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAuditor])
def auditor_election_ballot_timeline_view(request, election_id):
    """Daily ballot counts per year cohort for auditor line chart.

    GET /api/auditor/election-ballot-timeline/<election_id>/

    ``dates`` spans election local dates from start through end (clipped to today
    if the election is not archived and has not ended yet). Series keys are
    ``\"1\"``..``\"4\"`` and ``\"5+\"`` with labels 1st–4th Year students and
    5 and Up students.
    """
    election = get_object_or_404(Election.objects.all(), pk=election_id)
    start_d = timezone.localtime(election.start_datetime).date()
    end_d = timezone.localtime(election.end_datetime).date()
    today_d = timezone.localtime(timezone.now()).date()
    if election.status != Election.Status.ARCHIVED and today_d < end_d:
        end_clip = min(end_d, today_d)
    else:
        end_clip = end_d

    dates = []
    cur = start_d
    while cur <= end_clip:
        dates.append(cur.isoformat())
        cur += timedelta(days=1)

    raw = (
        Ballot.objects.filter(election=election)
        .annotate(day=TruncDate("submitted_at"))
        .values("day", "voter__year_level")
        .annotate(c=Count("pk"))
    )

    counts = {}
    for row in raw:
        day = row["day"]
        if day is None:
            continue
        ds = day.isoformat() if hasattr(day, "isoformat") else str(day)
        bucket = _auditor_year_level_bucket(row["voter__year_level"])
        if bucket is None:
            continue
        counts[(ds, bucket)] = counts.get((ds, bucket), 0) + row["c"]

    YEAR_KEYS = ["1", "2", "3", "4", "5+"]
    labels = {
        "1": "1st Year students",
        "2": "2nd Year students",
        "3": "3rd Year students",
        "4": "4th Year students",
        "5+": "5 and Up students",
    }
    series = []
    for key in YEAR_KEYS:
        series.append(
            {
                "key": key,
                "label": labels[key],
                "values": [counts.get((ds, key), 0) for ds in dates],
            }
        )

    return Response({"election_id": election.id, "dates": dates, "series": series})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_ballots_by_hour_view(request, election_id):
    """Ballot counts per clock hour for one calendar day (admin reports).

    GET /api/admin/election-ballots-by-hour/<election_id>/?date=YYYY-MM-DD

    Hours follow the active Django timezone for ``submitted_at``. Omit ``date``
    to use today's date in that timezone.
    """
    election = get_object_or_404(Election.objects.all(), pk=election_id)
    tz = timezone.get_current_timezone()
    date_raw = request.query_params.get("date")
    if date_raw:
        try:
            target_date = datetime.strptime(date_raw.strip(), "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Invalid date. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        target_date = timezone.localtime(timezone.now()).date()

    start = timezone.make_aware(datetime.combine(target_date, time.min), tz)
    end = start + timedelta(days=1)

    rows = (
        Ballot.objects.filter(
            election=election,
            submitted_at__gte=start,
            submitted_at__lt=end,
        )
        .annotate(hour=ExtractHour("submitted_at", tzinfo=tz))
        .values("hour")
        .annotate(count=Count("pk"))
        .order_by("hour")
    )
    hour_to_count = {int(r["hour"]): r["count"] for r in rows}

    counts = []
    labels = []
    for h in range(24):
        labels.append(f"{h}:00")
        counts.append(hour_to_count.get(h, 0))

    ballots_on_date = sum(counts)
    ballots_cast_total = Ballot.objects.filter(election=election).count()

    return Response(
        {
            "election_id": election.id,
            "date": target_date.isoformat(),
            "labels": labels,
            "counts": counts,
            "timezone": str(tz),
            "ballots_on_date": ballots_on_date,
            "ballots_cast_total": ballots_cast_total,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_overview_view(request, election_id):
    """Eligible roster size, ballots cast, turnout, and candidate counts for admin overview."""

    election = get_object_or_404(Election.objects.all(), pk=election_id)
    ballots_cast = Ballot.objects.filter(election=election).count()
    eligible_qs = _resolve_auditor_eligible_voters_queryset(election)
    eligible_voters = eligible_qs.count()
    turnout_pct = (
        round((ballots_cast / eligible_voters) * 100, 2) if eligible_voters else None
    )

    pos_rows = (
        Candidate.objects.filter(election=election)
        .values("position")
        .annotate(c=Count("pk"))
    )
    by_position = {
        row["position"]: row["c"]
        for row in pos_rows
        if row.get("position")
    }
    candidates_total = Candidate.objects.filter(election=election).count()
    tz = timezone.get_current_timezone()

    return Response(
        {
            "election_id": election.id,
            "eligible_voters": eligible_voters,
            "ballots_cast": ballots_cast,
            "turnout_pct": turnout_pct,
            "candidates_total": candidates_total,
            "candidates_by_position": by_position,
            "report_timezone": str(tz),
        }
    )


VELOCITY_GAP_SUSPICIOUS_SECONDS = 5.0

_VELOCITY_PERIOD_LOCAL_HOURS = {
    "all": None,
    "morning": (0, 12),
    "afternoon": (12, 18),
    "evening": (18, 24),
}


def _ballot_latency_display_ms(ballot):
    if ballot.client_submit_latency_ms is not None:
        return min(max(int(ballot.client_submit_latency_ms), 1), 500)
    return 15 + (ballot.pk * 53) % 285


def _velocity_corroboration_signals(prev_ballot, cur_ballot):
    """Audit matches between consecutive ballots (non-empty fields only).

    Used so tight timing alone does not flag unrelated voters during busy turnout.
    """
    signals = []
    ph = (prev_ballot.device_fingerprint_hash or "").strip()
    ch = (cur_ballot.device_fingerprint_hash or "").strip()
    if ph and ch and ph == ch:
        signals.append("fingerprint")
    pi = (prev_ballot.client_install_id or "").strip()
    ci = (cur_ballot.client_install_id or "").strip()
    if pi and ci and pi == ci:
        signals.append("install_id")
    pp = (prev_ballot.submission_ip or "").strip()
    cp = (cur_ballot.submission_ip or "").strip()
    if pp and cp and pp == cp:
        signals.append("ip")
    return signals


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_vote_velocity_view(request, election_id):
    """Sequential ballot gaps and latency for fraud-pattern visualization.

    GET /api/admin/election-vote-velocity/<election_id>/?date=YYYY-MM-DD&period=all|morning|afternoon|evening&flagged_only=1

    Each point is one ballot after the first in the filtered window: X = seconds
    since the previous ballot globally in that window; Y = reported latency (ms)
    or a deterministic fallback. A ballot is ``flagged`` only when the gap is below
    ``gap_threshold_seconds`` *and* it shares fingerprint hash, install ID, or submit
    IP with the immediately preceding ballot (both sides must have that field set).
    """
    election = get_object_or_404(Election.objects.all(), pk=election_id)
    tz = timezone.get_current_timezone()

    date_raw = request.query_params.get("date")
    if date_raw:
        try:
            target_date = datetime.strptime(date_raw.strip(), "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"detail": "Invalid date. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        target_date = timezone.localtime(timezone.now()).date()

    period_key = (request.query_params.get("period") or "all").strip().lower()
    if period_key not in _VELOCITY_PERIOD_LOCAL_HOURS:
        period_key = "all"

    flagged_only = request.query_params.get("flagged_only", "").lower() in (
        "1",
        "true",
        "yes",
    )

    start = timezone.make_aware(datetime.combine(target_date, time.min), tz)
    end = start + timedelta(days=1)

    qs = Ballot.objects.filter(
        election=election,
        submitted_at__gte=start,
        submitted_at__lt=end,
    )

    slot = _VELOCITY_PERIOD_LOCAL_HOURS[period_key]
    if slot is not None:
        h0, h1 = slot
        qs = qs.annotate(_vhour=ExtractHour("submitted_at", tzinfo=tz)).filter(
            _vhour__gte=h0,
            _vhour__lt=h1,
        )

    ballots = list(qs.order_by("submitted_at", "pk"))
    thresh = VELOCITY_GAP_SUSPICIOUS_SECONDS
    points = []
    uncorroborated_rapid_count = 0
    for i in range(1, len(ballots)):
        prev_b, cur_b = ballots[i - 1], ballots[i]
        gap = (cur_b.submitted_at - prev_b.submitted_at).total_seconds()
        latency = _ballot_latency_display_ms(cur_b)
        corroboration = _velocity_corroboration_signals(prev_b, cur_b)
        rapid_gap = gap < thresh
        flagged = rapid_gap and len(corroboration) > 0
        if rapid_gap and not flagged:
            uncorroborated_rapid_count += 1
        points.append(
            {
                "ballot_id": cur_b.pk,
                "gap_seconds": round(gap, 3),
                "latency_ms": latency,
                "rapid_gap": rapid_gap,
                "flagged": flagged,
                "corroboration_signals": corroboration,
                "submitted_at": cur_b.submitted_at.isoformat(),
            }
        )

    flagged_count = sum(1 for p in points if p["flagged"])
    if flagged_only:
        points = [p for p in points if p["flagged"]]

    return Response(
        {
            "election_id": election.id,
            "date": target_date.isoformat(),
            "period": period_key,
            "timezone": str(tz),
            "gap_threshold_seconds": thresh,
            "flagging_rule": "corroborated_gap",
            "flagged_count": flagged_count,
            "uncorroborated_rapid_count": uncorroborated_rapid_count,
            "points": points,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_device_fingerprints_view(request, election_id):
    """Corroborating submission clusters for administrative fraud-pattern review.

    Combines (1) identical client fingerprint hashes, (2) identical first-party
    browser install IDs, (3) identical server-observed submit IPs — each with
    multiple distinct voters in this election.
    """

    election = get_object_or_404(Election.objects.all(), pk=election_id)

    def _short_uuid(u):
        if len(u) <= 14:
            return u
        return f"{u[:8]}…{u[-4:]}"

    fp_rows = (
        Ballot.objects.filter(election=election)
        .exclude(device_fingerprint_hash="")
        .values("device_fingerprint_hash")
        .annotate(
            unique_voters=Count("voter_id", distinct=True),
            total_votes=Count("pk"),
        )
        .filter(unique_voters__gt=1)
        .order_by("-total_votes")
    )
    devices = []
    for r in fp_rows:
        dh = r["device_fingerprint_hash"]
        devices.append(
            {
                "device_hash": dh,
                "device_id_display": (dh[:14] + "…") if len(dh) > 14 else dh,
                "unique_voters": r["unique_voters"],
                "total_votes": r["total_votes"],
            }
        )

    inst_rows = (
        Ballot.objects.filter(election=election)
        .exclude(client_install_id="")
        .values("client_install_id")
        .annotate(
            unique_voters=Count("voter_id", distinct=True),
            total_votes=Count("pk"),
        )
        .filter(unique_voters__gt=1)
        .order_by("-total_votes")
    )
    install_collisions = [
        {
            "install_id": r["client_install_id"],
            "install_id_display": _short_uuid(r["client_install_id"]),
            "unique_voters": r["unique_voters"],
            "total_votes": r["total_votes"],
        }
        for r in inst_rows
    ]

    ip_rows = (
        Ballot.objects.filter(election=election)
        .exclude(submission_ip="")
        .values("submission_ip")
        .annotate(
            unique_voters=Count("voter_id", distinct=True),
            total_votes=Count("pk"),
        )
        .filter(unique_voters__gt=1)
        .order_by("-total_votes")
    )
    ip_collisions = [
        {
            "ip": r["submission_ip"],
            "unique_voters": r["unique_voters"],
            "total_votes": r["total_votes"],
        }
        for r in ip_rows
    ]

    signal_count = len(devices) + len(install_collisions) + len(ip_collisions)

    return Response(
        {
            "election_id": election.id,
            "suspicious_device_count": len(devices),
            "suspicious_install_count": len(install_collisions),
            "suspicious_ip_count": len(ip_collisions),
            "corroborating_signal_rows": signal_count,
            "devices": devices,
            "install_collisions": install_collisions,
            "ip_collisions": ip_collisions,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_voter_by_student_number_view(request):
    """Resolve voter identity for the candidate form (admin auto-fill).

    GET /api/admin/voters/by-student-number/?student_number=...

    Returns names from the voter's user record — the same values
    ``CandidateSerializer.create`` expects for this student number.
    """
    sn = (request.query_params.get("student_number") or "").strip()
    if not sn:
        return Response(
            {"detail": "Query parameter student_number is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    voter = Voter.objects.select_related("user").filter(student_number=sn).first()
    if voter is None:
        return Response(
            {"detail": "No voter with this student number."},
            status=status.HTTP_404_NOT_FOUND,
        )
    u = voter.user
    return Response(
        {
            "student_number": voter.student_number,
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
            "email": u.email or "",
        }
    )


def _admin_roster_election_or_404(election_id):
    return get_object_or_404(
        Election.objects.exclude(status=Election.Status.ARCHIVED),
        pk=election_id,
    )


def _normalise_voter_id_list(body):
    raw = body.get("voter_ids")
    if raw is None:
        return None, "voter_ids is required."
    if not isinstance(raw, list):
        return None, "voter_ids must be a JSON array of integers."
    ids = []
    for x in raw:
        try:
            ids.append(int(x))
        except (TypeError, ValueError):
            return None, "Each voter_ids entry must be an integer."
    seen = set()
    unique = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            unique.append(i)
    return unique, None


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_voter_roster_view(request, election_id):
    """Paginated voters with enrollment/ballot flags for manual roster management.

    GET /api/admin/election-voter-roster/<election_id>/?q=&limit=50&offset=0
        &enrollment=all|enrolled|not_enrolled&ballot=all|voted|not_voted

    Archived elections are excluded (404). Query ``q`` matches student number,
    email, or name (case-insensitive contains).
    Optional ``enrollment`` / ``ballot`` narrow the voter list before pagination.
    """
    election = _admin_roster_election_or_404(election_id)

    q_raw = (request.query_params.get("q") or "").strip()
    try:
        limit = int(request.query_params.get("limit") or 50)
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = int(request.query_params.get("offset") or 0)
    except (TypeError, ValueError):
        offset = 0

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    qs = Voter.objects.select_related("user").order_by(
        "user__last_name", "user__first_name", "student_number"
    )
    if q_raw:
        qi = q_raw
        qs = qs.filter(
            Q(student_number__icontains=qi)
            | Q(user__email__icontains=qi)
            | Q(user__first_name__icontains=qi)
            | Q(user__last_name__icontains=qi)
        )

    enrollment_filter = (request.query_params.get("enrollment") or "all").strip().lower()
    ballot_filter = (request.query_params.get("ballot") or "all").strip().lower()
    if enrollment_filter not in {"all", "enrolled", "not_enrolled"}:
        enrollment_filter = "all"
    if ballot_filter not in {"all", "voted", "not_voted"}:
        ballot_filter = "all"

    en_exists = ElectionEnrollment.objects.filter(
        election=election, voter_id=OuterRef("pk")
    )
    if enrollment_filter == "enrolled":
        qs = qs.filter(Exists(en_exists))
    elif enrollment_filter == "not_enrolled":
        qs = qs.filter(~Exists(en_exists))

    ballot_exists = Ballot.objects.filter(election=election, voter_id=OuterRef("pk"))
    if ballot_filter == "voted":
        qs = qs.filter(Exists(ballot_exists))
    elif ballot_filter == "not_voted":
        qs = qs.filter(~Exists(ballot_exists))

    total_matching = qs.count()
    enrolled_count = ElectionEnrollment.objects.filter(election=election).count()

    page = list(qs[offset : offset + limit])
    ids_on_page = [v.pk for v in page]
    enrolled_on_page = set(
        ElectionEnrollment.objects.filter(
            election=election, voter_id__in=ids_on_page
        ).values_list("voter_id", flat=True)
    )
    ballot_on_page = set(
        Ballot.objects.filter(election=election, voter_id__in=ids_on_page).values_list(
            "voter_id", flat=True
        )
    )

    results = [
        {
            "voter_id": v.pk,
            "email": v.user.email,
            "student_number": v.student_number,
            "first_name": v.user.first_name,
            "last_name": v.user.last_name,
            "year_level": v.year_level,
            "degree_program": v.degree_program,
            "enrolled": v.pk in enrolled_on_page,
            "has_ballot": v.pk in ballot_on_page,
        }
        for v in page
    ]

    return Response(
        {
            "election_id": election.id,
            "election_name": election.name,
            "election_status": election.status,
            "total_matching": total_matching,
            "enrolled_count": enrolled_count,
            "limit": limit,
            "offset": offset,
            "results": results,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_voter_roster_enroll_view(request, election_id):
    """Bulk enroll voters for an election (idempotent per voter).

    POST /api/admin/election-voter-roster/<election_id>/enroll/
    Body: { "voter_ids": [<int>, ...] }
    """
    election = _admin_roster_election_or_404(election_id)
    voter_ids, err = _normalise_voter_id_list(request.data)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    if not voter_ids:
        return Response(
            {"detail": "voter_ids must contain at least one id."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing = set(Voter.objects.filter(pk__in=voter_ids).values_list("pk", flat=True))
    unknown = [vid for vid in voter_ids if vid not in existing]

    created = 0
    already = 0
    for vid in voter_ids:
        if vid not in existing:
            continue
        _, was_created = ElectionEnrollment.objects.get_or_create(
            election=election, voter_id=vid
        )
        if was_created:
            created += 1
        else:
            already += 1

    return Response(
        {
            "created": created,
            "already_enrolled": already,
            "unknown_voter_ids": unknown,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_voter_roster_unenroll_view(request, election_id):
    """Bulk remove roster rows. Voters who already cast a ballot cannot be removed.

    POST /api/admin/election-voter-roster/<election_id>/unenroll/
    Body: { "voter_ids": [<int>, ...] }
    """
    election = _admin_roster_election_or_404(election_id)
    voter_ids, err = _normalise_voter_id_list(request.data)
    if err:
        return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
    if not voter_ids:
        return Response(
            {"detail": "voter_ids must contain at least one id."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing = set(Voter.objects.filter(pk__in=voter_ids).values_list("pk", flat=True))
    unknown = [vid for vid in voter_ids if vid not in existing]

    blocked_ballot = []
    removed = 0
    not_enrolled = 0

    for vid in voter_ids:
        if vid not in existing:
            continue
        if Ballot.objects.filter(election=election, voter_id=vid).exists():
            blocked_ballot.append(vid)
            continue
        deleted, _ = ElectionEnrollment.objects.filter(
            election=election, voter_id=vid
        ).delete()
        if deleted:
            removed += 1
        else:
            not_enrolled += 1

    return Response(
        {
            "removed": removed,
            "not_enrolled": not_enrolled,
            "blocked_has_ballot": blocked_ballot,
            "unknown_voter_ids": unknown,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_election_voter_roster_clear_view(request, election_id):
    """Drop all roster enrollments for an election except candidates.

    POST /api/admin/election-voter-roster/<election_id>/clear/

    Refused with 409 once any ballot exists. Rows for voters registered as
    candidates on this election are kept so nominees stay roster-eligible.
    """
    election = _admin_roster_election_or_404(election_id)
    if Ballot.objects.filter(election=election).exists():
        return Response(
            {
                "detail": "Cannot clear roster after ballots have been submitted for this election.",
            },
            status=status.HTTP_409_CONFLICT,
        )

    candidate_ids = list(
        Candidate.objects.filter(election=election).values_list("voter_id", flat=True)
    )
    qs = ElectionEnrollment.objects.filter(election=election)
    if candidate_ids:
        qs = qs.exclude(voter_id__in=candidate_ids)

    removed = qs.count()
    qs.delete()
    remaining = ElectionEnrollment.objects.filter(election=election).count()

    return Response(
        {
            "removed_enrollments": removed,
            "remaining_enrollments": remaining,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAuditor])
def auditor_election_results_view(request, election_id):
    """Aggregated turnout and tally data for auditor dashboards / charts.

    GET /api/auditor/election-results/<election_id>/

    ``eligible_voters`` is the count of voters with an ``ElectionEnrollment`` row
    for this election (the explicit roster).

    Percent ``pct_of_ballots_cast`` divides slice votes by ballots cast in this
    election (same basis as typical turnout-share summaries).
    """
    election = get_object_or_404(Election.objects.all(), pk=election_id)
    ballots_cast = Ballot.objects.filter(election=election).count()
    eligible_voter_qs = _resolve_auditor_eligible_voters_queryset(election)
    eligible_voters = eligible_voter_qs.count()

    eligible_deg = Counter()
    for row in eligible_voter_qs.values("degree_program").annotate(
        c=Count("pk", distinct=True)
    ):
        eligible_deg[_auditor_norm_demo(row["degree_program"])] += row["c"]

    voted_deg = Counter()
    for row in (
        Ballot.objects.filter(election=election)
        .values("voter__degree_program")
        .annotate(c=Count("pk", distinct=True))
    ):
        voted_deg[_auditor_norm_demo(row["voter__degree_program"])] += row["c"]

    degree_programs = []
    for prog in sorted(
        set(eligible_deg.keys()) | set(voted_deg.keys()),
        key=lambda x: (-voted_deg.get(x, 0), x),
    ):
        voted = voted_deg[prog]
        eligible = eligible_deg[prog]
        pct = round((voted / ballots_cast) * 100, 2) if ballots_cast else 0.0
        degree_programs.append(
            {
                "program": prog,
                "voted": voted,
                "eligible": eligible,
                "pct_of_ballots_cast": pct,
            }
        )

    eligible_yl = Counter()
    for row in eligible_voter_qs.values("year_level").annotate(
        c=Count("pk", distinct=True)
    ):
        eligible_yl[_auditor_norm_demo(row["year_level"])] += row["c"]

    voted_yl = Counter()
    for row in (
        Ballot.objects.filter(election=election)
        .values("voter__year_level")
        .annotate(c=Count("pk", distinct=True))
    ):
        voted_yl[_auditor_norm_demo(row["voter__year_level"])] += row["c"]

    year_levels = []
    for yl in sorted(
        set(eligible_yl.keys()) | set(voted_yl.keys()),
        key=lambda x: (-voted_yl.get(x, 0), x),
    ):
        voted = voted_yl[yl]
        eligible = eligible_yl[yl]
        pct = round((voted / ballots_cast) * 100, 2) if ballots_cast else 0.0
        year_levels.append(
            {
                "year_level": yl,
                "voted": voted,
                "eligible": eligible,
                "pct_of_ballots_cast": pct,
            }
        )

    POS_UI = {
        Candidate.Position.CHAIRPERSON: "Chairperson",
        Candidate.Position.VICE_CHAIRPERSON: "Vice Chairperson",
        Candidate.Position.COUNCILOR: "Councilor",
    }

    positions_out = []
    for pos_const in (
        Candidate.Position.CHAIRPERSON,
        Candidate.Position.VICE_CHAIRPERSON,
        Candidate.Position.COUNCILOR,
    ):
        agg = list(
            BallotLine.objects.filter(ballot__election=election, position=pos_const)
            .values("abstain", "candidate_id")
            .annotate(votes=Count("id"))
            .order_by("-votes")
        )
        cand_ids = [row["candidate_id"] for row in agg if row["candidate_id"]]
        cand_map = {}
        if cand_ids:
            for c in Candidate.objects.filter(pk__in=cand_ids).select_related(
                "voter__user"
            ):
                u = c.voter.user
                cand_map[c.pk] = f"{u.first_name} {u.last_name}".strip() or u.email

        choices = []
        total_lines = sum(row["votes"] for row in agg)
        for row in agg:
            abstain = row["abstain"]
            cid = row["candidate_id"]
            votes = row["votes"]
            if abstain:
                name = "Abstain"
                cv_id = None
            else:
                cv_id = cid
                name = cand_map.get(cid, "Unknown candidate")
            pct = round((votes / ballots_cast) * 100, 2) if ballots_cast else 0.0
            choices.append(
                {
                    "candidate_voter_id": cv_id,
                    "name": name,
                    "votes": votes,
                    "pct_of_ballots_cast": pct,
                    "abstain": abstain,
                }
            )

        positions_out.append(
            {
                "position": POS_UI[pos_const],
                "choices": choices,
                "total_lines": total_lines,
                "ballots_cast": ballots_cast,
            }
        )

    # Position-level participation: eligible voters who chose a candidate (not abstain)
    # for each race — used by apathy-index bar chart (order matches typical ballot UI).
    position_participation = []
    for pos_const, label in (
        (Candidate.Position.COUNCILOR, POS_UI[Candidate.Position.COUNCILOR]),
        (
            Candidate.Position.VICE_CHAIRPERSON,
            POS_UI[Candidate.Position.VICE_CHAIRPERSON],
        ),
        (Candidate.Position.CHAIRPERSON, POS_UI[Candidate.Position.CHAIRPERSON]),
    ):
        engaged = (
            Ballot.objects.filter(election=election)
            .filter(lines__position=pos_const, lines__abstain=False)
            .distinct()
            .count()
        )
        if eligible_voters:
            pct_part = round((engaged / eligible_voters) * 100, 2)
            pct_apathy = round(100 - pct_part, 2)
        else:
            pct_part = 0.0
            pct_apathy = 0.0
        position_participation.append(
            {
                "position": label,
                "selected_candidate": engaged,
                "eligible": eligible_voters,
                "participation_pct": pct_part,
                "apathy_pct": pct_apathy,
            }
        )

    return Response(
        {
            "election_id": election.id,
            "election_name": election.name,
            "ballots_cast": ballots_cast,
            "eligible_voters": eligible_voters,
            "degree_programs": degree_programs,
            "year_levels": year_levels,
            "positions": positions_out,
            "position_participation": position_participation,
        }
    )


class CandidateViewSet(viewsets.ModelViewSet):
    """
    CRUD for candidates of the currently published election.

      GET    /api/candidates/         - list candidates of the published election
      POST   /api/candidates/         - add a candidate to the published election (blocked while voting is open or after voting has ended)
      GET    /api/candidates/{id}/    - retrieve one (``id`` is ``voter_id`` for this election)
      PATCH  /api/candidates/{id}/    - update fields (admin only)
      DELETE /api/candidates/{id}/    - remove a candidate (admin only); blocked while voting is open

    URL segments use ``voter_id`` so admins keep stable identifiers while ``Candidate``
    rows gain their own primary keys across elections.
    """

    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    lookup_field = "voter_id"

    def get_queryset(self):
        published = _get_published_election()
        if published is None:
            return Candidate.objects.none()
        return (
            Candidate.objects.select_related("voter__user", "election")
            .filter(election=published)
        )

    def create(self, request, *args, **kwargs):
        published = _get_published_election()
        if published is None:
            return Response(
                {"detail": "No published election. Publish an election before adding candidates."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if published.is_voting_open:
            return Response(
                {"detail": "Cannot add candidates while voting is open."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if published.state == "ended":
            return Response(
                {"detail": "Cannot add candidates after voting has ended."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        published = _get_published_election()
        serializer.save(election=published)

    def perform_destroy(self, instance):
        election = instance.election
        if election is not None and election.is_voting_open:
            raise DRFValidationError(
                "Cannot remove candidates while voting is open."
            )
        instance.delete()


class VoterCsvUploadView(APIView):
    """
    POST /api/voters/upload-csv/

    Admin only (``IsAuthenticated`` + ``IsAdmin``).

    Accepts a multipart upload with a single field named ``file`` containing a
    CSV file.  The CSV must have a header row with these columns (case-
    insensitive; extra columns are ignored):

        first_name, last_name, student_number, email, year_level, degree_program

    For each row the endpoint:
    - Skips the row if a Voter with that student_number already exists.
    - Creates a User + Voter pair otherwise and enrolls them in the published
      election when one exists (``ElectionEnrollment``). The initial password is the
      student_number; ``must_change_password`` is set so the voter must pick
      a new password (via ``POST /api/change-password/``) before voting.

    Returns a JSON summary:
        {
            "created": <int>,
            "skipped": <int>,
            "errors": [{"row": <int>, "reason": "<str>"}, ...]
        }
    """

    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated, IsAdmin]

    REQUIRED_COLUMNS = {
        "first_name",
        "last_name",
        "student_number",
        "email",
        "year_level",
        "degree_program",
    }

    def post(self, request, *args, **kwargs):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response(
                {"detail": "No file provided. Send the CSV as a 'file' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not uploaded.name.lower().endswith(".csv"):
            return Response(
                {"detail": "Only .csv files are accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            text = io.TextIOWrapper(uploaded, encoding="utf-8-sig", errors="replace")
            reader = csv.DictReader(text)
        except Exception as exc:
            return Response(
                {"detail": f"Could not read file: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reader.fieldnames is None:
            return Response(
                {"detail": "The CSV file appears to be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalised_headers = {h.strip().lower() for h in reader.fieldnames}
        missing = self.REQUIRED_COLUMNS - normalised_headers
        if missing:
            return Response(
                {
                    "detail": (
                        f"Missing required column(s): {', '.join(sorted(missing))}. "
                        "Expected: first_name, last_name, student_number, email, "
                        "year_level, degree_program."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        skipped_count = 0
        errors = []

        for raw_row_num, row in enumerate(reader, start=2):
            # Normalise keys to lowercase without surrounding whitespace
            row = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

            first_name = row.get("first_name", "")
            last_name = row.get("last_name", "")
            student_number = row.get("student_number", "")
            email = row.get("email", "")
            year_level = row.get("year_level", "")
            degree_program = row.get("degree_program", "")

            if not (
                first_name
                and last_name
                and student_number
                and email
                and year_level
                and degree_program
            ):
                errors.append(
                    {
                        "row": raw_row_num,
                        "reason": (
                            "first_name, last_name, student_number, email, "
                            "year_level, and degree_program are all required "
                            "in each row."
                        ),
                    }
                )
                continue

            email = User.objects.normalize_email(email)

            if Voter.objects.filter(student_number=student_number).exists():
                skipped_count += 1
                continue

            if User.objects.filter(email=email).exists():
                errors.append(
                    {
                        "row": raw_row_num,
                        "reason": f"A user with email '{email}' already exists.",
                    }
                )
                continue

            try:
                user = User.objects.create_user(
                    email=email,
                    password=student_number,
                    first_name=first_name,
                    last_name=last_name,
                    must_change_password=True,
                )
                voter = Voter.objects.create(
                    user=user,
                    student_number=student_number,
                    year_level=year_level,
                    degree_program=degree_program,
                )
                pub = _get_published_election()
                if pub is not None:
                    ElectionEnrollment.objects.get_or_create(election=pub, voter=voter)
                created_count += 1
            except Exception as exc:
                errors.append({"row": raw_row_num, "reason": str(exc)})

        return Response(
            {"created": created_count, "skipped": skipped_count, "errors": errors},
            status=status.HTTP_200_OK,
        )