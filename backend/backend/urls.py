from django.contrib import admin
from django.urls import path

from api.views import *

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/hello/', hello_world),
    path('api/login/', login_view),
    path('api/landing/', landing_view),
    path('api/voter-dashboard/', voter_dashboard_view),
    path('api/voting-page/', voting_page_view),
    path('api/candidate-dashboard/', candidate_dashboard_view),
    path('api/manage-profile-page/', manage_profile_page_view),
    path('api/vote-receipt-page/', vote_receipt_page_view),
    path('api/view-candidate/<str:id>/', view_candidate_page_view),
    path('api/admin-dashboard/', admin_dashboard_view),
    path('api/manage-candidates/', manage_candidates_view),
    path('api/manage-candidates/<str:id>/', manage_candidates_view),  
    path('api/view-previous-results/', view_previous_results),
    path('api/auditor-dashboard/', auditor_dashboard_view),
    path('api/auditor-dashboard/', auditor_dashboard_view),
    path('api/upload-voters/', upload_voters_view),
]
