from django.contrib import admin
# 1. Make sure CandidateForPosition is imported here
from .models import User, Election, CandidateProfile, Vote, Position, VoteReceipt, CandidateForPosition, VoterProfile

admin.site.register(User)
admin.site.register(Election)
admin.site.register(Position)
admin.site.register(CandidateProfile)
admin.site.register(Vote)
admin.site.register(VoteReceipt)
admin.site.register(CandidateForPosition)
admin.site.register(VoterProfile)