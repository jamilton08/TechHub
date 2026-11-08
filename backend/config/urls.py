from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("lessons.urls")),
    path("api/", include("assignments.urls")),
    path("api/", include("arcade.urls")),
]

if not settings.R2_BUCKET:
    # dev only: lesson files from disk, embeddable in the site's iframe (on the server they
    # come straight from R2 via lessons.hsct.tech and Django never sees them)
    urlpatterns += [re_path(r"^lesson-files/(?P<path>.*)$", xframe_options_exempt(serve), {"document_root": settings.MEDIA_ROOT / "lesson-files"})]
