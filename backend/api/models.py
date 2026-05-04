import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
from django.conf import settings

# Create your models here.

#-------------------------------
# USER
#-------------------------------
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()

        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        return self.create_user(email, password, **extra_fields)
    
class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    must_change_password = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email
    
#-------------------------------
# FACULTY
#-------------------------------
class Faculty(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    employee_id = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.user.email
    
#-------------------------------
# VOTER (STUDENT)
#-------------------------------
class Voter(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    student_number = models.CharField(max_length=50, unique=True)
    voter_public_id = models.UUIDField(
        unique=True,
        null=True,
        blank=True,
        editable=False,
        default=None,
        help_text="Legacy global pseudonym (unused by ballot-session; use ElectionEnrollment.public_voter_id per election).",
    )
    year_level = models.CharField(
        max_length=32,
        blank=True,
        help_text="Academic year level (e.g. 1–5); optional demographic.",
    )
    degree_program = models.CharField(
        max_length=128,
        blank=True,
        help_text="Degree program name for turnout / auditor charts.",
    )

    def __str__(self):
        return self.user.email

    def ensure_voter_public_id(self):
        """Assign a random UUID once and persist it."""
        if self.voter_public_id is None:
            self.voter_public_id = uuid.uuid4()
            self.save(update_fields=["voter_public_id"])
        return self.voter_public_id
    
#-------------------------------
# CANDIDATE (VOTER)
#-------------------------------
class Candidate(models.Model):
    class Position(models.TextChoices):
        CHAIRPERSON = "Chairperson", "Chairperson"
        VICE_CHAIRPERSON = "Vice Chairperson", "Vice Chairperson"
        COUNCILOR = "Councilor", "Councilor"

    voter = models.ForeignKey(
        Voter,
        on_delete=models.CASCADE,
        related_name="candidate_entries",
    )
    election = models.ForeignKey(
        "Election",
        on_delete=models.PROTECT,
        related_name="candidates",
        null=True,
        blank=True,
    )
    alias = models.CharField(max_length=100, blank=True)
    party = models.CharField(max_length=100, blank=True)
    profile_photo = models.ImageField(
        upload_to="candidate_photos/",
        blank=True,
        null=True,
        help_text="Shown on the ballot; optional.",
    )
    position = models.CharField(
        max_length=32,
        choices=Position.choices,
        blank=True,
    )
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "voter__user__last_name"]
        constraints = [
            models.UniqueConstraint(
                fields=("election", "voter"),
                name="api_candidate_unique_election_voter",
            ),
        ]

    def __str__(self):
        return self.voter.user.email
    
#-------------------------------
# AUDITOR
#-------------------------------
class Auditor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)

    def __str__(self):
        return self.user.email
    
#-------------------------------
# ADMIN
#-------------------------------
class Admin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)

    def __str__(self):
        return self.user.email


#-------------------------------
# ELECTION
#-------------------------------
class Election(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="elections_created",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-start_datetime"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_datetime__gt=models.F("start_datetime")),
                name="election_end_after_start",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.start_datetime:%Y-%m-%d} -> {self.end_datetime:%Y-%m-%d})"

    @property
    def is_voting_open(self):
        now = timezone.now()
        return (
            self.status == self.Status.PUBLISHED
            and self.start_datetime <= now <= self.end_datetime
        )

    @property
    def has_started(self):
        return timezone.now() >= self.start_datetime

    @property
    def state(self):
        """Derived high-level state for the UI.

        Returns one of:
            'draft'     - admin is still setting it up
            'scheduled' - published, but voting hasn't started yet
            'ongoing'   - published, voting is happening right now
            'ended'     - published, voting period has lapsed (awaiting archive)
            'archived'  - explicitly archived by an admin
        """
        if self.status == self.Status.DRAFT:
            return "draft"
        if self.status == self.Status.ARCHIVED:
            return "archived"

        now = timezone.now()
        if now < self.start_datetime:
            return "scheduled"
        if now > self.end_datetime:
            return "ended"
        return "ongoing"


#-------------------------------
# ELECTION ENROLLMENT (electorate roster per election)
#-------------------------------
class ElectionEnrollment(models.Model):
    """Links a voter to an election for eligibility / turnout denominators.

    Used by the auditor dashboard and (when rows exist) by ``cast_ballot`` so only
    rostered voters may vote. Candidates get a row automatically via ``post_save``.

    ``public_voter_id`` is a per-enrollment ballot pseudonym (new UUID when this row
    is created); it is independent of ``Voter.voter_public_id``.
    """

    election = models.ForeignKey(
        Election,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    voter = models.ForeignKey(
        Voter,
        on_delete=models.CASCADE,
        related_name="election_enrollments",
    )
    public_voter_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        help_text="Ballot/receipt-facing ID unique to this (election, voter) enrollment.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.public_voter_id is None:
            self.public_voter_id = uuid.uuid4()
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("election", "voter"),
                name="api_election_enrollment_unique_election_voter",
            ),
        ]
        indexes = [
            models.Index(fields=("election", "voter")),
        ]

    def __str__(self):
        return f"{self.voter_id} → election {self.election_id}"


#-------------------------------
# BALLOT (cast vote record)
#-------------------------------
class Ballot(models.Model):
    """One immutable ballot per voter per election (submitted through /api/voters/cast-ballot/)."""

    voter = models.ForeignKey(Voter, on_delete=models.CASCADE, related_name="ballots")
    election = models.ForeignKey(
        Election, on_delete=models.CASCADE, related_name="ballots"
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    client_submit_latency_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional client-reported time from ballot UI entry to submit (ms).",
    )
    device_fingerprint_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="SHA-256 hex (64 chars) of a browser-provided fingerprint string.",
    )
    submission_ip = models.CharField(
        max_length=45,
        blank=True,
        default="",
        db_index=True,
        help_text="Client IP observed by the server when the ballot was submitted.",
    )
    submission_user_agent = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="HTTP User-Agent from the submit request (server-side).",
    )
    client_install_id = models.CharField(
        max_length=36,
        blank=True,
        default="",
        db_index=True,
        help_text="First-party UUID persisted in the voter browser (sent by client).",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("voter", "election"),
                name="api_ballot_unique_voter_election",
            ),
        ]

    def __str__(self):
        return f"Ballot {self.voter_id} / election {self.election_id}"


class BallotLine(models.Model):
    """Single choice line: one seat (chair/vice) or one councilor pick; abstentions use abstain=True."""

    ballot = models.ForeignKey(
        Ballot, on_delete=models.CASCADE, related_name="lines"
    )
    position = models.CharField(max_length=32, choices=Candidate.Position.choices)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ballot_lines",
    )
    abstain = models.BooleanField(default=False)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        if self.abstain:
            return f"{self.position} abstain"
        return f"{self.position} → {self.candidate_id}"