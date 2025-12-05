from django.contrib import admin
from .models import (
    User, 
    VoterProfile, 
    CandidateProfile, 
    CandidateUpdate, 
    Election, 
    Position, 
    CandidateForPosition, 
    Vote, 
    VoteReceipt, 
    TallyResult, 
    AuditLog, 
    LoginAttempt, 
    NetworkLog, 
    RequestLog, 
    SystemMetric
)

# ---------------------------
# USERS & PROFILES
# ---------------------------
admin.site.register(User)
admin.site.register(VoterProfile)
admin.site.register(CandidateProfile)
admin.site.register(CandidateUpdate)


# ---------------------------
# ELECTION MANAGEMENT
# ---------------------------
admin.site.register(Election)
admin.site.register(Position)
admin.site.register(CandidateForPosition)


# ---------------------------
# VOTING SYSTEM
# ---------------------------
admin.site.register(Vote)
admin.site.register(VoteReceipt)


# ---------------------------
# TALLY RESULTS
# ---------------------------
admin.site.register(TallyResult)


# ---------------------------
# SECURITY & LOGGING
# ---------------------------
admin.site.register(AuditLog)
admin.site.register(LoginAttempt)
admin.site.register(NetworkLog)
admin.site.register(RequestLog)


# ---------------------------
# REAL-TIME METRICS
# ---------------------------
admin.site.register(SystemMetric)