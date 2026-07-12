from django.db import models
from apps.common.models import TimestampedModel, SoftDeleteModel
import uuid


class Pharmacy(SoftDeleteModel):
    """Main pharmacy entity with multi-branch support."""
    name = models.CharField(max_length=255, unique=True)
    registration_number = models.CharField(max_length=100, unique=True)
    license_number = models.CharField(max_length=100, unique=True)
    license_expiry = models.DateField()
    owner = models.ForeignKey('common.CustomUser', on_delete=models.PROTECT, related_name='pharmacies')
    
    # Contact Information
    phone_number = models.CharField(max_length=20)
    email = models.EmailField()
    website = models.URLField(blank=True)
    
    # Address
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    
    # Settings
    timezone = models.CharField(max_length=100, default='UTC')
    currency = models.CharField(max_length=10, default='USD')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Configuration
    logo = models.ImageField(upload_to='pharmacy_logos/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Pharmacy'
        verbose_name_plural = 'Pharmacies'
        indexes = [
            models.Index(fields=['registration_number']),
            models.Index(fields=['license_number']),
        ]
    
    def __str__(self):
        return self.name


class Branch(SoftDeleteModel):
    """Individual branches of a pharmacy chain."""
    BRANCH_TYPE_CHOICES = [
        ('main', 'Main Branch'),
        ('satellite', 'Satellite'),
        ('warehouse', 'Warehouse'),
    ]

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    manager = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    branch_type = models.CharField(max_length=20, choices=BRANCH_TYPE_CHOICES, default='satellite')

    # Contact
    phone_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # Address (all optional so simplified create form works)
    address_line_1 = models.CharField(max_length=255, blank=True)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # Operations
    opening_time = models.TimeField(default='08:00:00')
    closing_time = models.TimeField(default='22:00:00')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Branch'
        verbose_name_plural = 'Branches'
        unique_together = ['pharmacy', 'code']
        indexes = [
            models.Index(fields=['pharmacy', 'is_active']),
        ]

    def __str__(self):
        return f"{self.pharmacy.name} - {self.name}"


class BranchSettings(TimestampedModel):
    """Branch-specific configuration."""
    branch = models.OneToOneField(Branch, on_delete=models.CASCADE, related_name='settings')
    
    # Financial
    low_stock_value = models.DecimalField(max_digits=10, decimal_places=2, default=1000)
    minimum_sale_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    maximum_discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    
    # Billing
    bill_footer_text = models.TextField(blank=True)
    bill_header_text = models.TextField(blank=True)
    enable_credit_billing = models.BooleanField(default=True)
    enable_wallet_billing = models.BooleanField(default=True)
    
    # Notifications
    low_stock_alert_enabled = models.BooleanField(default=True)
    expiry_alert_enabled = models.BooleanField(default=True)
    alert_days_before_expiry = models.IntegerField(default=30)
    
    # Reporting
    sms_report_enabled = models.BooleanField(default=True)
    daily_report_time = models.TimeField(default='21:00:00')
    
    # Offline
    enable_offline_mode = models.BooleanField(default=True)
    offline_sync_interval = models.IntegerField(default=5)  # minutes
    
    class Meta:
        verbose_name = 'Branch Settings'
        verbose_name_plural = 'Branch Settings'
    
    def __str__(self):
        return f"Settings for {self.branch.name}"


class License(TimestampedModel):
    """Pharmacy license management."""
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='licenses')
    license_type = models.CharField(max_length=100)
    license_number = models.CharField(max_length=100)
    issued_date = models.DateField()
    expiry_date = models.DateField()
    issuing_authority = models.CharField(max_length=255)
    document = models.FileField(upload_to='licenses/')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'License'
        verbose_name_plural = 'Licenses'
    
    def __str__(self):
        return f"{self.license_type} - {self.license_number}"


class TaxConfiguration(TimestampedModel):
    """Tax settings per pharmacy."""
    pharmacy = models.OneToOneField(Pharmacy, on_delete=models.CASCADE, related_name='tax_config')
    tax_id = models.CharField(max_length=50)
    tax_registration_date = models.DateField()
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    is_registered = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Tax Configuration'
        verbose_name_plural = 'Tax Configurations'
    
    def __str__(self):
        return f"Tax Config - {self.pharmacy.name}"


class BranchDevice(TimestampedModel):
    """Devices registered to a specific branch for offline operations."""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='devices')
    device_identifier = models.CharField(max_length=255, unique=True, help_text="Hardware MAC address or UUID")
    device_name = models.CharField(max_length=255)
    auth_token = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Branch Device'
        verbose_name_plural = 'Branch Devices'
        indexes = [
            models.Index(fields=['auth_token']),
            models.Index(fields=['branch', 'is_active']),
        ]

    def __str__(self):
        return f"{self.device_name} ({self.branch.name})"


class BranchStaff(TimestampedModel):
    """Staff members registered to a branch — these act as 'devices' for access control.

    Lifecycle:
      pending  → OTP sent to staff email, not yet accepted
      active   → Staff accepted the invite and set their password
      revoked  → Owner deactivated them; user.is_active=False blocks all API access
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Invitation'),
        ('active', 'Active'),
        ('revoked', 'Revoked'),
    ]

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='staff_members')
    user = models.OneToOneField(
        'common.CustomUser', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='branch_staff_profile'
    )
    invited_email = models.EmailField()
    invited_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    revoked_at = models.DateTimeField(null=True, blank=True)

    # Granular module permissions controlled by the owner
    can_access_pos = models.BooleanField(default=True)
    can_access_inventory = models.BooleanField(default=False)
    can_access_transaction_history = models.BooleanField(default=False)
    can_access_dues = models.BooleanField(default=False)
    can_access_customers = models.BooleanField(default=False)
    can_access_analytics = models.BooleanField(default=False)
    can_access_accounting = models.BooleanField(default=False)
    can_access_purchases = models.BooleanField(default=False)
    can_access_prescriptions = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Branch Staff'
        verbose_name_plural = 'Branch Staff'
        indexes = [
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['invited_email']),
        ]

    def __str__(self):
        return f"{self.invited_name} @ {self.branch.name} [{self.status}]"


class SyncQueue(TimestampedModel):
    """Transactional outbox queue for offline-first replication."""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SYNCED', 'Synced'),
        ('FAILED', 'Failed'),
        ('CONFLICT', 'Conflict'),
    ]

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='sync_events')
    entity_type = models.CharField(max_length=50, help_text="e.g., Customer, Sale, Inventory")
    entity_id = models.CharField(max_length=255)
    action = models.CharField(max_length=10, choices=[('CREATE', 'Create'), ('UPDATE', 'Update'), ('DELETE', 'Delete')])
    payload = models.JSONField(help_text="The serialized data")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    client_timestamp = models.DateTimeField(null=True, blank=True, help_text="Timestamp when the client recorded this change")
    has_conflict = models.BooleanField(default=False, help_text="True if server data was newer than client_timestamp")
    conflict_detail = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Sync Queue Event'
        verbose_name_plural = 'Sync Queue Events'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['branch', 'status', 'created_at']),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type} ({self.entity_id}) - {self.status}"
