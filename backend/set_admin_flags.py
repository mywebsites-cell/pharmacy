import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

try:
    user = User.objects.get(email='admin@pharmacy.com')
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f'✓ Updated {user.email}')
    print(f'  is_staff: {user.is_staff}')
    print(f'  is_superuser: {user.is_superuser}')
except User.DoesNotExist:
    print('✗ User not found')
