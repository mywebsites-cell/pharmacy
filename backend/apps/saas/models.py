from django.db import models
from apps.common.models import TimestampedModel, SoftDeleteModel
from django.utils import timezone
from datetime import timedelta

class SubscriptionPlan(SoftDeleteModel):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=50, default='blue')
    is_popular = models.BooleanField(default=False)
    features_config = models.JSONField(default=dict)
    max_branches = models.IntegerField(default=1)
    max_devices_per_branch = models.IntegerField(default=1)

    class Meta:
        verbose_name = 'Subscription Plan'
        verbose_name_plural = 'Subscription Plans'

    def __str__(self):
        return f"{self.name} - ${self.price}"


class PaymentAccount(SoftDeleteModel):
    account_title = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=100)
    iban = models.CharField(max_length=100, blank=True)
    instructions = models.TextField(blank=True)
    qr_code = models.TextField(blank=True, null=True) # Base64 or URL

    class Meta:
        verbose_name = 'Payment Account'
        verbose_name_plural = 'Payment Accounts'

    def __str__(self):
        return f"{self.bank_name} - {self.account_title}"


class TenantSubscription(TimestampedModel):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('pending', 'Pending'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled')
    ]
    
    pharmacy = models.OneToOneField('pharmacy.Pharmacy', on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Tenant Subscription'
        verbose_name_plural = 'Tenant Subscriptions'

    def __str__(self):
        return f"{self.pharmacy.name} - {self.status}"


class PaymentSubmission(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ]
    
    pharmacy = models.ForeignKey('pharmacy.Pharmacy', on_delete=models.CASCADE, related_name='payment_submissions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    receipt_image = models.TextField(blank=True, null=True) # Base64 for simplicity in prototype
    reference_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'Payment Submission'
        verbose_name_plural = 'Payment Subscriptions'

    def __str__(self):
        return f"Payment from {self.pharmacy.name} - {self.status}"


class GlobalSetting(models.Model):
    """Singleton-style key/value store for system-wide platform settings."""
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(default='')

    @classmethod
    def get(cls, key, default=''):
        obj, _ = cls.objects.get_or_create(key=key, defaults={'value': str(default)})
        return obj.value

    @classmethod
    def set(cls, key, value):
        cls.objects.update_or_create(key=key, defaults={'value': str(value)})

    class Meta:
        verbose_name = 'Global Setting'
        verbose_name_plural = 'Global Settings'

    def __str__(self):
        return f"{self.key}: {self.value}"
