#!/usr/bin/env python
"""Script legado: delega para core.demo_seed (use também: python manage.py seed_demo_data)."""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sistema_gestao.settings")
django.setup()

from core.demo_seed import seed_demo_data  # noqa: E402

if __name__ == "__main__":
    seed_demo_data()
