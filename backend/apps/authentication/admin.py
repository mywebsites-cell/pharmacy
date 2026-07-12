from django.contrib import admin
from .models import Role, Permission, UserRole, LoginHistory, MFAMethod, PasswordReset


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    filter_horizontal = ['permissions']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['module', 'action', 'description']
    list_filter = ['module']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'pharmacy', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'success', 'ip_address', 'device_type', 'created_at']
    list_filter = ['success', 'device_type', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(MFAMethod)
class MFAMethodAdmin(admin.ModelAdmin):
    list_display = ['user', 'method', 'is_verified', 'is_primary', 'created_at']
    list_filter = ['method', 'is_verified', 'is_primary']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PasswordReset)
class PasswordResetAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_used', 'expires_at', 'created_at']
    list_filter = ['is_used', 'created_at']
    readonly_fields = ['id', 'token', 'created_at', 'updated_at']
