from django.contrib import admin
from .models import CustomUser, AuditLog, DeviceSession


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'phone_number', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['username', 'email', 'phone_number']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'entity_type', 'ip_address', 'created_at']
    list_filter = ['action', 'entity_type', 'created_at']
    search_fields = ['user__username', 'entity_id', 'ip_address']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(DeviceSession)
class DeviceSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'device_name', 'device_type', 'is_active', 'last_activity']
    list_filter = ['device_type', 'is_active', 'last_activity']
    search_fields = ['user__username', 'device_id', 'ip_address']
    readonly_fields = ['id', 'created_at', 'updated_at']
