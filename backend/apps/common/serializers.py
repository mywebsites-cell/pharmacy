from rest_framework import serializers
from .models import CustomUser, AuditLog, DeviceSession


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'profile_photo']
        read_only_fields = ['id']


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'action', 'entity_type', 'entity_id', 'changes', 'ip_address', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class DeviceSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceSession
        fields = ['id', 'device_id', 'device_name', 'device_type', 'ip_address', 'last_activity', 'is_active']
        read_only_fields = ['id', 'last_activity']
