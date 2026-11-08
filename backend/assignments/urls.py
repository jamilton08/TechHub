from django.urls import path

from . import views

urlpatterns = [
    # students
    path("assignments/open/", views.OpenAssignmentsView.as_view(), name="assignments-open"),
    path("teams/", views.CreateTeamView.as_view(), name="team-create"),
    path("teams/join/", views.JoinTeamView.as_view(), name="team-join"),
    path("teams/<str:code>/", views.TeamView.as_view(), name="team-detail"),
    path("teams/<str:code>/submit/", views.SubmitView.as_view(), name="team-submit"),
    path("teams/<str:code>/leave/", views.LeaveView.as_view(), name="team-leave"),
    # teachers
    path("assignments/", views.AssignmentListView.as_view(), name="assignments-list"),
    path("assignments/<uuid:pk>/", views.AssignmentDetailView.as_view(), name="assignments-detail"),
    path("assignments/<uuid:pk>/board/", views.BoardView.as_view(), name="assignments-board"),
    path("assignments/<uuid:pk>/submissions/", views.SubmissionsView.as_view(), name="assignments-submissions"),
    path("teams/<str:code>/log/", views.TeamLogView.as_view(), name="team-log"),
    path("teams/<str:code>/close/", views.TeamCloseView.as_view(), name="team-close"),
]
