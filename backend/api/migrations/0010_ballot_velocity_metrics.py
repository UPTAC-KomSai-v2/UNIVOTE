from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_expand_enrollment_backfill"),
    ]

    operations = [
        migrations.AddField(
            model_name="ballot",
            name="client_submit_latency_ms",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text="Optional client-reported time from ballot UI entry to submit (ms).",
            ),
        ),
        migrations.AddField(
            model_name="ballot",
            name="device_fingerprint_hash",
            field=models.CharField(
                blank=True,
                default="",
                max_length=64,
                db_index=True,
                help_text="SHA-256 hex (64 chars) of a browser-provided fingerprint string.",
            ),
        ),
    ]
