import uuid

from django.db import migrations, models


def fill_public_voter_ids(apps, schema_editor):
    ElectionEnrollment = apps.get_model("api", "ElectionEnrollment")
    for row in ElectionEnrollment.objects.filter(public_voter_id__isnull=True).iterator():
        row.public_voter_id = uuid.uuid4()
        row.save(update_fields=["public_voter_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_user_delete_cascade_related"),
    ]

    operations = [
        migrations.AddField(
            model_name="electionenrollment",
            name="public_voter_id",
            field=models.UUIDField(
                editable=False,
                null=True,
                blank=True,
            ),
        ),
        migrations.RunPython(fill_public_voter_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="electionenrollment",
            name="public_voter_id",
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                unique=True,
            ),
        ),
    ]
