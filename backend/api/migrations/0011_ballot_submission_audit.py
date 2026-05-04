# Generated manually for ballot submission audit trail (fraud-pattern evidence).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_ballot_velocity_metrics"),
    ]

    operations = [
        migrations.AddField(
            model_name="ballot",
            name="submission_ip",
            field=models.CharField(
                blank=True,
                default="",
                max_length=45,
                db_index=True,
                help_text="Client IP observed by the server when the ballot was submitted.",
            ),
        ),
        migrations.AddField(
            model_name="ballot",
            name="submission_user_agent",
            field=models.CharField(
                blank=True,
                default="",
                max_length=512,
                help_text="HTTP User-Agent from the submit request (server-side).",
            ),
        ),
        migrations.AddField(
            model_name="ballot",
            name="client_install_id",
            field=models.CharField(
                blank=True,
                default="",
                max_length=36,
                db_index=True,
                help_text="First-party UUID persisted in the voter browser (sent by client).",
            ),
        ),
    ]
