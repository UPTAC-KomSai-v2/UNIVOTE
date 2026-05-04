from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CandidateViewSet,
    ElectionViewSet,
    VoterCsvUploadView,
    admin_election_ballots_by_hour_view,
    admin_election_device_fingerprints_view,
    admin_election_overview_view,
    admin_election_vote_velocity_view,
    admin_election_voter_roster_clear_view,
    admin_election_voter_roster_enroll_view,
    admin_election_voter_roster_unenroll_view,
    admin_election_voter_roster_view,
    admin_voter_by_student_number_view,
    auditor_election_ballot_timeline_view,
    auditor_election_results_view,
    ballot_session_view,
    candidate_self_profile_view,
    cast_ballot_view,
    change_password_view,
    login_view,
    me_view,
    voting_receipt_view,
)

router = DefaultRouter()
router.register(r"elections", ElectionViewSet, basename="election")
router.register(r"candidates", CandidateViewSet, basename="candidate")

urlpatterns = [
    path("login/", login_view),
    path("me/", me_view),
    path("me/candidate-profile/", candidate_self_profile_view),
    path("change-password/", change_password_view),
    path("voters/ballot-session/", ballot_session_view),
    path("voters/voting-receipt/", voting_receipt_view),
    path("voters/cast-ballot/", cast_ballot_view),
    path("voters/upload-csv/", VoterCsvUploadView.as_view()),
    path("auditor/election-results/<int:election_id>/", auditor_election_results_view),
    path(
        "auditor/election-ballot-timeline/<int:election_id>/",
        auditor_election_ballot_timeline_view,
    ),
    path(
        "admin/election-ballots-by-hour/<int:election_id>/",
        admin_election_ballots_by_hour_view,
    ),
    path(
        "admin/election-overview/<int:election_id>/",
        admin_election_overview_view,
    ),
    path(
        "admin/election-vote-velocity/<int:election_id>/",
        admin_election_vote_velocity_view,
    ),
    path(
        "admin/election-device-fingerprints/<int:election_id>/",
        admin_election_device_fingerprints_view,
    ),
    path(
        "admin/election-voter-roster/<int:election_id>/enroll/",
        admin_election_voter_roster_enroll_view,
    ),
    path(
        "admin/election-voter-roster/<int:election_id>/unenroll/",
        admin_election_voter_roster_unenroll_view,
    ),
    path(
        "admin/election-voter-roster/<int:election_id>/clear/",
        admin_election_voter_roster_clear_view,
    ),
    path(
        "admin/election-voter-roster/<int:election_id>/",
        admin_election_voter_roster_view,
    ),
    path(
        "admin/voters/by-student-number/",
        admin_voter_by_student_number_view,
    ),
    path("", include(router.urls)),
]
