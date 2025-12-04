import uuid
from django.db import models


# ---------------------------
# USERS & PROFILES
# ---------------------------

class User(models.Model):
    email = models.EmailField(primary_key=True)
    name = models.CharField(max_length=150)
    password = models.CharField(max_length=255)
    role = models.CharField(
        max_length=20,
        choices=[
            ('admin', 'Admin'),
            ('voter', 'Voter'),
            ('candidate', 'Candidate'),
            ('auditor', 'Auditor'),
        ]
    )

    def __str__(self):
        return self.email

class VoterProfile(models.Model):
    voter_id = models.UUIDField( 
        default=uuid.uuid4, 
        unique=True, 
        editable=False
    )
    email = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    student_number = models.CharField(max_length=20, unique=True)
    course = models.CharField(max_length=50)
    year_level = models.IntegerField()
    is_eligible = models.BooleanField(default=True)


class CandidateProfile(models.Model):
    email = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    party = models.CharField(max_length=100, blank=True, null=True)
    alias = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    is_verified = models.BooleanField(default=False)


class CandidateUpdate(models.Model):
    id = models.AutoField(primary_key=True)
    candidate_email = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=True)


# ---------------------------
# ELECTION MANAGEMENT
# ---------------------------

class Election(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=150)
    description = models.TextField()
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    is_active = models.BooleanField(default=True)


class Position(models.Model):
    id = models.AutoField(primary_key=True)
    election = models.ForeignKey(Election, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    max_winners = models.IntegerField(default=1)
    choice_type = models.CharField(
        max_length=10,
        choices=[('single', 'Single'), ('multiple', 'Multiple')]
    )


class CandidateForPosition(models.Model):
    id = models.AutoField(primary_key=True)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    candidate_email = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE)


# ---------------------------
# VOTING SYSTEM
# ---------------------------

class Vote(models.Model):
    id = models.AutoField(primary_key=True)
    election = models.ForeignKey(Election, on_delete=models.CASCADE)
    voter_email = models.ForeignKey(User, on_delete=models.CASCADE)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    candidate_email = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE)
    encrypted_vote = models.TextField()
    idempotency_key = models.CharField(max_length=64, unique=True)
    submission_latency_ms = models.IntegerField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('voter_email', 'position')


class VoteReceipt(models.Model):
    id = models.AutoField(primary_key=True)
    vote = models.OneToOneField(Vote, on_delete=models.CASCADE)
    ack_hash = models.CharField(max_length=64)
    server_timestamp = models.DateTimeField(auto_now_add=True)
    client_timestamp = models.DateTimeField()
    retransmissions = models.IntegerField(default=0)


# ---------------------------
# TALLY RESULTS
# ---------------------------

class TallyResult(models.Model):
    id = models.AutoField(primary_key=True)
    election = models.ForeignKey(Election, on_delete=models.CASCADE)
    position = models.ForeignKey(Position, on_delete=models.CASCADE)
    candidate_email = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE)
    vote_count = models.IntegerField()
    generated_at = models.DateTimeField(auto_now_add=True)


# ---------------------------
# SECURITY & LOGGING
# ---------------------------

class AuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    user_email = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=250)
    ip_address = models.CharField(max_length=50)
    prev_hash = models.CharField(max_length=64)
    curr_hash = models.CharField(max_length=64)
    timestamp = models.DateTimeField(auto_now_add=True)


class LoginAttempt(models.Model):
    id = models.AutoField(primary_key=True)
    user_email = models.ForeignKey(User, on_delete=models.CASCADE)
    ip_address = models.CharField(max_length=50)
    status = models.CharField(max_length=10)
    timestamp = models.DateTimeField(auto_now_add=True)


class NetworkLog(models.Model):
    id = models.AutoField(primary_key=True)
    user_email = models.ForeignKey(User, on_delete=models.CASCADE)
    ip_address = models.CharField(max_length=50)
    latency_ms = models.IntegerField()
    packet_loss = models.FloatField()
    event_type = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)


class RequestLog(models.Model):
    id = models.AutoField(primary_key=True)
    user_email = models.ForeignKey(User, on_delete=models.CASCADE)
    endpoint = models.CharField(max_length=200)
    ip_address = models.CharField(max_length=50)
    user_agent = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)


# ---------------------------
# REAL-TIME METRICS
# ---------------------------

class SystemMetric(models.Model):
    id = models.AutoField(primary_key=True)
    metric_name = models.CharField(max_length=100)
    metric_value = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
