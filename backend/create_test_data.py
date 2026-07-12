import os
import django
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.authentication.models import Role, UserRole
from apps.pharmacy.models import Pharmacy, Branch
from apps.saas.models import SubscriptionPlan, TenantSubscription

User = get_user_model()

def create_test_data():
    print("Creating test data...")
    
    # 1. Create Super Admin
    super_admin_role, _ = Role.objects.get_or_create(name='SUPER_ADMIN', defaults={'description': 'Super Admin'})
    admin_user, created = User.objects.get_or_create(username='admin', email='admin@pharmacy.com')
    if created:
        admin_user.set_password('admin123')
        admin_user.first_name = 'Super'
        admin_user.last_name = 'Admin'
        admin_user.save()
        print("Created Super Admin user: admin / admin123")
    
    UserRole.objects.get_or_create(user_id=admin_user.id, defaults={'role': super_admin_role})

    # 2. Create Pharmacy Owner Role
    owner_role, _ = Role.objects.get_or_create(name='PHARMACY_OWNER', defaults={'description': 'Pharmacy Owner'})
    
    # 3. Create Test Pharmacy
    owner_user, created = User.objects.get_or_create(username='owner1', email='owner@pharmacy.com')
    if created:
        owner_user.set_password('password123')
        owner_user.first_name = 'Pharmacy'
        owner_user.last_name = 'Owner'
        owner_user.save()
        print("Created Pharmacy Owner user: owner1 / password123")
        
    pharmacy, _ = Pharmacy.objects.get_or_create(
        name='Downtown Pharmacy',
        defaults={
            'registration_number': 'REG12345',
            'license_number': 'LIC12345',
            'license_expiry': timezone.now().date(),
            'owner': owner_user,
            'email': 'downtown@pharmacy.com',
            'phone_number': '1234567890',
            'address_line_1': '123 Main St',
            'city': 'Metropolis',
            'state': 'NY',
            'country': 'USA',
            'postal_code': '10001'
        }
    )
    
    # 4. Create Branches
    branch1, _ = Branch.objects.get_or_create(
        pharmacy=pharmacy,
        code='MAIN',
        defaults={
            'name': 'Main Branch',
            'phone_number': '1234567890',
            'email': 'main@pharmacy.com',
            'address_line_1': '123 Main St',
            'city': 'Metropolis',
            'state': 'NY',
            'country': 'USA',
            'postal_code': '10001'
        }
    )
    branch2, _ = Branch.objects.get_or_create(
        pharmacy=pharmacy,
        code='UPTOWN',
        defaults={
            'name': 'Uptown Branch',
            'phone_number': '0987654321',
            'email': 'uptown@pharmacy.com',
            'address_line_1': '456 Uptown Rd',
            'city': 'Metropolis',
            'state': 'NY',
            'country': 'USA',
            'postal_code': '10001'
        }
    )

    UserRole.objects.get_or_create(
        user_id=owner_user.id,
        defaults={
            'role': owner_role,
            'pharmacy': pharmacy,
            'branch': branch1
        }
    )

    # 5. Create Subscription Plan
    plan, _ = SubscriptionPlan.objects.get_or_create(
        name='Pro Plan',
        defaults={
            'price': 99.99,
            'duration_days': 30,
            'features_config': {"has_multi_branch": True},
            'max_branches': 5,
            'max_devices_per_branch': 3
        }
    )

    # 6. Create Active Subscription for Pharmacy
    sub, _ = TenantSubscription.objects.get_or_create(
        pharmacy=pharmacy,
        defaults={
            'plan': plan,
            'status': 'active',
            'starts_at': timezone.now(),
            'expires_at': timezone.now() + timedelta(days=30)
        }
    )
    
    if sub.status != 'active':
        sub.status = 'active'
        sub.expires_at = timezone.now() + timedelta(days=30)
        sub.save()
        
    print("Test data setup complete!")
    print("-------------------------------------------------")
    print("Super Admin Login: admin / admin123")
    print("Pharmacy Owner Login: owner1 / password123")
    print("The owner's pharmacy currently has an ACTIVE subscription.")

if __name__ == '__main__':
    create_test_data()
