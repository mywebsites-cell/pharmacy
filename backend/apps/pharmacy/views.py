from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Pharmacy, Branch, BranchSettings, License, TaxConfiguration, BranchDevice, BranchStaff
from .serializers import (
    PharmacySerializer, BranchSerializer, BranchSettingsSerializer,
    LicenseSerializer, TaxConfigurationSerializer, BranchCreateSerializer,
    BranchDeviceSerializer, BranchStaffSerializer, BranchStaffInviteSerializer, BranchStaffAcceptSerializer,
)
from apps.common.models import CustomUser


class PharmacyViewSet(viewsets.ModelViewSet):
    """Manage pharmacies."""
    serializer_class = PharmacySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active', 'is_verified']
    search_fields = ['name', 'registration_number']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'user_role') and user.user_role.role.name == 'SUPER_ADMIN':
            return Pharmacy.objects.all()
        return Pharmacy.objects.filter(owner=user)


class BranchViewSet(viewsets.ModelViewSet):
    """Manage pharmacy branches."""
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['pharmacy', 'is_active']
    search_fields = ['name', 'code', 'city']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'user_role') and user.user_role.role.name == 'SUPER_ADMIN':
            return Branch.objects.select_related('pharmacy').all()
        pharmacy = getattr(user, 'pharmacy', None)
        if pharmacy:
            return Branch.objects.filter(pharmacy=pharmacy)
        return Branch.objects.none()
        
    def get_serializer_class(self):
        if self.action == 'create':
            return BranchCreateSerializer
        return BranchSerializer

    def _is_super_admin(self):
        return hasattr(self.request.user, 'user_role') and self.request.user.user_role.role.name == 'SUPER_ADMIN'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        pharmacy = serializer.validated_data['pharmacy']
        is_super_admin = self._is_super_admin()
        
        if getattr(request.user, 'pharmacy', None) != pharmacy and not is_super_admin:
            return Response({'error': 'You do not have permission to add branches to this pharmacy.'}, status=status.HTTP_403_FORBIDDEN)
            
        if not is_super_admin:
            current_branches = Branch.objects.filter(pharmacy=pharmacy).count()
            max_branches = 1
            if hasattr(pharmacy, 'subscription') and pharmacy.subscription and pharmacy.subscription.plan:
                max_branches = pharmacy.subscription.plan.max_branches
            if current_branches >= max_branches:
                return Response({'error': f'Branch limit of {max_branches} reached for this subscription.'}, status=status.HTTP_400_BAD_REQUEST)
            
        username = serializer.validated_data.pop('username')
        password = serializer.validated_data.pop('password')
        
        if CustomUser.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists. Please choose a unique username for this branch.'}, status=status.HTTP_400_BAD_REQUEST)
            
        branch_user = CustomUser.objects.create_user(
            username=username,
            password=password,
            email=serializer.validated_data.get('email', ''),
            phone_number=serializer.validated_data.get('phone_number', '')
        )
        
        serializer.validated_data['manager'] = branch_user
        self.perform_create(serializer)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """Safe update — validates pharmacy ownership."""
        branch = self.get_object()
        if not self._is_super_admin():
            user_pharmacy = getattr(request.user, 'pharmacy', None)
            if branch.pharmacy != user_pharmacy:
                return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Soft-delete the branch instead of hard delete."""
        branch = self.get_object()
        if not self._is_super_admin():
            user_pharmacy = getattr(request.user, 'pharmacy', None)
            if branch.pharmacy != user_pharmacy:
                return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)
        branch.soft_delete()
        return Response({'status': 'Branch deactivated successfully.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle branch is_active flag."""
        branch = self.get_object()
        if not self._is_super_admin():
            user_pharmacy = getattr(request.user, 'pharmacy', None)
            if branch.pharmacy != user_pharmacy:
                return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)
        branch.is_active = not branch.is_active
        branch.save(update_fields=['is_active', 'updated_at'])
        return Response({'is_active': branch.is_active})

    @action(detail=True, methods=['get'])
    def branches_near(self, request, pk=None):
        """Get branches near coordinates."""
        latitude = request.query_params.get('latitude')
        longitude = request.query_params.get('longitude')
        if not latitude or not longitude:
            return Response({'error': 'latitude and longitude required'}, status=status.HTTP_400_BAD_REQUEST)
        branches = Branch.objects.filter(pharmacy_id=pk)
        serializer = self.get_serializer(branches, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activate_device(self, request, pk=None):
        """Register hardware and generate an auth token (legacy)."""
        branch = self.get_object()
        device_id = request.data.get('device_id')
        device_name = request.data.get('device_name', 'Desktop POS')
        
        if not device_id:
            return Response({'error': 'device_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        is_super_admin = self._is_super_admin()
        if not is_super_admin:
            pharmacy = branch.pharmacy
            max_devices = 1
            if hasattr(pharmacy, 'subscription') and pharmacy.subscription and pharmacy.subscription.plan:
                max_devices = pharmacy.subscription.plan.max_devices_per_branch
            current_devices = BranchDevice.objects.filter(branch=branch, is_active=True).count()
            if current_devices >= max_devices:
                return Response({'error': f'Device limit of {max_devices} reached for this branch.'}, status=status.HTTP_400_BAD_REQUEST)
            
        import secrets
        auth_token = secrets.token_urlsafe(32)
        device = BranchDevice.objects.create(
            branch=branch,
            device_identifier=device_id,
            device_name=device_name,
            auth_token=auth_token,
            is_active=True
        )
        return Response({'auth_token': auth_token, 'device_id': device.id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def global_inventory_search(self, request):
        """Search for medicine across all branches in the pharmacy."""
        user = request.user
        pharmacy = getattr(user, 'pharmacy', None)
        if not pharmacy:
            return Response({'error': 'User not associated with a pharmacy.'}, status=status.HTTP_400_BAD_REQUEST)
        if Branch.objects.filter(pharmacy=pharmacy).count() <= 1:
            return Response({'error': 'Global search requires multiple active branches.'}, status=status.HTTP_403_FORBIDDEN)
        query = request.query_params.get('medicine')
        if not query:
            return Response({'error': 'medicine query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        from apps.inventory.models import Inventory
        from django.db.models import Q
        inventories = Inventory.objects.filter(
            branch__pharmacy=pharmacy, available_quantity__gt=0
        ).filter(
            Q(medicine__generic_name__icontains=query) | Q(medicine__brand_name__icontains=query)
        ).select_related('medicine', 'branch')
        results = [{'branch_name': inv.branch.name, 'medicine_name': f"{inv.medicine.brand_name} ({inv.medicine.strength})",
                    'available_quantity': inv.available_quantity, 'last_updated': inv.updated_at}
                   for inv in inventories]
        return Response(results)


class BranchStaffViewSet(viewsets.ModelViewSet):
    """Manage staff members per branch (staff = access-controlled 'devices')."""
    serializer_class = BranchStaffSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        pharmacy = getattr(user, 'pharmacy', None)
        branch_id = self.request.query_params.get('branch')
        qs = BranchStaff.objects.select_related('user', 'branch')
        if pharmacy:
            qs = qs.filter(branch__pharmacy=pharmacy)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def invite(self, request):
        """Owner invites a staff member — sends OTP to their email."""
        from apps.authentication.models import EmailOTP
        from django.core.mail import send_mail
        from django.conf import settings
        from django.utils import timezone
        from datetime import timedelta
        import random

        serializer = BranchStaffInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            branch = Branch.objects.get(id=data['branch_id'])
        except Branch.DoesNotExist:
            return Response({'error': 'Branch not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_pharmacy = getattr(request.user, 'pharmacy', None)
        is_super_admin = hasattr(request.user, 'user_role') and request.user.user_role.role.name == 'SUPER_ADMIN'
        if branch.pharmacy != user_pharmacy and not is_super_admin:
            return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)

        if not is_super_admin:
            pharmacy = branch.pharmacy
            max_staff = 1
            if hasattr(pharmacy, 'subscription') and pharmacy.subscription and pharmacy.subscription.plan:
                max_staff = pharmacy.subscription.plan.max_devices_per_branch
            active_staff = BranchStaff.objects.filter(branch=branch, status__in=['pending', 'active']).count()
            if active_staff >= max_staff:
                return Response({'error': f'Staff limit of {max_staff} reached for this branch.'}, status=status.HTTP_400_BAD_REQUEST)

        email = data['invited_email']
        if BranchStaff.objects.filter(invited_email=email, branch=branch, status__in=['pending', 'active']).exists():
            return Response({'error': 'This email already has an active or pending invitation to this branch.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = BranchStaff.objects.create(
            branch=branch,
            invited_email=email,
            invited_name=data['invited_name'],
            status='pending',
        )

        otp_code = f"{random.randint(100000, 999999)}"
        expiry = timezone.now() + timedelta(minutes=30)
        EmailOTP.objects.filter(email=email, purpose='STAFF_INVITATION').delete()
        EmailOTP.objects.create(email=email, otp=otp_code, purpose='STAFF_INVITATION', expires_at=expiry)

        try:
            send_mail(
                subject=f'You are invited to join {branch.pharmacy.name}',
                message=(
                    f'Hi {data["invited_name"]},\n\n'
                    f'You have been invited to join {branch.name} ({branch.pharmacy.name}) as a staff member.\n\n'
                    f'Your invitation code is: {otp_code}\n\n'
                    f'This code expires in 30 minutes. Visit the app and go to Staff Activation to complete your registration.\n\n'
                    f'If you did not expect this invitation, please ignore this email.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            staff.delete()
            return Response({'error': f'Failed to send invitation email: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'status': 'Invitation sent.', 'staff_id': str(staff.id), 'invited_email': email}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def accept_invite(self, request):
        """Staff accepts the invitation by submitting OTP + choosing a username & password."""
        from apps.authentication.models import EmailOTP
        from apps.authentication.views import validate_custom_password
        from django.utils import timezone
        from rest_framework_simplejwt.tokens import RefreshToken

        serializer = BranchStaffAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            email_otp = EmailOTP.objects.get(
                email=data['email'], otp=data['otp'], purpose='STAFF_INVITATION',
                expires_at__gt=timezone.now(), is_verified=False,
            )
        except EmailOTP.DoesNotExist:
            return Response({'error': 'Invalid or expired invitation code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            staff = BranchStaff.objects.get(invited_email=data['email'], status='pending')
        except BranchStaff.DoesNotExist:
            return Response({'error': 'No pending invitation found for this email.'}, status=status.HTTP_400_BAD_REQUEST)

        is_ok, err = validate_custom_password(data['password'])
        if not is_ok:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(username__iexact=data['username']).exists():
            return Response({'error': 'Username already taken. Please choose another.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        from apps.authentication.models import Role, UserRole

        try:
            with transaction.atomic():
                user = CustomUser.objects.create_user(
                    username=data['username'], email=data['email'], password=data['password'],
                )
                pharmacist_role, _ = Role.objects.get_or_create(
                    name='PHARMACIST', defaults={'description': 'Branch Staff / Pharmacist'}
                )
                UserRole.objects.create(
                    user=user, role=pharmacist_role,
                    pharmacy=staff.branch.pharmacy, branch=staff.branch, is_active=True,
                )
                staff.user = user
                staff.status = 'active'
                staff.save()
                email_otp.is_verified = True
                email_otp.save()
                refresh = RefreshToken.for_user(user)
                return Response({
                    'message': 'Account activated successfully. You can now log in.',
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'username': user.username,
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': f'Activation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Owner revokes a staff member — immediately blocks all their API access."""
        from django.utils import timezone
        staff = self.get_object()
        user_pharmacy = getattr(request.user, 'pharmacy', None)
        is_super_admin = hasattr(request.user, 'user_role') and request.user.user_role.role.name == 'SUPER_ADMIN'
        if staff.branch.pharmacy != user_pharmacy and not is_super_admin:
            return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)
        if staff.user:
            staff.user.is_active = False
            staff.user.save(update_fields=['is_active'])
        staff.status = 'revoked'
        staff.revoked_at = timezone.now()
        staff.save(update_fields=['status', 'revoked_at', 'updated_at'])
        return Response({'status': 'Staff member revoked. Their access has been immediately invalidated.'})

    @action(detail=True, methods=['patch'], url_path='permissions')
    def update_permissions(self, request, pk=None):
        """Owner updates which modules a staff member can access."""
        from .serializers import PERMISSION_FIELDS
        staff = self.get_object()
        user_pharmacy = getattr(request.user, 'pharmacy', None)
        is_super_admin = hasattr(request.user, 'user_role') and request.user.user_role.role.name == 'SUPER_ADMIN'
        if staff.branch.pharmacy != user_pharmacy and not is_super_admin:
            return Response({'error': 'You do not own this branch.'}, status=status.HTTP_403_FORBIDDEN)
        updated = []
        for field in PERMISSION_FIELDS:
            if field in request.data:
                setattr(staff, field, bool(request.data[field]))
                updated.append(field)
        if updated:
            staff.save(update_fields=updated + ['updated_at'])
        serializer = BranchStaffSerializer(staff)
        return Response(serializer.data)


class BranchSettingsViewSet(viewsets.ModelViewSet):
    """Manage branch settings."""
    serializer_class = BranchSettingsSerializer
    permission_classes = [IsAuthenticated]
    queryset = BranchSettings.objects.all()
    
    @action(detail=False, methods=['get'])
    def current_branch_settings(self, request):
        branch_id = request.query_params.get('branch_id') or request.headers.get('X-Branch-ID')
        if not branch_id:
            return Response({'error': 'branch_id required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            settings_obj = BranchSettings.objects.get(branch_id=branch_id)
            serializer = self.get_serializer(settings_obj)
            return Response(serializer.data)
        except BranchSettings.DoesNotExist:
            return Response({'error': 'Settings not found'}, status=status.HTTP_404_NOT_FOUND)


class LicenseViewSet(viewsets.ModelViewSet):
    serializer_class = LicenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['pharmacy', 'is_active']
    search_fields = ['license_number']
    
    def get_queryset(self):
        return License.objects.select_related('pharmacy')
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        from django.utils import timezone
        from datetime import timedelta
        soon = timezone.now().date() + timedelta(days=30)
        licenses = License.objects.filter(expiry_date__lte=soon, expiry_date__gte=timezone.now().date(), is_active=True)
        serializer = self.get_serializer(licenses, many=True)
        return Response(serializer.data)


class TaxConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = TaxConfigurationSerializer
    permission_classes = [IsAuthenticated]
    queryset = TaxConfiguration.objects.all()


class SyncQueueViewSet(viewsets.ViewSet):
    """Manage offline data synchronization."""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def push(self, request):
        branch_id = request.data.get('branch_id')
        changes = request.data.get('changes', [])
        is_super_admin = hasattr(request.user, 'user_role') and request.user.user_role.role.name == 'SUPER_ADMIN'
        
        if not is_super_admin:
            try:
                branch = Branch.objects.get(id=branch_id)
                if hasattr(branch.pharmacy, 'subscription') and branch.pharmacy.subscription:
                    if branch.pharmacy.subscription.status != 'active':
                        return Response({'error': 'Subscription is inactive. App locked.'}, status=status.HTTP_403_FORBIDDEN)
            except Branch.DoesNotExist:
                pass

        from .models import SyncQueue
        from django.utils.dateparse import parse_datetime

        results = []
        for change in changes:
            entity_type = change.get('entity_type', '')
            client_ts = parse_datetime(change.get('client_timestamp', '')) if change.get('client_timestamp') else None
            has_conflict = False
            conflict_detail = ''

            if entity_type == 'Inventory' and change.get('action') == 'UPDATE' and client_ts:
                try:
                    from apps.inventory.models import Inventory
                    inv = Inventory.objects.get(id=change.get('entity_id'))
                    if inv.updated_at > client_ts:
                        has_conflict = True
                        conflict_detail = f"Server updated_at {inv.updated_at.isoformat()} > client_timestamp {client_ts.isoformat()}."
                except Exception:
                    pass

            SyncQueue.objects.create(
                branch_id=branch_id,
                entity_type=entity_type,
                entity_id=change.get('entity_id'),
                action=change.get('action'),
                payload=change.get('payload'),
                status='CONFLICT' if has_conflict else 'SYNCED',
                client_timestamp=client_ts,
                has_conflict=has_conflict,
                conflict_detail=conflict_detail,
            )
            results.append({'entity_id': change.get('entity_id'), 'status': 'conflict' if has_conflict else 'success', 'conflict_detail': conflict_detail})
            
        return Response({'processed': len(results), 'results': results}, status=status.HTTP_200_OK)
        
    @action(detail=False, methods=['get'])
    def pull(self, request):
        branch_id = request.query_params.get('branch_id')
        last_sync = request.query_params.get('last_sync')
        is_super_admin = hasattr(request.user, 'user_role') and request.user.user_role.role.name == 'SUPER_ADMIN'
        
        if not is_super_admin:
            try:
                branch = Branch.objects.get(id=branch_id)
                if hasattr(branch.pharmacy, 'subscription') and branch.pharmacy.subscription:
                    if branch.pharmacy.subscription.status != 'active':
                        return Response({'error': 'Subscription is inactive. Please renew.'}, status=status.HTTP_403_FORBIDDEN)
            except Branch.DoesNotExist:
                pass

        from .models import SyncQueue
        events = SyncQueue.objects.filter(branch_id=branch_id, status='PENDING')
        if last_sync:
            events = events.filter(created_at__gt=last_sync)
        data = []
        for event in events:
            data.append({'entity_type': event.entity_type, 'entity_id': event.entity_id,
                         'action': event.action, 'payload': event.payload, 'created_at': event.created_at})
            event.status = 'SYNCED'
            event.save()
        return Response({'events': data}, status=status.HTTP_200_OK)


class BranchDeviceViewSet(viewsets.ModelViewSet):
    """Manage hardware devices (legacy)."""
    serializer_class = BranchDeviceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        pharmacy = getattr(user, 'pharmacy', None)
        if pharmacy:
            return BranchDevice.objects.filter(branch__pharmacy=pharmacy)
        return BranchDevice.objects.none()
        
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        device = self.get_object()
        device.is_active = False
        device.save()
        return Response({'status': 'Device revoked.'})
