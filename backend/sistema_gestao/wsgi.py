"""
WSGI config for sistema_gestao project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Use production settings if RENDER environment is set, otherwise use default settings
if os.environ.get('RENDER') or os.environ.get('DJANGO_SETTINGS_MODULE') == 'sistema_gestao.settings_production':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings_production')
else:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')

application = get_wsgi_application()
