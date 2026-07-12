from django.contrib import admin
from apps.notifications.models import (
    NotificationTemplate, Notification, NotificationPreference, NotificationAudit
)


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_type', 'channel', 'is_active')
    search_fields = ('name',)
    list_filter = ('trigger_type', 'channel', 'is_active')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient_identifier', 'channel', 'status', 'sent_at', 'delivered_at')
    search_fields = ('recipient_identifier', 'recipient_name')
    list_filter = ('status', 'channel', 'sent_at')


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'email_enabled', 'sms_enabled', 'push_enabled', 'whatsapp_enabled')
    search_fields = ('user__username',)
    list_filter = ('email_enabled', 'sms_enabled', 'push_enabled')


@admin.register(NotificationAudit)
class NotificationAuditAdmin(admin.ModelAdmin):
    list_display = ('notification', 'action', 'old_status', 'new_status', 'created_at')
    search_fields = ('notification__recipient_identifier',)
    list_filter = ('action', 'created_at')
