from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleViewSet, PaymentViewSet, RefundViewSet

router = DefaultRouter()
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'refunds', RefundViewSet, basename='refund')

urlpatterns = [
    path('', include(router.urls)),
]
