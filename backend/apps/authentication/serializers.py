from rest_framework import serializers
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Role, Permission, UserRole, LoginHistory, MFAMethod, PasswordReset


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.StringRelatedField(many=True, read_only=True)
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions']
        read_only_fields = ['id']


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'module', 'action', 'description']
        read_only_fields = ['id']


class UserRoleSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.get_name_display', read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role', 'role_name', 'pharmacy', 'branch', 'is_active']
        read_only_fields = ['id']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer with additional user data."""
    
    def validate(self, attrs):
        # Accept either username or email in the username field.
        identifier = attrs.get(self.username_field)
        if identifier and '@' in str(identifier):
            User = get_user_model()
            email_user = User.objects.filter(email__iexact=identifier).first()
            if email_user:
                attrs[self.username_field] = getattr(email_user, self.username_field)

        data = super().validate(attrs)
        
        # Add user info to response
        user = self.user
        data['user'] = {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_number': getattr(user, 'phone_number', None),
        }
        
        # Add role info and check subscription
        # First, check if user is superuser/admin (take absolute precedence)
        User = get_user_model()
        typed_user = User.objects.get(pk=user.pk)
        
        # Check superuser flag directly on the fetched user object
        if getattr(typed_user, 'is_superuser', False) or getattr(typed_user, 'is_staff', False):
            data['user']['role'] = 'admin'
            data['user']['is_staff'] = True
            data['user']['is_superuser'] = True
            data['user']['permissions'] = []
            data['user']['staff_permissions'] = None
            data['user']['is_staff_member'] = False
            return data
        
        try:
            user_role = UserRole.objects.get(user=typed_user, is_active=True)
            data['user']['role'] = typed_user.role
            data['user']['permissions'] = list(user_role.role.permissions.values_list('action', flat=True))
            
            if user_role.pharmacy:
                data['user']['pharmacy_id'] = str(user_role.pharmacy.id)
            if user_role.branch:
                data['user']['branch_id'] = str(user_role.branch.id)

            # --- Inject staff permissions if this is a branch staff login ---
            if user_role.role.name == 'PHARMACIST':
                try:
                    from apps.pharmacy.models import BranchStaff
                    branch_staff = BranchStaff.objects.get(user=typed_user, status='active')
                    data['user']['staff_permissions'] = {
                        'can_access_pos': branch_staff.can_access_pos,
                        'can_access_inventory': branch_staff.can_access_inventory,
                        'can_access_transaction_history': branch_staff.can_access_transaction_history,
                        'can_access_dues': branch_staff.can_access_dues,
                        'can_access_customers': branch_staff.can_access_customers,
                        'can_access_analytics': branch_staff.can_access_analytics,
                        'can_access_accounting': branch_staff.can_access_accounting,
                        'can_access_purchases': branch_staff.can_access_purchases,
                        'can_access_prescriptions': branch_staff.can_access_prescriptions,
                    }
                    data['user']['branch_name'] = branch_staff.branch.name
                    data['user']['is_staff_member'] = True
                except Exception:
                    data['user']['staff_permissions'] = None
                    data['user']['is_staff_member'] = False
            else:
                data['user']['staff_permissions'] = None
                data['user']['is_staff_member'] = False

            # --- Subscription state (do not block login) ---
            if user_role.role.name not in ['SUPER_ADMIN', 'admin']:
                from apps.saas.models import TenantSubscription
                from django.utils import timezone

                data['subscription_required'] = True

                if not user_role.pharmacy:
                    data['subscription_status'] = 'none'
                    data['subscription_message'] = 'User is not assigned to a pharmacy.'
                else:
                    try:
                        sub = TenantSubscription.objects.get(pharmacy=user_role.pharmacy)
                        is_active = sub.status == 'active' and (not sub.expires_at or sub.expires_at >= timezone.now())
                        data['subscription_status'] = sub.status if is_active else 'inactive'
                        if sub.expires_at:
                            data['subscription_expires_at'] = sub.expires_at.isoformat()
                        if not is_active:
                            data['subscription_message'] = 'Subscription is inactive or expired. Please subscribe.'
                    except TenantSubscription.DoesNotExist:
                        data['subscription_status'] = 'none'
                        data['subscription_message'] = 'No active subscription found. Please subscribe to a plan.'
                    
        except UserRole.DoesNotExist:
            # If no UserRole found but user is a superuser, they are still admin
            typed_user_obj = self.user
            is_super = getattr(typed_user_obj, 'is_superuser', False)
            data['user']['role'] = 'admin' if is_super else 'user'
            data['user']['permissions'] = []
            data['user']['staff_permissions'] = None
            data['user']['is_staff_member'] = False
        return data


class LoginSerializer(serializers.Serializer):
    """Login serializer for custom authentication."""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    device_id = serializers.CharField(required=False)
    device_name = serializers.CharField(required=False)
    device_type = serializers.CharField(required=False)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        # Accept either username or email in the username field.
        resolved_username = username
        if username and '@' in str(username):
            User = get_user_model()
            email_user = User.objects.filter(email__iexact=username).first()
            if email_user:
                resolved_username = email_user.username
        
        user = authenticate(username=resolved_username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        
        attrs['user'] = user
        return attrs


class MFAMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = MFAMethod
        fields = ['id', 'method', 'is_primary', 'is_verified', 'last_used']
        read_only_fields = ['id', 'is_verified', 'last_used']


class PasswordResetSerializer(serializers.Serializer):
    """Request password reset."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm password reset with new password."""
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=12)
    confirm_password = serializers.CharField(write_only=True, min_length=12)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = ['id', 'user', 'ip_address', 'device_type', 'success', 'failure_reason', 'location', 'created_at']
        read_only_fields = ['id', 'created_at']
