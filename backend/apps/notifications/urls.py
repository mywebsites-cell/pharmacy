from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.notifications.views import (
    NotificationTemplateViewSet, NotificationViewSet, 
    NotificationPreferenceViewSet, NotificationAuditViewSet
)

router = DefaultRouter()
router.register(r'templates', NotificationTemplateViewSet, basename='template')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'preferences', NotificationPreferenceViewSet, basename='preference')
router.register(r'audit', NotificationAuditViewSet, basename='audit')

urlpatterns = [
    path('', include(router.urls)),
]
