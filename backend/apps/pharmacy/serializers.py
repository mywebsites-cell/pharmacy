from rest_framework import serializers
from .models import Pharmacy, Branch, BranchSettings, License, TaxConfiguration, BranchDevice, BranchStaff


class PharmacySerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = [
            'id', 'name', 'registration_number', 'license_number', 'license_expiry',
            'owner', 'phone_number', 'email', 'website', 'address_line_1', 'address_line_2',
            'city', 'state', 'country', 'postal_code', 'timezone', 'currency', 'tax_rate',
            'logo', 'is_active', 'is_verified', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BranchSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchSettings
        fields = [
            'id', 'branch', 'low_stock_value', 'minimum_sale_amount',
            'maximum_discount_percentage', 'bill_footer_text', 'bill_header_text',
            'enable_credit_billing', 'enable_wallet_billing', 'low_stock_alert_enabled',
            'expiry_alert_enabled', 'alert_days_before_expiry', 'sms_report_enabled',
            'daily_report_time', 'enable_offline_mode', 'offline_sync_interval',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BranchSerializer(serializers.ModelSerializer):
    settings = BranchSettingsSerializer(read_only=True)
    staff_count = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = [
            'id', 'pharmacy', 'name', 'code', 'manager', 'branch_type',
            'phone_number', 'email',
            'address_line_1', 'address_line_2', 'city', 'state', 'country', 'postal_code',
            'latitude', 'longitude', 'opening_time', 'closing_time', 'is_active',
            'settings', 'staff_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_staff_count(self, obj):
        return obj.staff_members.filter(status='active').count()


class BranchCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = Branch
        fields = [
            'id', 'pharmacy', 'name', 'code', 'phone_number', 'email',
            'address_line_1', 'address_line_2', 'city', 'state', 'country', 'postal_code',
            'branch_type', 'username', 'password'
        ]
        extra_kwargs = {
            'phone_number': {'required': False, 'default': ''},
            'email': {'required': False, 'default': ''},
            'address_line_1': {'required': False, 'default': ''},
            'city': {'required': False, 'default': ''},
            'state': {'required': False, 'default': ''},
            'country': {'required': False, 'default': ''},
            'postal_code': {'required': False, 'default': ''},
        }
        

class LicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = License
        fields = [
            'id', 'pharmacy', 'license_type', 'license_number', 'issued_date',
            'expiry_date', 'issuing_authority', 'document', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TaxConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxConfiguration
        fields = [
            'id', 'pharmacy', 'tax_id', 'tax_registration_date', 'tax_rate',
            'is_registered', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BranchDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchDevice
        fields = [
            'id', 'branch', 'device_identifier', 'device_name', 'auth_token', 'is_active', 'last_sync_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'auth_token', 'last_sync_at', 'created_at', 'updated_at']


PERMISSION_FIELDS = [
    'can_access_pos', 'can_access_inventory', 'can_access_transaction_history',
    'can_access_dues', 'can_access_customers', 'can_access_analytics',
    'can_access_accounting', 'can_access_purchases', 'can_access_prescriptions',
]


class BranchStaffSerializer(serializers.ModelSerializer):
    """Read/update serializer for a branch staff member."""
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_last_login = serializers.DateTimeField(source='user.last_login', read_only=True)

    class Meta:
        model = BranchStaff
        fields = [
            'id', 'branch', 'invited_email', 'invited_name', 'status',
            'revoked_at', 'user_username', 'user_last_login',
        ] + PERMISSION_FIELDS + ['created_at', 'updated_at']
        read_only_fields = ['id', 'branch', 'invited_email', 'invited_name', 'status', 'revoked_at',
                            'user_username', 'user_last_login', 'created_at', 'updated_at']


class BranchStaffInviteSerializer(serializers.Serializer):
    """Payload for inviting a new staff member."""
    branch_id = serializers.UUIDField()
    invited_name = serializers.CharField(max_length=255)
    invited_email = serializers.EmailField()


class BranchStaffAcceptSerializer(serializers.Serializer):
    """Payload for a staff member accepting their invite (DEPRECATED — kept for backwards compat)."""
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs


class BranchStaffOwnerActivateSerializer(serializers.Serializer):
    """Payload for the Owner to verify the OTP and create staff credentials."""
    staff_id = serializers.UUIDField()
    otp = serializers.CharField(max_length=6)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

