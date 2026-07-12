import os
import sys

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_path)
os.chdir(backend_path)

import django
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@local')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'SupaAdmin!2026')

try:
    user = User.objects.get(username=username)
    user.is_staff = True
    user.is_superuser = True
    user.email = email
    user.set_password(password)
    user.save()
    print(f"Updated existing user: {username}")
except User.DoesNotExist:
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f"Created superuser: {username}")
