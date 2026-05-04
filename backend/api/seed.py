"""UniVote demo dataset aligned with the publish/archive workflow.

Election lifecycle emphasized here:

- **Draft** — configure dates in Manage Elections; not visible as ``current_cycle``.
- **Publish** — sets ``status=published`` and ``published_at`` (matches ``POST …/publish/``).
- **Ongoing** — published and ``now`` inside ``[start, end]``; voters vote; admin locks roster/candidates rules apply.
- **Ended (still published)** — window passed but not archived yet; admin banner encourages archive before drafting the next cycle.
- **Archived** — closed history; auditors can still open reports by id.

Backend picks **the latest published election** by ``published_at`` (then ``created_at``) for
candidates, CSV auto-enroll target, and ballot-session ``current_cycle``. This seed keeps **only one**
published election that is ahead of others in time **ongoing**, plus **one** older published-ended row
for “please archive” UX. No extra published-scheduled-in-the-future row (next cycle stays **draft**).

Also seeds: enrollments + ``public_voter_id``, ballots with audit metrics, repeat nominees across cycles.

Seed idempotency: ``run(reset=False)`` skips if any user exists unless ``--reset``.
"""

from datetime import timedelta
import hashlib
import uuid

from django.db import transaction
from django.utils import timezone

from api.models import (
    Admin,
    Auditor,
    Ballot,
    BallotLine,
    Candidate,
    Election,
    ElectionEnrollment,
    Faculty,
    User,
    Voter,
)

DEMO_DEGREE_PROGRAMS = [
    "BA Literature",
    "BS Accountancy",
    "BA Psychology",
    "BS Computer Science",
    "BS Biology",
    "BS Economics",
    "BS Management",
    "BA Media Arts",
    "BA Political Science",
    "BS Applied Mathematics",
]

NUM_DEMO_VOTERS = 56

DEMO_EMAIL_SUFFIX = "@test.com"

# Primary cycle roster leaves this many tail demo voters OFF the active election so admins
# can test roster enroll + ballot-session ``is_enrolled`` without re-seeding.
ACTIVE_ELECTION_ROSTER_EXCLUDE_TAIL = 10


def _active_roster_demo_voters(demo_voters, exclude_tail_n=ACTIVE_ELECTION_ROSTER_EXCLUDE_TAIL):
    """Subset of demo voters enrolled on the *ongoing* election (others stay off roster)."""
    if len(demo_voters) <= 1 + exclude_tail_n:
        return list(demo_voters)
    return [demo_voters[0]] + demo_voters[1:-exclude_tail_n]


def _verify_enrollments_have_public_ids():
    """Sanity check: every enrollment row should have a ballot pseudonym (post-migration model)."""
    missing = ElectionEnrollment.objects.filter(public_voter_id__isnull=True).count()
    if missing:
        print(f"  WARNING: {missing} ElectionEnrollment rows lack public_voter_id (unexpected).")


def _candidate_voters_for_election(election):
    """Voters who have a Candidate row on this election (``Candidate`` uses FK ``candidate_entries``)."""
    return list(
        Voter.objects.filter(candidate_entries__election=election).distinct()
    )


def _add_returning_candidate(*, voter, election, position, alias, party, description):
    """Attach an existing voter to another election's slate (multi-cycle nominees)."""
    return Candidate.objects.create(
        voter=voter,
        election=election,
        position=position,
        alias=alias,
        party=party,
        description=description,
    )


def _advance_vote_cursor(cursor, window_end, created_idx, *, velocity_burst_every):
    """Monotonic timestamps: mixed gaps, bursts (<5s), and larger jumps for hourly/timeline charts."""
    gap_sec = (
        2.4
        if (created_idx > 0 and created_idx % velocity_burst_every == 0)
        else float(18 + (created_idx % 92))
    )
    if created_idx > 0 and created_idx % 7 == 0:
        gap_sec += (2 * 3600) + (created_idx % 2400)
    if created_idx > 0 and created_idx % 10 == 0:
        gap_sec += 26 * 3600 + (created_idx % 1800)
    nxt = cursor + timedelta(seconds=gap_sec)
    if nxt >= window_end:
        nxt = window_end - timedelta(seconds=(created_idx % 200) + 1)
    return nxt


