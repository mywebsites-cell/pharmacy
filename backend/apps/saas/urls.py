from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubscriptionPlanViewSet, PaymentAccountViewSet,
    PaymentSubmissionViewSet, TenantSubscriptionViewSet, UserViewSet,
    WebAppStatusView, WebAppToggleView,
)

router = DefaultRouter()
router.register(r'subscription-plans', SubscriptionPlanViewSet, basename='subscription-plan')
router.register(r'payment-accounts', PaymentAccountViewSet, basename='payment-account')
router.register(r'payment-submissions', PaymentSubmissionViewSet, basename='payment-submission')
router.register(r'tenant-subscriptions', TenantSubscriptionViewSet, basename='tenant-subscription')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('users/tenant_matrix/', UserViewSet.as_view({'get': 'tenant_matrix'}), name='user-tenant-matrix'),
    path('', include(router.urls)),
    path('settings/web-app-status/', WebAppStatusView.as_view(), name='web-app-status'),
    path('settings/web-app-toggle/', WebAppToggleView.as_view(), name='web-app-toggle'),
]
