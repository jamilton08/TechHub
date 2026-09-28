from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Asset


@receiver(post_delete, sender=Asset)
def remove_asset_file(sender, instance, **kwargs):
    """Delete the stored bytes when an asset row goes (directly or with its project)."""
    if instance.file:
        instance.file.delete(save=False)