def clear_demo_database():
    """Remove seeded demo rows (@test.com users). Keeps Django superusers."""
    BallotLine.objects.all().delete()
    Ballot.objects.all().delete()
    ElectionEnrollment.objects.all().delete()
    Candidate.objects.all().delete()
    Election.objects.all().delete()
    Admin.objects.all().delete()
    Auditor.objects.all().delete()
    Faculty.objects.all().delete()
    User.objects.filter(email__endswith=DEMO_EMAIL_SUFFIX, is_superuser=False).delete()

def _skip_ballot_past(idx, _voter):
    """~⅔ of seeded pool casts a ballot for the archived election."""
    return (idx + 1) % 3 == 0


def _skip_ballot_active(idx, _voter):
    """~¾ of seeded pool casts a ballot for the active election (pattern differs from past)."""
    return (idx + 2) % 4 == 0


def _create_candidate_user(
    *,
    email,
    password,
    first_name,
    last_name,
    student_number,
    election,
    position,
    alias="",
    party="",
    description="",
    year_level="",
    degree_program="",
):
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    voter = Voter.objects.create(
        user=user,
        student_number=student_number,
        year_level=year_level,
        degree_program=degree_program,
    )
    return Candidate.objects.create(
        voter=voter,
        election=election,
        position=position,
        alias=alias,
        party=party,
        description=description or f"Demo candidate running for {position}.",
    )


def _create_voter_only(
    *,
    email,
    password,
    first_name,
    last_name,
    student_number,
    year_level="",
    degree_program="",
    must_change_password=False,
):
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        must_change_password=must_change_password,
    )
    return Voter.objects.create(
        user=user,
        student_number=student_number,
        year_level=year_level,
        degree_program=degree_program,
    )


def _bulk_enroll(election, voters):
    """Roster voters for an election (idempotent; overlaps with candidate enrollments OK)."""
    if not voters:
        return
    ElectionEnrollment.objects.bulk_create(
        [
            ElectionEnrollment(
                election=election, voter=v, public_voter_id=uuid.uuid4()
            )
            for v in voters
        ],
        ignore_conflicts=True,
    )


def _ordered_candidates(election, position):
    return list(
        Candidate.objects.filter(election=election, position=position).order_by(
            "voter_id"
        )
    )


