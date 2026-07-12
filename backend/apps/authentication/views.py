from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from datetime import timedelta
import random
import secrets
from .models import Role, Permission, UserRole, LoginHistory, MFAMethod, PasswordReset, EmailOTP
from .serializers import (
    RoleSerializer, PermissionSerializer, UserRoleSerializer,
    CustomTokenObtainPairSerializer, LoginSerializer, MFAMethodSerializer,
    PasswordResetSerializer, PasswordResetConfirmSerializer, LoginHistorySerializer
)
from apps.common.models import AuditLog
from apps.pharmacy.models import Pharmacy, Branch


def validate_custom_password(password):
    """
    Validates a password according to custom rules:
    - At least 8 characters.
    - First character must be capital.
    - Must contain at least one special character: _ or @.
    - No spaces allowed.
    Returns: (is_ok, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not password[0].isupper():
        return False, "First character of password must be capital."
    if '_' not in password and '@' not in password:
        return False, "Password must contain at least one special character: _ or @."
    if ' ' in password:
        return False, "Password must not contain spaces."
    return True, ""


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login endpoint with audit logging."""
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        # Log login attempt
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Log successful login and record last IP
            try:
                User = get_user_model()
                identifier = request.data.get('username', '')
                user = User.objects.filter(
                    Q(username__iexact=identifier) | Q(email__iexact=identifier)
                ).first()
                if not user:
                    return response
                # Record last IP address for security auditing
                client_ip = self.get_client_ip(request)
                if client_ip:
                    User.objects.filter(pk=user.pk).update(last_ip_address=client_ip)
                AuditLog.objects.create(
                    user=user,
                    action='LOGIN',
                    entity_type='AUTH',
                    entity_id=str(user.id),
                    ip_address=client_ip or '0.0.0.0',
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    description=f"User {user.username} logged in"
                )
            except Exception:
                pass  # Audit log is optional; don't block login
        
        return response
    
    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """View and manage system roles."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """View system permissions."""
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['module']


class UserRoleViewSet(viewsets.ModelViewSet):
    """Manage user roles."""
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='CREATE',
            entity_type='USER_ROLE',
            entity_id=str(user.id),
            ip_address=self.get_client_ip(self.request),
            description=f"User role created for {user.user.username}"
        )
    
    def perform_update(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='UPDATE',
            entity_type='USER_ROLE',
            entity_id=str(user.id),
            ip_address=self.get_client_ip(self.request),
            description=f"User role updated for {user.user.username}"
        )
    
    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class MFAMethodViewSet(viewsets.ModelViewSet):
    """Manage user MFA methods."""
    queryset = MFAMethod.objects.all()
    serializer_class = MFAMethodSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return MFAMethod.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def setup_totp(self, request):
        """Setup TOTP MFA."""
        import pyotp
        secret = pyotp.random_base32()
        
        mfa = MFAMethod.objects.create(
            user=request.user,
            method='TOTP',
            secret_key=secret,
            is_primary=False,
            is_verified=False
        )
        
        totp = pyotp.TOTP(secret)
        return Response({
            'secret': secret,
            'qr_code': totp.provisioning_uri(request.user.email, issuer_name='PharmacyApp'),
            'mfa_id': str(mfa.id)
        })
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify MFA method."""
        mfa = self.get_object()
        code = request.data.get('code')
        
        if mfa.method == 'TOTP':
            import pyotp
            totp = pyotp.TOTP(mfa.secret_key)
            if not totp.verify(code):
                return Response(
                    {'error': 'Invalid verification code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        mfa.is_verified = True
        mfa.save()
        
        return Response({'status': 'MFA method verified'})


class PasswordResetViewSet(viewsets.ViewSet):
    """Handle password resets using email OTP."""
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'], url_path='send-otp')
    def send_otp(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Return 200 to prevent user enumeration
            return Response({'status': 'If an account exists with this email, an OTP has been sent.'}, status=status.HTTP_200_OK)

        # Generate 6-digit numeric OTP
        otp_code = f"{random.randint(100000, 999999)}"
        expiry = timezone.now() + timedelta(minutes=10)
        
        EmailOTP.objects.filter(email=email, purpose='PASSWORD_RESET').delete()
        EmailOTP.objects.create(
            email=email,
            otp=otp_code,
            purpose='PASSWORD_RESET',
            expires_at=expiry
        )

        if getattr(settings, 'RESEND_API_KEY', None):
            import resend
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": "onboarding@resend.dev",
                "to": [email],
                "subject": "PharmacyPro Password Reset OTP",
                "html": f"<p>Your password reset verification code is: <strong>{otp_code}</strong>. It is valid for 10 minutes.</p>"
            })
        else:
            send_mail(
                subject='PharmacyPro Password Reset OTP',
                message=f'Your password reset verification code is: {otp_code}. It is valid for 10 minutes.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )

        return Response({'status': 'If an account exists with this email, an OTP has been sent.'}, status=status.HTTP_200_OK)
        
    @action(detail=False, methods=['post'], url_path='confirm-reset-otp')
    def confirm_reset_otp(self, request):
        email = request.data.get('email')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not email or not otp or not new_password or not confirm_password:
            return Response({'detail': 'Email, OTP, new password, and confirm password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify OTP
        try:
            email_otp = EmailOTP.objects.get(
                email__iexact=email,
                otp=otp,
                purpose='PASSWORD_RESET',
                expires_at__gt=timezone.now(),
                is_verified=False
            )
        except EmailOTP.DoesNotExist:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength rules
        is_ok, err_msg = validate_custom_password(new_password)
        if not is_ok:
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Reset User Password
        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
            user.set_password(new_password)
            user.save()
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_400_BAD_REQUEST)

        email_otp.is_verified = True
        email_otp.save()

        # Create password reset audit log entry
        try:
            AuditLog.objects.create(
                user=user,
                action='UPDATE',
                entity_type='AUTH',
                entity_id=str(user.id),
                ip_address=self.get_client_ip(request),
                description=f"User {user.username} reset password via Email OTP"
            )
        except Exception:
            pass

        return Response({'status': 'Password reset successfully.'}, status=status.HTTP_200_OK)
    
    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LoginHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View login history."""
    serializer_class = LoginHistorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return LoginHistory.objects.filter(user=self.request.user).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def recent_suspicious(self, request):
        """Get recent suspicious login attempts."""
        # Suspicious = failed login from new IP in last 24 hours
        failed_logins = LoginHistory.objects.filter(
            user=request.user,
            success=False,
            created_at__gte=timezone.now() - timedelta(hours=24)
        )
        serializer = self.get_serializer(failed_logins, many=True)
        return Response(serializer.data)


class RegisterViewSet(viewsets.ViewSet):
    """Handle user registration with email OTP verification and pharmacy enrollment."""
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='send-otp')
    def send_otp(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        pharmacy_name = request.data.get('pharmacy_name')

        if not username or not email or not password or not pharmacy_name:
            return Response({'detail': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength
        is_ok, err_msg = validate_custom_password(password)
        if not is_ok:
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Uniqueness checks
        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'Email already registered.'}, status=status.HTTP_400_BAD_REQUEST)
        if Pharmacy.objects.filter(name__iexact=pharmacy_name).exists():
            return Response({'detail': 'Pharmacy name already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate 6-digit numeric OTP
        otp_code = f"{random.randint(100000, 999999)}"
        expiry = timezone.now() + timedelta(minutes=10)

        EmailOTP.objects.filter(email=email, purpose='REGISTRATION').delete()
        EmailOTP.objects.create(
            email=email,
            otp=otp_code,
            purpose='REGISTRATION',
            expires_at=expiry
        )

        # Send email
        if getattr(settings, 'RESEND_API_KEY', None):
            import resend
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": "onboarding@resend.dev",
                "to": [email],
                "subject": "PharmacyPro Registration OTP",
                "html": f"<p>Your registration verification code is: <strong>{otp_code}</strong>. It is valid for 10 minutes.</p>"
            })
        else:
            send_mail(
                subject='PharmacyPro Registration OTP',
                message=f'Your registration verification code is: {otp_code}. It is valid for 10 minutes.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False
            )

        return Response({'status': 'OTP sent successfully.'}, status=status.HTTP_200_OK)

    def create(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        pharmacy_name = request.data.get('pharmacy_name')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        otp = request.data.get('otp')

        if not username or not email or not password or not pharmacy_name or not otp:
            return Response({'detail': 'All fields and OTP verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify OTP
        try:
            email_otp = EmailOTP.objects.get(
                email=email,
                otp=otp,
                purpose='REGISTRATION',
                expires_at__gt=timezone.now(),
                is_verified=False
            )
        except EmailOTP.DoesNotExist:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        # Uniqueness checks (double check)
        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'Email already registered.'}, status=status.HTTP_400_BAD_REQUEST)
        if Pharmacy.objects.filter(name__iexact=pharmacy_name).exists():
            return Response({'detail': 'Pharmacy name already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength rules
        is_ok, err_msg = validate_custom_password(password)
        if not is_ok:
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # DB transaction
        try:
            with transaction.atomic():
                # 1. Create User
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name
                )

                # 2. Create Pharmacy
                import uuid
                pharmacy = Pharmacy.objects.create(
                    name=pharmacy_name,
                    registration_number=f"REG-{uuid.uuid4().hex[:8].upper()}",
                    license_number=f"LIC-{uuid.uuid4().hex[:8].upper()}",
                    license_expiry=timezone.now().date() + timedelta(days=365),
                    owner=user,
                    email=email,
                    phone_number="N/A",
                    address_line_1="Address Line 1",
                    city="City",
                    state="State",
                    country="Country",
                    postal_code="00000",
                    is_active=True,
                    is_verified=True
                )

                # 3. Create default Branch
                branch = Branch.objects.create(
                    pharmacy=pharmacy,
                    code=f"MAIN-{uuid.uuid4().hex[:6].upper()}",
                    name='Main Branch',
                    phone_number="N/A",
                    email=email,
                    address_line_1="Address Line 1",
                    city="City",
                    state="State",
                    country="Country",
                    postal_code="00000",
                    manager=user,
                    is_active=True
                )

                # 4. Create UserRole
                owner_role, _ = Role.objects.get_or_create(
                    name='PHARMACY_OWNER',
                    defaults={'description': 'Pharmacy Owner'}
                )
                UserRole.objects.create(
                    user=user,
                    role=owner_role,
                    pharmacy=pharmacy,
                    branch=branch,
                    is_active=True
                )

                # 5. Mark OTP as verified
                email_otp.is_verified = True
                email_otp.save()

                # Generate simplejwt tokens
                refresh = RefreshToken.for_user(user)

                user_payload = {
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': 'user',
                    'pharmacy_id': str(pharmacy.id),
                    'branch_id': str(branch.id),
                    'permissions': [],
                }

                return Response({
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'user': user_payload
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'detail': f'Error occurred during registration: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangePasswordView(APIView):
    """API endpoint to change password for authenticated users."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({'detail': 'Both current and new passwords are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not user.check_password(current_password):
            return Response({'detail': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Custom Password validation strength checks
        is_ok, err_msg = validate_custom_password(new_password)
        if not is_ok:
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save()
        
        # Log successful update to AuditLog
        try:
            AuditLog.objects.create(
                user=user,
                action='UPDATE',
                entity_type='AUTH',
                entity_id=str(user.id),
                ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
                description=f"User {user.username} changed their password"
            )
        except Exception:
            pass
            
        return Response({'detail': 'Password updated successfully.'}, status=status.HTTP_200_OK)
