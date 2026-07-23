from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import ProtectedError
from datetime import timedelta
from .models import SubscriptionPlan, PaymentAccount, PaymentSubmission, TenantSubscription, GlobalSetting
from .serializers import (
    SubscriptionPlanSerializer, 
    PaymentAccountSerializer, 
    PaymentSubmissionSerializer,
    TenantSubscriptionSerializer
)


def _set_pharmacy_staff_active(pharmacy, active: bool):
    """
    Lock or unlock all non-owner staff for a pharmacy.
    Called when subscription is approved (active=True) or rejected/expired (active=False).
    """
    try:
        from apps.authentication.models import UserRole
        from apps.common.models import CustomUser
        # Find all staff UserRoles for this pharmacy (exclude owners and super admins)
        staff_roles = UserRole.objects.filter(
            pharmacy=pharmacy
        ).exclude(
            role__name__in=['PHARMACY_OWNER', 'SUPER_ADMIN']
        ).select_related('user')

        user_ids = [ur.user_id for ur in staff_roles if ur.user_id]
        if user_ids:
            CustomUser.objects.filter(id__in=user_ids).update(is_active=active)
            staff_roles.update(is_active=active)
    except Exception:
        pass  # Never block the subscription update itself


class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to Super Admins.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        role = getattr(request.user, 'role', '')
        return role in ['SUPER_ADMIN', 'admin']


class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    # Temporarily allow any authenticated user to view plans so pharmacies can subscribe
    # but only Super Admin can create/edit/delete.
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        # Soft-delete plans so active subscriptions/history are preserved.
        plan = self.get_object()
        plan.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PaymentAccountViewSet(viewsets.ModelViewSet):
    queryset = PaymentAccount.objects.all()
    serializer_class = PaymentAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperAdmin()]
        return super().get_permissions()


class PaymentSubmissionViewSet(viewsets.ModelViewSet):
    queryset = PaymentSubmission.objects.all()
    serializer_class = PaymentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Super admin sees all submissions
        if getattr(user, 'role', '') in ['SUPER_ADMIN', 'admin'] or user.is_superuser:
            return PaymentSubmission.objects.all()
        # Pharmacy admin sees only their own
        if hasattr(user, 'pharmacy') and user.pharmacy:
            return PaymentSubmission.objects.filter(pharmacy=user.pharmacy)
        return PaymentSubmission.objects.none()

    def perform_create(self, serializer):
        pharmacy = getattr(self.request.user, 'pharmacy', None)
        if not pharmacy:
            raise serializers.ValidationError("User is not associated with any pharmacy.")
        
        # Handle custom frontend fields
        data = self.request.data
        # Accept multiple possible frontend field names for compatibility
        plan_id = data.get('plan_id') or data.get('plan')
        amount = data.get('amount_paid') or data.get('amount')
        account_id = data.get('payment_account_id') or data.get('payment_account')
        notes = data.get('notes', '')
        
        # Parse base64
        # screenshot may be provided as 'screenshot_base64' or 'receipt_image'
        screenshot_data = data.get('screenshot_base64') or data.get('receipt_image')
        screenshot_file = None
        if screenshot_data and ';base64,' in screenshot_data:
            from django.core.files.base import ContentFile
            import base64
            format, imgstr = screenshot_data.split(';base64,') 
            ext = format.split('/')[-1] 
            screenshot_file = ContentFile(base64.b64decode(imgstr), name='screenshot.' + ext)

        # Map incoming frontend fields to actual model fields.
        # Model expects: plan (FK), amount, receipt_image (base64 text).
        serializer.save(
            pharmacy=pharmacy,
            plan_id=plan_id,
            amount=amount,
            receipt_image=(screenshot_data if screenshot_data else None),
        )

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def approve(self, request, pk=None):
        submission = self.get_object()
        if submission.status != 'pending':
            return Response({'detail': 'Submission is not pending.'}, status=status.HTTP_400_BAD_REQUEST)
        
        submission.status = 'approved'
        submission.processed_at = timezone.now()
        submission.processed_by = request.user
        submission.save()

        # Create or update Tenant Subscription
        subscription, created = TenantSubscription.objects.get_or_create(
            pharmacy=submission.pharmacy,
            defaults={
                'plan': submission.plan,
                'status': 'active',
                'starts_at': timezone.now(),
                'expires_at': timezone.now() + timedelta(days=submission.plan.duration_days)
            }
        )

        if not created:
            subscription.plan = submission.plan
            subscription.status = 'active'
            # Extend expiry if already active, or start fresh if expired
            if subscription.expires_at and subscription.expires_at > timezone.now():
                subscription.expires_at = subscription.expires_at + timedelta(days=submission.plan.duration_days)
            else:
                subscription.starts_at = timezone.now()
                subscription.expires_at = timezone.now() + timedelta(days=submission.plan.duration_days)
            subscription.save()

        # Unlock all staff for this pharmacy when subscription is activated
        _set_pharmacy_staff_active(submission.pharmacy, active=True)

        return Response({'detail': 'Submission approved and subscription activated.'})

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def reject(self, request, pk=None):
        submission = self.get_object()
        if submission.status != 'pending':
            return Response({'detail': 'Submission is not pending.'}, status=status.HTTP_400_BAD_REQUEST)
        
        submission.status = 'rejected'
        submission.processed_at = timezone.now()
        submission.processed_by = request.user
        # You could also save a rejection reason if added to the model
        submission.save()

        # If no active subscription exists, lock all staff
        active_sub = TenantSubscription.objects.filter(
            pharmacy=submission.pharmacy, status='active'
        ).first()
        if not active_sub:
            _set_pharmacy_staff_active(submission.pharmacy, active=False)

        return Response({'detail': 'Submission rejected.'})

class TenantSubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TenantSubscription.objects.all()
    serializer_class = TenantSubscriptionSerializer
    
    def get_permissions(self):
        if self.action == 'my_subscription':
            return [permissions.IsAuthenticated()]
        return [IsSuperAdmin()]

    @action(detail=False, methods=['get'])
    def my_subscription(self, request):
        pharmacy = getattr(request.user, 'pharmacy', None)
        if not pharmacy:
            return Response({'detail': 'No pharmacy associated.'}, status=status.HTTP_404_NOT_FOUND)
        sub = TenantSubscription.objects.filter(pharmacy=pharmacy).first()
        if not sub:
            # Check if pending submission exists
            submission = PaymentSubmission.objects.filter(pharmacy=pharmacy, status='pending').first()
            if submission:
                return Response({'status': 'pending', 'submission_id': submission.id})
            return Response({'detail': 'No active subscription.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TenantSubscriptionSerializer(sub).data)

from django.contrib.auth import get_user_model
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(read_only=True)
    pharmacy_id = serializers.SerializerMethodField()
    pharmacy_name = serializers.SerializerMethodField()

    def get_pharmacy_id(self, obj):
        pharmacy = getattr(obj, 'pharmacy', None)
        return str(pharmacy.id) if pharmacy else None

    def get_pharmacy_name(self, obj):
        pharmacy = getattr(obj, 'pharmacy', None)
        return pharmacy.name if pharmacy else None

    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'role', 'is_active', 'date_joined', 'pharmacy_id', 'pharmacy_name']

class UserViewSet(viewsets.ModelViewSet):
    queryset = get_user_model().objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response({'detail': 'You cannot delete your own active account.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.pharmacy.models import Pharmacy, Branch, BranchStaff, BranchDevice
        from apps.sales.models import Sale, Payment, Refund
        from apps.common.models import AuditLog
        from apps.authentication.models import UserRole, EmailOTP
        from apps.saas.models import PaymentSubmission, TenantSubscription

        import traceback
        try:
            with transaction.atomic():
                # 1. Find all pharmacies owned by this user (or linked via role)
                role_pharmacy_ids = list(
                    UserRole.objects.filter(user=user, pharmacy__isnull=False).values_list('pharmacy_id', flat=True)
                )
                owned_pharmacy_ids = list(
                    Pharmacy.all_objects.filter(owner=user).values_list('id', flat=True)
                )
                all_pharmacy_ids = list(set(list(owned_pharmacy_ids) + list(role_pharmacy_ids)))

                if all_pharmacy_ids:
                    branch_ids = list(Branch.objects.filter(pharmacy_id__in=all_pharmacy_ids).values_list('id', flat=True))

                    # 2. Delete sales (Payment + Refund cascade from Sale automatically)
                    Sale.objects.filter(branch_id__in=branch_ids).delete()

                    # 3. Delete subscription records
                    PaymentSubmission.objects.filter(pharmacy_id__in=all_pharmacy_ids).delete()
                    TenantSubscription.objects.filter(pharmacy_id__in=all_pharmacy_ids).delete()

                    # 4. Delete branch staff and devices
                    BranchStaff.objects.filter(branch_id__in=branch_ids).delete()
                    BranchDevice.objects.filter(branch_id__in=branch_ids).delete()

                    # 5. Now delete pharmacy (cascade will handle branches and rest)
                    Pharmacy.all_objects.filter(id__in=all_pharmacy_ids).delete()

                # 6. Delete any sales where this user was cashier (outside their pharmacy)
                Sale.objects.filter(cashier=user).delete()

                # 7. Clean up auth records
                UserRole.objects.filter(user=user).delete()
                EmailOTP.objects.filter(email=user.email).delete()
                AuditLog.all_objects.filter(user=user).delete()

                # 8. Hard-delete the user
                user_model = get_user_model()
                user_model.objects.filter(pk=user.pk)._raw_delete(user_model.objects.db)

        except Exception as e:
            traceback.print_exc()
            return Response(
                {'detail': f'Deletion failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        user = serializer.save()
        role_param = self.request.data.get('role')
        if role_param:
            from apps.authentication.models import Role, UserRole
            role_map = {
                'admin': 'SUPER_ADMIN',
                'staff': 'PHARMACIST',
                'user': 'PHARMACY_OWNER'
            }
            target_role_name = role_map.get(role_param, 'PHARMACY_OWNER')
            role_obj, _ = Role.objects.get_or_create(name=target_role_name)
            UserRole.objects.update_or_create(
                user=user,
                defaults={'role': role_obj, 'is_active': True}
            )
            if role_param == 'admin':
                user.is_superuser = True
                user.is_staff = True
                user.save()
            elif role_param == 'staff':
                user.is_staff = True
                user.is_superuser = False
                user.save()
            else:
                user.is_staff = False
                user.is_superuser = False
                user.save()

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def request_superuser_promotion_otp(self, request, pk=None):
        user = self.get_object()
        security_email = request.data.get('security_email')
        
        if security_email not in ['ahmadafridi979@gmail.com', 'afridiahmad979@gmail.com']:
            return Response(
                {'detail': 'Unauthorized security email. Must be ahmadafridi979@gmail.com or afridiahmad979@gmail.com'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        import random
        from django.core.mail import send_mail
        from apps.authentication.models import EmailOTP
        
        otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        EmailOTP.objects.create(
            email=security_email,
            otp=otp,
            purpose='SUPERUSER_PROMOTION',
            expires_at=timezone.now() + timedelta(minutes=15)
        )
        
        from django.conf import settings
        if getattr(settings, 'RESEND_API_KEY', None):
            import resend
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": "support@medicly.org",
                "to": [security_email],
                "subject": f'OTP for Super Admin Promotion: {user.username}',
                "text": f'You have requested to promote user {user.username} ({user.email}) to Super Admin.\n\nYour OTP verification code is: {otp}\n\nThis code will expire in 15 minutes.'
            })
        else:
            send_mail(
                subject=f'OTP for Super Admin Promotion: {user.username}',
                message=f'You have requested to promote user {user.username} ({user.email}) to Super Admin.\n\nYour OTP verification code is: {otp}\n\nThis code will expire in 15 minutes.',
                from_email=None,
                recipient_list=[security_email],
                fail_silently=False,
            )
        
        return Response({'detail': f'OTP sent successfully to {security_email}'})

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def confirm_superuser_promotion(self, request, pk=None):
        user = self.get_object()
        security_email = request.data.get('security_email')
        otp = request.data.get('otp')
        
        if not security_email or not otp:
            return Response({'detail': 'security_email and otp are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from apps.authentication.models import EmailOTP, Role, UserRole
        
        try:
            email_otp = EmailOTP.objects.get(
                email=security_email,
                otp=otp,
                purpose='SUPERUSER_PROMOTION',
                expires_at__gt=timezone.now(),
                is_verified=False
            )
        except EmailOTP.DoesNotExist:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)
            
        email_otp.is_verified = True
        email_otp.save()
        
        # Promote user
        user.is_superuser = True
        user.is_staff = True
        user.save()
        
        admin_role, _ = Role.objects.get_or_create(name='SUPER_ADMIN', defaults={'description': 'Super Admin'})
        UserRole.objects.update_or_create(
            user=user,
            defaults={'role': admin_role, 'is_active': True}
        )
        
        return Response({'detail': f'User {user.username} successfully promoted to Super Admin!'})

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def request_superuser_demotion_otp(self, request, pk=None):
        user = self.get_object()
        security_email = request.data.get('security_email')
        
        if security_email not in ['ahmadafridi979@gmail.com', 'afridiahmad979@gmail.com']:
            return Response(
                {'detail': 'Unauthorized security email. Must be ahmadafridi979@gmail.com or afridiahmad979@gmail.com'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        import random
        from django.core.mail import send_mail
        from apps.authentication.models import EmailOTP
        
        otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        EmailOTP.objects.create(
            email=security_email,
            otp=otp,
            purpose='SUPERUSER_DEMOTION',
            expires_at=timezone.now() + timedelta(minutes=15)
        )
        
        from django.conf import settings
        if getattr(settings, 'RESEND_API_KEY', None):
            import resend
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": "support@medicly.org",
                "to": [security_email],
                "subject": f'OTP for Super Admin Demotion: {user.username}',
                "text": f'You have requested to demote user {user.username} ({user.email}) from Super Admin.\n\nYour OTP verification code is: {otp}\n\nThis code will expire in 15 minutes.'
            })
        else:
            send_mail(
                subject=f'OTP for Super Admin Demotion: {user.username}',
                message=f'You have requested to demote user {user.username} ({user.email}) from Super Admin.\n\nYour OTP verification code is: {otp}\n\nThis code will expire in 15 minutes.',
                from_email=None,
                recipient_list=[security_email],
                fail_silently=False,
            )
        
        return Response({'detail': f'OTP sent successfully to {security_email}'})

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def confirm_superuser_demotion(self, request, pk=None):
        user = self.get_object()
        security_email = request.data.get('security_email')
        otp = request.data.get('otp')
        
        if not security_email or not otp:
            return Response({'detail': 'security_email and otp are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from apps.authentication.models import EmailOTP, Role, UserRole
        
        try:
            email_otp = EmailOTP.objects.get(
                email=security_email,
                otp=otp,
                purpose='SUPERUSER_DEMOTION',
                expires_at__gt=timezone.now(),
                is_verified=False
            )
        except EmailOTP.DoesNotExist:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)
            
        email_otp.is_verified = True
        email_otp.save()
        
        # Demote user
        user.is_superuser = False
        user.is_staff = False
        user.save()
        
        owner_role, _ = Role.objects.get_or_create(name='PHARMACY_OWNER', defaults={'description': 'Pharmacy Owner'})
        UserRole.objects.update_or_create(
            user=user,
            defaults={'role': owner_role, 'is_active': True}
        )
        
        return Response({'detail': f'User {user.username} successfully demoted from Super Admin!'})


from rest_framework.views import APIView


class WebAppStatusView(APIView):
    """Public endpoint — returns whether the web app is currently enabled for regular users."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        enabled = GlobalSetting.get('web_app_enabled', 'true') == 'true'
        return Response({'web_app_enabled': enabled})


class WebAppToggleView(APIView):
    """Super-Admin-only endpoint — toggles the web app enabled/disabled status."""
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        current = GlobalSetting.get('web_app_enabled', 'true')
        new_value = 'false' if current == 'true' else 'true'
        GlobalSetting.set('web_app_enabled', new_value)
        return Response({'web_app_enabled': new_value == 'true'})