def _seed_ballots_for_election(
    election,
    voters,
    *,
    abstain_chair_every=11,
    abstain_vice_every=13,
    abstain_council_every=19,
    councilor_pick_count=5,
    skip_ballot_if=None,
    velocity_burst_every=6,
):
    """Create at most one ballot per voter with varied splits + occasional abstentions.

    skip_ballot_if: optional ``callable(idx, voter) -> bool``. When True, no ballot is
    created for that voter (they remain eligible but “yet to vote” for this election).

    Timestamps advance monotonically across the election window with occasional sub-5s
    gaps (vote velocity flags) and multi-hour/day jumps (hourly activity + auditor timeline).
    """
    chairs = _ordered_candidates(election, Candidate.Position.CHAIRPERSON)
    vices = _ordered_candidates(election, Candidate.Position.VICE_CHAIRPERSON)
    councilors = _ordered_candidates(election, Candidate.Position.COUNCILOR)
    if not chairs or not vices or len(councilors) < 1:
        print(f"  Skipping ballots for election {election.pk}: missing candidates.")
        return 0, 0, len(voters)

    nc_target = min(councilor_pick_count, len(councilors))
    created = 0
    skipped_eligible = 0

    now = timezone.now()
    window_end = min(election.end_datetime, now) - timedelta(seconds=20)
    window_start = election.start_datetime + timedelta(seconds=45)
    if window_end <= window_start:
        window_end = window_start + timedelta(hours=8)

    t_cursor = window_start + timedelta(minutes=2)

    for idx, voter in enumerate(voters):
        if skip_ballot_if is not None and skip_ballot_if(idx, voter):
            skipped_eligible += 1
            continue
        if Ballot.objects.filter(voter=voter, election=election).exists():
            continue

        t_cursor = _advance_vote_cursor(
            t_cursor, window_end, created, velocity_burst_every=velocity_burst_every
        )

        ballot = Ballot.objects.create(voter=voter, election=election)

        fp_cluster = (created % 6) + 1
        shared = created % 8 != 0
        fp_hex = (
            hashlib.sha256(f"seed-shared-lab-{fp_cluster}".encode()).hexdigest()
            if shared
            else hashlib.sha256(f"seed-solo-{voter.pk}".encode()).hexdigest()
        )
        latency_ms = 35 + (created * 41) % 270

        if shared:
            install_uuid = str(
                uuid.uuid5(uuid.NAMESPACE_DNS, f"univote-seed-lab-{fp_cluster}")
            )
            sub_ip = f"203.0.113.{40 + fp_cluster}"
            ua = "Mozilla/5.0 (UniVote seed; shared kiosk)"
        else:
            install_uuid = str(
                uuid.uuid5(uuid.NAMESPACE_OID, f"univote-seed-solo-{voter.pk}")
            )
            sub_ip = f"192.0.2.{1 + (voter.pk % 220)}"
            ua = "Mozilla/5.0 (UniVote seed; personal device)"

        Ballot.objects.filter(pk=ballot.pk).update(
            submitted_at=t_cursor,
            client_submit_latency_ms=latency_ms,
            device_fingerprint_hash=fp_hex,
            submission_ip=sub_ip,
            submission_user_agent=ua[:512],
            client_install_id=install_uuid,
        )

        if idx % abstain_chair_every == 0:
            BallotLine.objects.create(
                ballot=ballot,
                position=Candidate.Position.CHAIRPERSON,
                abstain=True,
                candidate=None,
            )
        else:
            BallotLine.objects.create(
                ballot=ballot,
                position=Candidate.Position.CHAIRPERSON,
                abstain=False,
                candidate=chairs[idx % len(chairs)],
            )

        if idx % abstain_vice_every == 0:
            BallotLine.objects.create(
                ballot=ballot,
                position=Candidate.Position.VICE_CHAIRPERSON,
                abstain=True,
                candidate=None,
            )
        else:
            BallotLine.objects.create(
                ballot=ballot,
                position=Candidate.Position.VICE_CHAIRPERSON,
                abstain=False,
                candidate=vices[(idx + 1) % len(vices)],
            )

        if idx % abstain_council_every == 0:
            BallotLine.objects.create(
                ballot=ballot,
                position=Candidate.Position.COUNCILOR,
                abstain=True,
                candidate=None,
            )
        else:
            for k in range(nc_target):
                BallotLine.objects.create(
                    ballot=ballot,
                    position=Candidate.Position.COUNCILOR,
                    abstain=False,
                    candidate=councilors[(idx + k) % len(councilors)],
                )
        created += 1
    return created, skipped_eligible, len(voters)


def _seed_demo_published_ended_election(
    *,
    name,
    description,
    start_datetime,
    end_datetime,
    published_at,
    admin_user,
    demo_voters,
    slug,
    skip_ballot_if,
    abstain_chair_every,
    abstain_vice_every,
    abstain_council_every,
    councilor_pick_count,
    velocity_burst_every,
):
    """Published election whose window has ended — not archived (archive workflow demos)."""
    election = Election.objects.create(
        name=name,
        description=description,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        status=Election.Status.PUBLISHED,
        published_at=published_at,
        created_by=admin_user,
    )
    mk = lambda **kw: _create_candidate_user(election=election, **kw)
    mk(
        email=f"{slug}.chair1@test.com",
        password="1234",
        first_name="Closed",
        last_name="ChairOne",
        student_number=f"{slug.upper()}-CH-01",
        position=Candidate.Position.CHAIRPERSON,
        alias="Closed A",
        party="Unity",
        year_level="4",
        degree_program=DEMO_DEGREE_PROGRAMS[0],
    )
    mk(
        email=f"{slug}.chair2@test.com",
        password="1234",
        first_name="Closed",
        last_name="ChairTwo",
        student_number=f"{slug.upper()}-CH-02",
        position=Candidate.Position.CHAIRPERSON,
        alias="Closed B",
        party="Vision",
        year_level="3",
        degree_program=DEMO_DEGREE_PROGRAMS[1],
    )
    mk(
        email=f"{slug}.vice1@test.com",
        password="1234",
        first_name="Ended",
        last_name="ViceA",
        student_number=f"{slug.upper()}-VC-01",
        position=Candidate.Position.VICE_CHAIRPERSON,
        alias="EV A",
        party="Unity",
        year_level="2",
        degree_program=DEMO_DEGREE_PROGRAMS[2],
    )
    mk(
        email=f"{slug}.vice2@test.com",
        password="1234",
        first_name="Ended",
        last_name="ViceB",
        student_number=f"{slug.upper()}-VC-02",
        position=Candidate.Position.VICE_CHAIRPERSON,
        alias="EV B",
        party="Vision",
        year_level="3",
        degree_program=DEMO_DEGREE_PROGRAMS[3],
    )
    for i in range(1, 8):
        mk(
            email=f"{slug}.council{i}@test.com",
            password="1234",
            first_name="Ended",
            last_name=f"Councilor{i}",
            student_number=f"{slug.upper()}-CO-{i:02d}",
            position=Candidate.Position.COUNCILOR,
            alias=f"EC{i}",
            party=("Unity", "Vision", "Independent")[i % 3],
            year_level=str((i % 4) + 1),
            degree_program=DEMO_DEGREE_PROGRAMS[
                (i + 2) % len(DEMO_DEGREE_PROGRAMS)
            ],
        )

    ended_candidate_voters = _candidate_voters_for_election(election)
    voters_for_ended = list(dict.fromkeys(demo_voters + ended_candidate_voters))
    _bulk_enroll(election, voters_for_ended)
    n_ended, skipped_ended, pool_ended = _seed_ballots_for_election(
        election,
        voters_for_ended,
        abstain_chair_every=abstain_chair_every,
        abstain_vice_every=abstain_vice_every,
        abstain_council_every=abstain_council_every,
        councilor_pick_count=councilor_pick_count,
        skip_ballot_if=skip_ballot_if,
        velocity_burst_every=velocity_burst_every,
    )
    return election, n_ended, skipped_ended, pool_ended


