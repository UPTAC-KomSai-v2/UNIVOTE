# Generated manually for Univote ballot-facing voter UUID

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_user_must_change_password"),
    ]

    operations = [
        migrations.AddField(
            model_name="voter",
            name="voter_public_id",
            field=models.UUIDField(
                blank=True,
                default=None,
                editable=False,
                help_text="Anonymous ballot-facing identifier; assigned on first visit to the voting UI.",
                null=True,
                unique=True,
            ),
        ),
    ]
