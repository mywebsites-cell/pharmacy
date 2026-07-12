from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel
from apps.pharmacy.models import Pharmacy
import uuid

User = get_user_model()


class NotificationTemplate(TimestampedModel):
    """Notification message templates"""
    CHANNEL_CHOICES = [
        ('EMAIL', 'Email'),
        ('SMS', 'SMS'),
        ('PUSH', 'Push Notification'),
        ('WHATSAPP', 'WhatsApp'),
        ('IN_APP', 'In-App'),
    ]
    
    TRIGGER_CHOICES = [
        ('LOW_STOCK', 'Low Stock Alert'),
        ('EXPIRY_ALERT', 'Expiry Alert'),
        ('REFILL_DUE', 'Refill Due'),
        ('ORDER_CONFIRMATION', 'Order Confirmation'),
        ('DELIVERY_UPDATE', 'Delivery Update'),
        ('PAYMENT_REMINDER', 'Payment Reminder'),
        ('LOYALTY_POINTS', 'Loyalty Points Update'),
        ('PROMOTION', 'Promotion'),
        ('CUSTOM', 'Custom Message'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='notification_templates')
    name = models.CharField(max_length=255)
    trigger_type = models.CharField(max_length=50, choices=TRIGGER_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    subject = models.CharField(max_length=255, blank=True, help_text="For email")
    template_text = models.TextField(help_text="Use {{variable}} for placeholders")
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'notification_templates'
        unique_together = ['pharmacy', 'trigger_type', 'channel']
    
    def __str__(self):
        return f"{self.name} - {self.channel}"


class Notification(TimestampedModel):
    """Sent notifications"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('QUEUED', 'Queued'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
        ('DELIVERED', 'Delivered'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='notifications')
    template = models.ForeignKey(NotificationTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_type = models.CharField(max_length=50, choices=[
        ('CUSTOMER', 'Customer'),
        ('STAFF', 'Staff'),
        ('ADMIN', 'Admin'),
    ])
    recipient_identifier = models.CharField(max_length=255, help_text="Phone, email, or user ID")
    recipient_name = models.CharField(max_length=255, blank=True)
    channel = models.CharField(max_length=20, choices=NotificationTemplate.CHANNEL_CHOICES)
    subject = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    provider_response = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'notifications'
        indexes = [
            models.Index(fields=['pharmacy', 'status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.channel} to {self.recipient_identifier}"


class NotificationPreference(TimestampedModel):
    """Customer/User notification preferences"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    whatsapp_enabled = models.BooleanField(default=False)
    low_stock_alerts = models.BooleanField(default=True)
    expiry_alerts = models.BooleanField(default=True)
    refill_reminders = models.BooleanField(default=True)
    order_updates = models.BooleanField(default=True)
    delivery_updates = models.BooleanField(default=True)
    promotional_offers = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'notification_preferences'
    
    def __str__(self):
        return f"Preferences - {self.user.username}"


class NotificationAudit(TimestampedModel):
    """Audit trail for notification system"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    details = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'notification_audit_logs'
        ordering = ['-created_at']
