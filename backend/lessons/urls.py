from django.urls import path

from .views import CatalogView, LessonDeleteView, LessonUploadView

urlpatterns = [
    path("lessons/", CatalogView.as_view(), name="lessons-catalog"),
    path("lessons/upload/", LessonUploadView.as_view(), name="lessons-upload"),
    path("lessons/<slug:course>/<slug:slug>/", LessonDeleteView.as_view(), name="lessons-delete"),
]
