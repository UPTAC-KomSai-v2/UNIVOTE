from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Candidate, ElectionEnrollment


@receiver(post_save, sender=Candidate)
def enroll_candidate_for_election(sender, instance, **kwargs):
    """Anyone on the ballot is part of that election's electorate."""
    if instance.election_id:
        ElectionEnrollment.objects.get_or_create(
            election_id=instance.election_id,
            voter_id=instance.voter_id,
        )
