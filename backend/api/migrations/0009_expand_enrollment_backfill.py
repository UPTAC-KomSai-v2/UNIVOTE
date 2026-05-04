# Data migration: expand ElectionEnrollment for DBs that applied 0008 before heuristic fix.

from django.db import migrations


def forwards(apps, schema_editor):
    from django.db.models import Exists, OuterRef

    ElectionEnrollment = apps.get_model("api", "ElectionEnrollment")
    Election = apps.get_model("api", "Election")
    Voter = apps.get_model("api", "Voter")
    Ballot = apps.get_model("api", "Ballot")
    Candidate = apps.get_model("api", "Candidate")

    rows = []
    for election in Election.objects.all():
        ballot_here = Ballot.objects.filter(
            election_id=election.pk, voter_id=OuterRef("pk")
        )
        cand_here = Candidate.objects.filter(
            election_id=election.pk, voter_id=OuterRef("pk")
        )
        cand_elsewhere = Candidate.objects.filter(voter_id=OuterRef("pk")).exclude(
            election_id=election.pk
        )
        for vid in (
            Voter.objects.filter(
                Exists(ballot_here) | Exists(cand_here) | (~Exists(cand_elsewhere))
            )
            .values_list("pk", flat=True)
            .iterator()
        ):
            rows.append(
                ElectionEnrollment(election_id=election.pk, voter_id=vid)
            )

    if rows:
        ElectionEnrollment.objects.bulk_create(rows, ignore_conflicts=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_election_enrollment"),
    ]

    operations = [
        migrations.RunPython(forwards, noop_reverse),
    ]
