from rest_framework import serializers
from apps.notifications.models import (
    NotificationTemplate, Notification, NotificationPreference, NotificationAudit
)


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = '__all__'


class NotificationAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationAudit
        fields = '__all__'
