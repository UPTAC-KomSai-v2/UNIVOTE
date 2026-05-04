# Generated manually for Univote cast ballots

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_voter_voter_public_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="Ballot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                (
                    "election",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ballots",
                        to="api.election",
                    ),
                ),
                (
                    "voter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ballots",
                        to="api.voter",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="BallotLine",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "position",
                    models.CharField(
                        choices=[
                            ("Chairperson", "Chairperson"),
                            ("Vice Chairperson", "Vice Chairperson"),
                            ("Councilor", "Councilor"),
                        ],
                        max_length=32,
                    ),
                ),
                ("abstain", models.BooleanField(default=False)),
                (
                    "ballot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="api.ballot",
                    ),
                ),
                (
                    "candidate",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="ballot_lines",
                        to="api.candidate",
                    ),
                ),
            ],
            options={
                "ordering": ["position", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="ballot",
            constraint=models.UniqueConstraint(
                fields=("voter", "election"),
                name="api_ballot_unique_voter_election",
            ),
        ),
    ]
