"""One-time move of the catalog + lesson files into the backend (and R2).

    node scripts/export-catalog.mjs > catalog.json       # from the repo root
    python manage.py import_lessons catalog.json ../public/lesson-files

Safe to run again: courses/topics/lessons are matched by slug and updated;
files are re-uploaded (same key, overwritten). Lessons with a full URL in
`file` are kept as external links.
"""
import json
import re
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from lessons.models import Course, Lesson, Topic


class Command(BaseCommand):
    help = "Import the lessons.js catalog and upload the lesson HTML files to storage."

    def add_arguments(self, parser):
        parser.add_argument("catalog", help="catalog.json from scripts/export-catalog.mjs")
        parser.add_argument("files_dir", help="public/lesson-files (has <course>/<file>.html)")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, catalog, files_dir, dry_run=False, **opts):
        cat = json.loads(Path(catalog).read_text())
        root = Path(files_dir)
        if not root.is_dir():
            raise CommandError(f"{root} is not a directory")
        n_up = 0
        for ci, c in enumerate(cat["categories"]):
            course, _ = Course.objects.update_or_create(slug=c["slug"], defaults={"title": c["title"], "tone": c.get("tone", "blue"), "blurb": c.get("blurb", ""), "position": ci})
            for ti, t in enumerate(c.get("topics", [])):
                topic, _ = Topic.objects.update_or_create(course=course, slug=t["id"], defaults={"title": t["title"], "position": ti})
                for li, l in enumerate(t.get("lessons", [])):
                    defaults = {
                        "title": l["title"], "description": l.get("description", ""), "kind": l.get("kind", "reading"),
                        "minutes": l.get("minutes"), "added": l.get("added") or None, "tags": l.get("tags", []), "position": li,
                        "published": True,
                    }
                    f = l.get("file") or ""
                    # "/lesson-files/<course>/<name>.html" is a file in another course's folder (a lesson
                    # listed twice); anything else absolute is a page hosted elsewhere
                    shared = re.match(r"^/lesson-files/([^/]+)/([^/]+\.html)$", f)
                    external = "" if shared else (f if (f.startswith("http") or f.startswith("/")) else "")
                    defaults["external_url"] = external
                    lesson, created = Lesson.objects.update_or_create(topic=topic, slug=l["slug"], defaults=defaults)
                    if f and not external:
                        src = (root / shared.group(1) / shared.group(2)) if shared else (root / c["slug"] / f)
                        if not src.is_file():
                            self.stdout.write(self.style.WARNING(f"  missing file: {src}"))
                            continue
                        if dry_run:
                            self.stdout.write(f"  would upload {src} -> {c['slug']}/{l['slug']}.html")
                        else:
                            if lesson.file:
                                lesson.file.storage.delete(lesson.file.name)
                            lesson.file.save(f"{l['slug']}.html", ContentFile(src.read_bytes()), save=True)
                            n_up += 1
                    self.stdout.write(f"{'+' if created else '='} {c['slug']}/{l['slug']}")
        self.stdout.write(self.style.SUCCESS(f"done — {Course.objects.count()} courses, {Lesson.objects.count()} lessons, {n_up} files uploaded"))
