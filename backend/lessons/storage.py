"""Dev storage for lesson files: a folder under MEDIA_ROOT that OVERWRITES on
re-upload, like the R2 storage does on the server (file_overwrite=True), so a
lesson keeps the key <course>/<slug>.html forever."""
from django.core.files.storage import FileSystemStorage


class OverwritingFileSystemStorage(FileSystemStorage):
    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            self.delete(name)
        return name
