"""Mount with:  path("api/", include("arcade.urls"))  →  /api/arcade/…"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssetView, MeView, ProjectViewSet

app_name = "arcade"

router = DefaultRouter(trailing_slash=True)
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("arcade/me/", MeView.as_view(), name="me"),
    path("arcade/projects/<uuid:pk>/assets/<str:name>/", AssetView.as_view(), name="asset"),
    path("arcade/", include(router.urls)),
]
