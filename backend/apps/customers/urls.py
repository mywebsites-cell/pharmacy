from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.customers.views import (
    CustomerViewSet, CustomerAddressViewSet, LoyaltyProgramViewSet,
    LoyaltyTransactionViewSet, CustomerPrescriptionHistoryViewSet
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'addresses', CustomerAddressViewSet, basename='address')
router.register(r'loyalty-programs', LoyaltyProgramViewSet, basename='loyalty-program')
router.register(r'loyalty-transactions', LoyaltyTransactionViewSet, basename='loyalty-transaction')
router.register(r'prescription-history', CustomerPrescriptionHistoryViewSet, basename='prescription-history')

urlpatterns = [
    path('', include(router.urls)),
]
