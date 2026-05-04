from django.core.management.base import BaseCommand

from api.seed import run


class Command(BaseCommand):
    help = (
        "Load UniVote demo data matching the publish/archive story: archived history, "
        "one ended-but-published row, one ongoing published cycle (latest published_at), "
        "draft next cycle; rosters (ElectionEnrollment + public_voter_id), ballots with audit metrics, "
        "partial active roster & firstlogin user. "
        "Use --reset to wipe @test.com demo rows first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all demo users/elections (@test.com) then re-seed.",
        )

    def handle(self, *args, **options):
        run(reset=options["reset"])
        if options["reset"]:
            self.stdout.write(self.style.SUCCESS("Demo dataset rebuilt."))
        else:
            self.stdout.write(self.style.SUCCESS("Done."))
