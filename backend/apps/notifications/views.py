from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count
from apps.notifications.models import (
    NotificationTemplate, Notification, NotificationPreference, NotificationAudit
)
from apps.notifications.serializers import (
    NotificationTemplateSerializer, NotificationSerializer, 
    NotificationPreferenceSerializer, NotificationAuditSerializer
)


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return NotificationTemplate.objects.filter(
            pharmacy=self.request.user.pharmacy,
            is_active=True
        )


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.read_at = timezone.now()
        notification.save()
        return Response({'status': 'Marked as read'})
    
    @action(detail=False, methods=['post'])
    def send_notification(self, request):
        """Manually send notification"""
        template_id = request.data.get('template_id')
        recipients = request.data.get('recipients', [])
        
        try:
            template = NotificationTemplate.objects.get(id=template_id)
        except NotificationTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
        
        created = []
        for recipient in recipients:
            notification = Notification.objects.create(
                pharmacy=request.user.pharmacy,
                template=template,
                recipient_type=recipient.get('type'),
                recipient_identifier=recipient.get('identifier'),
                recipient_name=recipient.get('name'),
                channel=template.channel,
                subject=template.subject,
                message=template.template_text
            )
            created.append(notification)
        
        return Response({
            'count': len(created),
            'notifications': NotificationSerializer(created, many=True).data
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get notification statistics"""
        notifications = Notification.objects.filter(
            pharmacy=request.user.pharmacy
        )
        
        return Response({
            'total': notifications.count(),
            'sent': notifications.filter(status='SENT').count(),
            'failed': notifications.filter(status='FAILED').count(),
            'by_channel': dict(
                notifications.values('channel').annotate(count=Count('id')).values_list('channel', 'count')
            )
        })


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return NotificationPreference.objects.filter(
            pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=False, methods=['get'])
    def my_preferences(self, request):
        """Get current user's notification preferences"""
        prefs, _ = NotificationPreference.objects.get_or_create(
            user=request.user,
            pharmacy=request.user.pharmacy
        )
        return Response(NotificationPreferenceSerializer(prefs).data)
    
    @action(detail=False, methods=['post'])
    def update_my_preferences(self, request):
        """Update current user's notification preferences"""
        prefs, _ = NotificationPreference.objects.get_or_create(
            user=request.user,
            pharmacy=request.user.pharmacy
        )
        
        serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationAuditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationAuditSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return NotificationAudit.objects.filter(
            notification__pharmacy=self.request.user.pharmacy
        ).order_by('-created_at')
