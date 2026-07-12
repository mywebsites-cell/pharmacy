"""
Management command: ensure_desktop_admin

Creates a local superuser (admin / admin123) if no superuser exists yet.
Idempotent — safe to run on every app launch.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from apps.authentication.models import Role, UserRole
from apps.pharmacy.models import Pharmacy, Branch, BranchSettings


class Command(BaseCommand):
    help = 'Ensure a local desktop superuser exists (username: admin, password: admin123)'

    def handle(self, *args, **options):
        User = get_user_model()

        admin_user = User.objects.filter(username='admin').first()
        if admin_user is None:
            admin_user = User.objects.create_superuser(
                username='admin',
                email='admin@pharmacypro.local',
                password='admin123',
                first_name='Admin',
            )
            self.stdout.write(
                self.style.SUCCESS(
                    '[ensure_desktop_admin] Desktop superuser created (admin / admin123).'
                )
            )
        else:
            updated_fields = []
            if not admin_user.is_superuser:
                admin_user.is_superuser = True
                updated_fields.append('is_superuser')
            if not admin_user.is_staff:
                admin_user.is_staff = True
                updated_fields.append('is_staff')
            if not admin_user.is_active:
                admin_user.is_active = True
                updated_fields.append('is_active')
            if not admin_user.email:
                admin_user.email = 'admin@pharmacypro.local'
                updated_fields.append('email')
            if updated_fields:
                admin_user.save(update_fields=updated_fields)
            self.stdout.write('[ensure_desktop_admin] Superuser already exists.')

        role, _ = Role.objects.get_or_create(
            name='SUPER_ADMIN',
            defaults={'description': 'Desktop administrator'},
        )

        suffix = str(admin_user.id).replace('-', '')[:8].upper()
        pharmacy = Pharmacy.all_objects.filter(owner=admin_user).order_by('created_at').first()
        if pharmacy is None:
            pharmacy = Pharmacy.objects.create(
                name='PharmacyPro Desktop',
                registration_number=f'DESKTOP-{suffix}-REG',
                license_number=f'DESKTOP-{suffix}-LIC',
                license_expiry=timezone.now().date() + timedelta(days=3650),
                owner=admin_user,
                phone_number='0000000000',
                email=admin_user.email or 'admin@pharmacypro.local',
                address_line_1='Local Desktop Instance',
                address_line_2='',
                city='Local',
                state='Local',
                country='Local',
                postal_code='00000',
                timezone='UTC',
                currency='PKR',
                tax_rate=0,
                is_active=True,
                is_verified=True,
            )

        branch = Branch.all_objects.filter(pharmacy=pharmacy).order_by('created_at').first()
        if branch is None:
            branch = Branch.objects.create(
                pharmacy=pharmacy,
                name='Main Branch',
                code=f'MAIN-{suffix[:4]}',
                manager=admin_user,
                phone_number=pharmacy.phone_number,
                email=pharmacy.email,
                address_line_1=pharmacy.address_line_1,
                address_line_2=pharmacy.address_line_2,
                city=pharmacy.city,
                state=pharmacy.state,
                country=pharmacy.country,
                postal_code=pharmacy.postal_code,
                is_active=True,
            )
        elif branch.manager_id != admin_user.id:
            branch.manager = admin_user
            branch.save(update_fields=['manager'])

        BranchSettings.objects.get_or_create(branch=branch)
        UserRole.objects.update_or_create(
            user=admin_user,
            defaults={
                'role': role,
                'pharmacy': pharmacy,
                'branch': branch,
                'is_active': True,
            },
        )
        self.stdout.write('[ensure_desktop_admin] Desktop pharmacy context is ready.')
