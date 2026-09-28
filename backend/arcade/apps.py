from django.apps import AppConfig


class ArcadeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "arcade"
    verbose_name = "Python Arcade"

    def ready(self):
        from . import signals  # noqa: F401