def run(reset=False):
    if reset:
        print("Reset: clearing demo data (@test.com) ...")
        with transaction.atomic():
            clear_demo_database()
        print("  Cleared.")
    elif User.objects.exists():
        print(
            "Data already exists. Skipping seeding. "
            "Use: python manage.py seed_demo --reset"
        )
        return

    with transaction.atomic():
        now = timezone.now()

        admin_user = User.objects.create_user(
            email="admin@test.com",
            password="admin123",
            first_name="System",
            last_name="Admin",
        )
        Admin.objects.create(user=admin_user)

        auditor_user = User.objects.create_user(
            email="auditor@test.com",
            password="auditor123",
            first_name="Audit",
            last_name="User",
        )
        Auditor.objects.create(user=auditor_user)

        faculty_user = User.objects.create_user(
            email="faculty@test.com",
            password="faculty123",
            first_name="Prof",
            last_name="Smith",
        )
        Faculty.objects.create(user=faculty_user, employee_id="EMP-001")

        voter_demo_main = _create_voter_only(
            email="voter@test.com",
            password="1234",
            first_name="Maria",
            last_name="Santos",
            student_number="2024-0002",
            year_level="4",
            degree_program="BA Political Science",
        )

        voter_firstlogin_gate = _create_voter_only(
            email="firstlogin@test.com",
            password="1234",
            first_name="Must",
            last_name="ChangePassword",
            student_number="2099-9001",
            year_level="2",
            degree_program="BS Biology",
            must_change_password=True,
        )

        demo_voters = [voter_demo_main, voter_firstlogin_gate]
        for i in range(NUM_DEMO_VOTERS):
            v = _create_voter_only(
                email=f"demovoter{i:03d}@test.com",
                password="1234",
                first_name="Demo",
                last_name=f"Voter{i}",
                student_number=f"2099-{4200 + i:04d}",
                year_level=str((i % 4) + 1),
                degree_program=DEMO_DEGREE_PROGRAMS[i % len(DEMO_DEGREE_PROGRAMS)],
            )
            demo_voters.append(v)

        # --- Past election (archived, ended) — auditor “history” tab ---
        election_past = Election.objects.create(
            name="2024 Archived Student Council Elections (Demo)",
            description="Seeded ended election with ballots for auditor dashboard testing.",
            start_datetime=now - timedelta(days=420),
            end_datetime=now - timedelta(days=380),
            status=Election.Status.ARCHIVED,
            published_at=now - timedelta(days=425),
            created_by=admin_user,
        )

        pc = lambda **kw: _create_candidate_user(election=election_past, **kw)
        pc(
            email="past.chair1@test.com",
            password="1234",
            first_name="Pedro",
            last_name="PastChairA",
            student_number="PAST24-CH-01",
            position=Candidate.Position.CHAIRPERSON,
            alias="Past A",
            party="Legacy",
            year_level="4",
            degree_program=DEMO_DEGREE_PROGRAMS[0],
        )
        pc(
            email="past.chair2@test.com",
            password="1234",
            first_name="Paula",
            last_name="PastChairB",
            student_number="PAST24-CH-02",
            position=Candidate.Position.CHAIRPERSON,
            alias="Past B",
            party="Renew",
            year_level="3",
            degree_program=DEMO_DEGREE_PROGRAMS[1],
        )
        pc(
            email="past.vice1@test.com",
            password="1234",
            first_name="Victor",
            last_name="PastViceA",
            student_number="PAST24-VC-01",
            position=Candidate.Position.VICE_CHAIRPERSON,
            alias="PV A",
            party="Legacy",
            year_level="2",
            degree_program=DEMO_DEGREE_PROGRAMS[2],
        )
        pc(
            email="past.vice2@test.com",
            password="1234",
            first_name="Vera",
            last_name="PastViceB",
            student_number="PAST24-VC-02",
            position=Candidate.Position.VICE_CHAIRPERSON,
            alias="PV B",
            party="Renew",
            year_level="3",
            degree_program=DEMO_DEGREE_PROGRAMS[3],
        )
        for i in range(1, 8):
            pc(
                email=f"past.council{i}@test.com",
                password="1234",
                first_name="Past",
                last_name=f"Councilor{i}",
                student_number=f"PAST24-CO-{i:02d}",
                position=Candidate.Position.COUNCILOR,
                alias=f"PC{i}",
                party=("Legacy", "Renew", "Independent")[i % 3],
                year_level=str((i % 4) + 1),
                degree_program=DEMO_DEGREE_PROGRAMS[(i + 4) % len(DEMO_DEGREE_PROGRAMS)],
            )

        past_candidate_voters = _candidate_voters_for_election(election_past)
        voters_for_past = list(dict.fromkeys(demo_voters + past_candidate_voters))

        _bulk_enroll(election_past, voters_for_past)

        n_past, skipped_past, pool_past = _seed_ballots_for_election(
            election_past,
            voters_for_past,
            abstain_chair_every=11,
            abstain_vice_every=14,
            abstain_council_every=17,
            councilor_pick_count=5,
            skip_ballot_if=_skip_ballot_past,
            velocity_burst_every=6,
        )

        # One ended-but-still-published cycle (older published_at than active) — archive banner UX.
        ended_spec = {
            "name": "2026 Closed Student Council Elections (Ended - Demo)",
            "description": (
                "Voting window has ended; still published until admin archives it "
                "(matches Manage Elections workflow before opening the draft form)."
            ),
            "start_datetime": now - timedelta(days=26),
            "end_datetime": now - timedelta(days=2),
            "published_at": now - timedelta(days=28),
            "slug": "end26close",
            "skip_ballot_if": lambda idx, _v: (idx + 3) % 5 == 0,
            "abstain_chair_every": 13,
            "abstain_vice_every": 16,
            "abstain_council_every": 19,
            "councilor_pick_count": 5,
            "velocity_burst_every": 5,
        }
        election_ended_published, n_ended_pub, skipped_ended_pub, pool_ended_pub = (
            _seed_demo_published_ended_election(
                name=ended_spec["name"],
                description=ended_spec["description"],
                start_datetime=ended_spec["start_datetime"],
                end_datetime=ended_spec["end_datetime"],
                published_at=ended_spec["published_at"],
                admin_user=admin_user,
                demo_voters=demo_voters,
                slug=ended_spec["slug"],
                skip_ballot_if=ended_spec["skip_ballot_if"],
                abstain_chair_every=ended_spec["abstain_chair_every"],
                abstain_vice_every=ended_spec["abstain_vice_every"],
                abstain_council_every=ended_spec["abstain_council_every"],
                councilor_pick_count=ended_spec["councilor_pick_count"],
                velocity_burst_every=ended_spec["velocity_burst_every"],
            )
        )

        # --- Active election (published last → canonical `_get_published_election()` target) ---
        election_active = Election.objects.create(
            name="2026 Demo Student Council Elections",
            description=(
                "Currently published ongoing cycle (latest ``published_at`` in seed): voters, "
                "candidates, roster tools, and admin reports attach here via ``_get_published_election()``."
            ),
            start_datetime=now - timedelta(days=1),
            end_datetime=now + timedelta(days=14),
            status=Election.Status.PUBLISHED,
            published_at=now - timedelta(hours=3),
            created_by=admin_user,
        )

        _create_candidate_user(
            email="candidate@test.com",
            password="1234",
            first_name="Juan",
            last_name="Dela Cruz",
            student_number="2024-0001",
            election=election_active,
            position=Candidate.Position.CHAIRPERSON,
            alias="JD",
            party="Progresibo",
            description="Focus on student welfare and transparent governance.",
            year_level="3",
            degree_program=DEMO_DEGREE_PROGRAMS[0],
        )
        _create_candidate_user(
            email="chair2@test.com",
            password="1234",
            first_name="Ana",
            last_name="Reyes",
            student_number="2024-0102",
            election=election_active,
            position=Candidate.Position.CHAIRPERSON,
            alias="Ana R.",
            party="Tindog",
            description="Campus connectivity and academic support initiatives.",
            year_level="2",
            degree_program=DEMO_DEGREE_PROGRAMS[1],
        )
        _create_candidate_user(
            email="vice1@test.com",
            password="1234",
            first_name="Luis",
            last_name="Garcia",
            student_number="2024-0201",
            election=election_active,
            position=Candidate.Position.VICE_CHAIRPERSON,
            alias="Luigi",
            party="Progresibo",
            year_level="4",
            degree_program=DEMO_DEGREE_PROGRAMS[2],
        )
        _create_candidate_user(
            email="vice2@test.com",
            password="1234",
            first_name="Patricia",
            last_name="Lim",
            student_number="2024-0202",
            election=election_active,
            position=Candidate.Position.VICE_CHAIRPERSON,
            alias="Pat",
            party="Tindog",
            year_level="1",
            degree_program=DEMO_DEGREE_PROGRAMS[3],
        )

        councilor_party = ("Progresibo", "Tindog", "Independent")
        for i in range(1, 9):
            party = councilor_party[i % 3]
            _create_candidate_user(
                email=f"councilor{i:02d}@test.com",
                password="1234",
                first_name="Councilor",
                last_name=f"Demo{i}",
                student_number=f"2024-03{i:02d}",
                election=election_active,
                position=Candidate.Position.COUNCILOR,
                alias=f"C{i}",
                party=party,
                description=(
                    f"Platform highlights for council seat {i}: outreach, org partnerships, "
                    "and feedback loops."
                ),
                year_level=str((i % 4) + 1),
                degree_program=DEMO_DEGREE_PROGRAMS[
                    (i - 1) % len(DEMO_DEGREE_PROGRAMS)
                ],
            )

        # Returning nominees: voters who already had Candidate rows on archived past cycle,
        # added again on the active published election (admin “same person, new slate”).
        _add_returning_candidate(
            voter=User.objects.get(email="past.chair1@test.com").voter,
            election=election_active,
            position=Candidate.Position.COUNCILOR,
            alias="Pedro Returns",
            party="Legacy Forward",
            description=(
                "Also ran as chair on archived 2024 demo; running councilor on active cycle."
            ),
        )
        _add_returning_candidate(
            voter=User.objects.get(email="past.council2@test.com").voter,
            election=election_active,
            position=Candidate.Position.COUNCILOR,
            alias="PastTwo Active",
            party="Renew",
            description="Archived-cycle councilor with a fresh Candidate row for 2026 active.",
        )

        active_candidate_voters = _candidate_voters_for_election(election_active)
        active_demo_roster_voters = _active_roster_demo_voters(demo_voters)
        voters_for_active = list(
            dict.fromkeys(active_demo_roster_voters + active_candidate_voters)
        )
        active_roster_tail_excluded = (
            demo_voters[-ACTIVE_ELECTION_ROSTER_EXCLUDE_TAIL:]
            if len(demo_voters) > 1 + ACTIVE_ELECTION_ROSTER_EXCLUDE_TAIL
            else []
        )

        _bulk_enroll(election_active, voters_for_active)

        n_active, skipped_active, pool_active = _seed_ballots_for_election(
            election_active,
            voters_for_active,
            abstain_chair_every=12,
            abstain_vice_every=15,
            abstain_council_every=21,
            councilor_pick_count=5,
            skip_ballot_if=_skip_ballot_active,
            velocity_burst_every=6,
        )

        # --- Draft next cycle (not published until admin publishes after archiving ended row) ---
        election_draft = Election.objects.create(
            name="2028 Draft Student Council Elections (Demo)",
            description=(
                "Draft only: edit dates here after archiving any ended published election; "
                "then Publish when ready (no concurrent published future cycle in this product story)."
            ),
            start_datetime=now + timedelta(days=120),
            end_datetime=now + timedelta(days=127),
            status=Election.Status.DRAFT,
            published_at=None,
            created_by=admin_user,
        )

    print("Seeding complete.")
    _verify_enrollments_have_public_ids()

    returning_active_n = Candidate.objects.filter(
        election=election_active,
        voter__user__email__in=(
            "past.chair1@test.com",
            "past.council2@test.com",
        ),
    ).count()

    enrollment_sample = ElectionEnrollment.objects.filter(
        election=election_active
    ).count()
    print(
        f"  Active election roster: {enrollment_sample} enrollments "
        f"(subset of demo pool - tail voters intentionally NOT enrolled for roster QA)."
    )
    if active_roster_tail_excluded:
        sample_emails = ", ".join(v.user.email for v in active_roster_tail_excluded[:4])
        extra = (
            f" (+{len(active_roster_tail_excluded) - 4} more)"
            if len(active_roster_tail_excluded) > 4
            else ""
        )
        print(
            f"  NOT on active roster (enroll via Admin -> Voter roster): "
            f"{sample_emails}{extra}"
        )

    print(
        f'  Archived history: "{election_past.name}" (id={election_past.pk}) - '
        f"{n_past} ballots / {pool_past} roster pool ({skipped_past} not cast)."
    )
    print(
        f'  Published (ended, archive next): "{election_ended_published.name}" '
        f'(id={election_ended_published.pk}) - '
        f"{n_ended_pub} ballots / {pool_ended_pub} pool ({skipped_ended_pub} not cast)."
    )
    print(
        f'  Published (ongoing, canonical API target): "{election_active.name}" '
        f'(id={election_active.pk}) - '
        f"until {election_active.end_datetime.isoformat()}; "
        f"{n_active} ballots / {pool_active} pool ({skipped_active} not cast)."
    )
    print(
        f'  Draft: "{election_draft.name}" (id={election_draft.pk}) - no candidates or roster.'
    )
    print()
    print("  Accounts: admin@test.com / admin123 | auditor@test.com / auditor123")
    print(
        "  Voters: voter@test.com + demovoter000@... + firstlogin@test.com / 1234 "
        "(firstlogin must change password before voting)."
    )
    print("  Candidate (active published slate): candidate@test.com / 1234")
    print(
        "  Returning candidates (also on archived 2024): past.chair1@test.com, "
        "past.council2@test.com / 1234 (role=candidate while 2026 active is published)."
    )
    print()
    print(
        "  Each ElectionEnrollment row has its own ``public_voter_id`` "
        "(ballot-session ``current_cycle`` + voter_public_id while voting is open)."
    )
    print(
        f"  Returning nominees: {returning_active_n} Candidate rows on the ongoing election for "
        "past.chair1 & past.council2 (same Voter as archived 2024 slate; one Candidate row per election)."
    )
    print(
        "  Admin: hourly activity, vote velocity (gap + fingerprint corroboration), "
        "device fingerprints on ACTIVE election; roster CSV + clear-roster (no ballots); "
        "candidate add/remove frozen while voting open."
    )
    print(
        "    Partial active roster: enroll excluded tail voters via Voter roster to "
        "simulate eligibility / dashboard primary button states."
    )
    print(
        "    Workflow: archive the ended published row when done testing banners; "
        "then Publish the draft (or adjust draft dates first)."
    )
    print(
        "  Auditor: open archived / ended / ongoing elections by id; "
        "only one pair published-non-archived here (ended + ongoing)."
    )
    print(
        "  Voter/Candidate dashboards: single adaptive CTA from ballot-session "
        "(Vote vs receipt vs enrollment messaging)."
    )
