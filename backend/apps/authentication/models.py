from django.db import models
from apps.common.models import TimestampedModel
import uuid


class Role(TimestampedModel):
    """System roles for RBAC."""
    ROLE_TYPES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('PHARMACY_OWNER', 'Pharmacy Owner'),
        ('PHARMACIST', 'Pharmacist'),
        ('CASHIER', 'Cashier'),
        ('INVENTORY_MANAGER', 'Inventory Manager'),
        ('DELIVERY_RIDER', 'Delivery Rider'),
        ('ACCOUNTANT', 'Accountant'),
    ]
    
    name = models.CharField(max_length=50, choices=ROLE_TYPES, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField('Permission', related_name='roles')
    
    class Meta:
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
    
    def __str__(self):
        return self.get_name_display()


class Permission(TimestampedModel):
    """System permissions for RBAC."""
    MODULE_CHOICES = [
        ('AUTH', 'Authentication'),
        ('PHARMACY', 'Pharmacy Management'),
        ('INVENTORY', 'Inventory'),
        ('SALES', 'Sales'),
        ('PURCHASES', 'Purchases'),
        ('PRESCRIPTIONS', 'Prescriptions'),
        ('CUSTOMERS', 'Customers'),
        ('ACCOUNTING', 'Accounting'),
        ('DELIVERY', 'Delivery'),
        ('ANALYTICS', 'Analytics'),
        ('REPORTS', 'Reports'),
    ]
    
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    action = models.CharField(max_length=50)  # view, create, edit, delete, export
    description = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
        unique_together = ['module', 'action']
    
    def __str__(self):
        return f"{self.get_module_display()} - {self.action}"


class UserRole(TimestampedModel):
    """Assign roles to users per pharmacy/branch."""
    user = models.OneToOneField('common.CustomUser', on_delete=models.CASCADE, related_name='user_role')
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    pharmacy = models.ForeignKey('pharmacy.Pharmacy', on_delete=models.CASCADE, null=True, blank=True)
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
    
    def __str__(self):
        return f"{self.user} - {self.role}"


class LoginHistory(TimestampedModel):
    """Track user login attempts."""
    user = models.ForeignKey('common.CustomUser', on_delete=models.CASCADE, related_name='login_history')
    ip_address = models.GenericIPAddressField()
    device_type = models.CharField(max_length=50)
    user_agent = models.TextField()
    success = models.BooleanField(default=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    
    class Meta:
        verbose_name = 'Login History'
        verbose_name_plural = 'Login Histories'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['success', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.created_at}"


class MFAMethod(TimestampedModel):
    """Multi-factor authentication methods."""
    METHOD_CHOICES = [
        ('SMS', 'SMS'),
        ('EMAIL', 'Email'),
        ('TOTP', 'TOTP'),
        ('AUTHENTICATOR', 'Authenticator App'),
    ]
    
    user = models.ForeignKey('common.CustomUser', on_delete=models.CASCADE, related_name='mfa_methods')
    method = models.CharField(max_length=50, choices=METHOD_CHOICES)
    is_primary = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    verification_code = models.CharField(max_length=10, blank=True)
    secret_key = models.CharField(max_length=32, blank=True)  # For TOTP
    backup_codes = models.JSONField(default=list)
    last_used = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'MFA Method'
        verbose_name_plural = 'MFA Methods'
    
    def __str__(self):
        return f"{self.user} - {self.get_method_display()}"


class PasswordReset(TimestampedModel):
    """Password reset tokens."""
    user = models.ForeignKey('common.CustomUser', on_delete=models.CASCADE, related_name='password_resets')
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField()
    
    class Meta:
        verbose_name = 'Password Reset'
        verbose_name_plural = 'Password Resets'
    
    def __str__(self):
        return f"{self.user} - {self.created_at}"


class EmailOTP(TimestampedModel):
    """OTP verification codes for registration and password resets."""
    PURPOSE_CHOICES = [
        ('REGISTRATION', 'Registration'),
        ('PASSWORD_RESET', 'Password Reset'),
        ('SUPERUSER_PROMOTION', 'Superuser Promotion'),
        ('SUPERUSER_DEMOTION', 'Superuser Demotion'),
        ('STAFF_INVITATION', 'Staff Invitation'),
    ]
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Email OTP'
        verbose_name_plural = 'Email OTPs'
        indexes = [
            models.Index(fields=['email', 'otp', 'purpose']),
        ]

    def __str__(self):
        return f"{self.email} - {self.otp} ({self.purpose})"
