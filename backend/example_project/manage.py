#!/usr/bin/env python
"""A throwaway Django project for trying the arcade app locally.
Your real backend replaces this; only backend/arcade is meant to be kept."""
import os
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # so `arcade` imports
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
