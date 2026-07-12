from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid


class TimestampedModel(models.Model):
    """Abstract base model with timestamp fields."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True
        ordering = ['-created_at']


class SoftDeleteModel(TimestampedModel):
    """Abstract base model with soft delete functionality."""

    class SoftDeleteQuerySet(models.QuerySet):
        def alive(self):
            return self.filter(is_deleted=False)

        def deleted(self):
            return self.filter(is_deleted=True)

    class SoftDeleteManager(models.Manager):
        def get_queryset(self):
            return SoftDeleteModel.SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)

    class AllObjectsManager(models.Manager):
        def get_queryset(self):
            return SoftDeleteModel.SoftDeleteQuerySet(self.model, using=self._db)

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()
    
    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=['is_deleted', 'created_at']),
        ]

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])


class CustomUser(AbstractUser):
    """Custom user model with additional fields."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    device_id = models.CharField(max_length=255, blank=True, null=True)
    last_ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_active_device = models.BooleanField(default=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name='customuser_set'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name='customuser_set'
    )
    
    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone_number']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}" if self.first_name else self.username

    @property
    def pharmacy(self):
        user_role = getattr(self, 'user_role', None)
        return getattr(user_role, 'pharmacy', None)

    @property
    def branch(self):
        user_role = getattr(self, 'user_role', None)
        return getattr(user_role, 'branch', None)

    @property
    def role(self):
        if self.is_superuser:
            return 'admin'
        try:
            rname = self.user_role.role.name
            if rname in ['SUPER_ADMIN', 'admin']:
                return 'admin'
            elif rname in ['PHARMACIST', 'staff']:
                return 'staff'
            else:
                return 'user'
        except Exception:
            return 'admin' if self.is_superuser else 'user'


class AuditLog(SoftDeleteModel):
    """Log for tracking all system changes."""
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('DOWNLOAD', 'Download'),
        ('EXPORT', 'Export'),
    ]
    
    user = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=255)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    description = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action', 'entity_type']),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.entity_type} by {self.user}"


class DeviceSession(TimestampedModel):
    """Track user device sessions."""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='device_sessions')
    device_id = models.CharField(max_length=255)
    device_name = models.CharField(max_length=255)
    device_type = models.CharField(
        max_length=50,
        choices=[('MOBILE', 'Mobile'), ('TABLET', 'Tablet'), ('DESKTOP', 'Desktop'), ('WEB', 'Web')]
    )
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    last_activity = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Device Session'
        verbose_name_plural = 'Device Sessions'
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.device_name}"
