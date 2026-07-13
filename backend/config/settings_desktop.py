"""
Desktop-specific Django settings.

Inherits from the shared settings.py but overrides everything that
requires external services (PostgreSQL, Redis, Celery, Elasticsearch).
Data lives in the user's AppData folder next to the existing SQLite file.

Usage:
  DJANGO_SETTINGS_MODULE=config.settings_desktop  (set by Electron main)
  MEDICLY_DATA_DIR=<path>                      (set by Electron main)
"""

import os
from .settings import *  # noqa: F401,F403

# ---------------------------------------------------------------------------
# Data directory — passed by the Electron main process at startup
# ---------------------------------------------------------------------------
_DATA_DIR = os.environ.get(
    'MEDICLY_DATA_DIR',
    os.path.join(
        os.environ.get('APPDATA', os.path.expanduser('~')),
        'medicly-desktop',
        'db',
    ),
)
os.makedirs(_DATA_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Database — SQLite instead of PostgreSQL
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(_DATA_DIR, 'pharmacy_django.db'),
        'ATOMIC_REQUESTS': False,   # avoid write-lock conflicts on concurrent requests
        'OPTIONS': {
            'timeout': 30,           # seconds to wait when DB is locked
        },
    }
}

# Enable WAL journal mode for better SQLite concurrency
from django.db.backends.signals import connection_created  # noqa: E402
def _set_wal_mode(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        connection.cursor().execute('PRAGMA journal_mode=WAL;')
        connection.cursor().execute('PRAGMA synchronous=NORMAL;')
connection_created.connect(_set_wal_mode)

# ---------------------------------------------------------------------------
# Remove apps that require external services (Celery, Elasticsearch, Daphne)
# ---------------------------------------------------------------------------
_REMOVE = {
    'daphne',
    'django_celery_beat',
    'django_celery_results',
    'django_elasticsearch_dsl',
}
INSTALLED_APPS = [a for a in INSTALLED_APPS if a not in _REMOVE]  # noqa: F405

# ---------------------------------------------------------------------------
# Cache — in-process memory (no Redis needed)
# ---------------------------------------------------------------------------
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# ---------------------------------------------------------------------------
# Middleware — strip out whitenoise (not installed / not needed locally)
# and any channel layers middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [m for m in MIDDLEWARE if 'whitenoise' not in m.lower()]  # noqa: F405

# Static files — use plain Django staticfiles (no whitenoise compression)
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# ---------------------------------------------------------------------------
# Celery — run all tasks synchronously in the same process
# ---------------------------------------------------------------------------
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

# ---------------------------------------------------------------------------
# ASGI / Channels — not needed on desktop (no WebSockets)
# ---------------------------------------------------------------------------
ASGI_APPLICATION = None

# ---------------------------------------------------------------------------
# CORS — allow Vite dev-server and Electron renderer
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Hosts — desktop is always local
# ---------------------------------------------------------------------------
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '*']

# ---------------------------------------------------------------------------
# Security — relax for local-only use
# ---------------------------------------------------------------------------
# The desktop backend must use the project's custom user model; many desktop
# API views and foreign keys assume CustomUser plus its related UserRole.
AUTH_USER_MODEL = 'common.CustomUser'

# Allow simple passwords for the auto-created desktop admin account
AUTH_PASSWORD_VALIDATORS = []

# Disable CSRF on the API (we rely on short-lived JWT tokens)
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}

# Extend JWT token lifetime so the desktop stays logged in
from datetime import timedelta  # noqa: E402
SIMPLE_JWT = {  # noqa: F405
    **SIMPLE_JWT,  # noqa: F405
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=365),
    # Use the standard serializer — avoids CustomUser / UserRole dependency on desktop
    'TOKEN_OBTAIN_SERIALIZER': 'rest_framework_simplejwt.serializers.TokenObtainPairSerializer',
    # Don't write last_login on every token request — prevents SQLite lock contention
    'UPDATE_LAST_LOGIN': False,
}
