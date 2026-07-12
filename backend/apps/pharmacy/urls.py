from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PharmacyViewSet, BranchViewSet, BranchSettingsViewSet,
    LicenseViewSet, TaxConfigurationViewSet, BranchStaffViewSet, BranchDeviceViewSet
)

router = DefaultRouter()
router.register(r'pharmacies', PharmacyViewSet, basename='pharmacy')
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'branch-settings', BranchSettingsViewSet, basename='branch-settings')
router.register(r'licenses', LicenseViewSet, basename='license')
router.register(r'tax-config', TaxConfigurationViewSet, basename='tax-config')
router.register(r'branch-staff', BranchStaffViewSet, basename='branch-staff')
router.register(r'branch-devices', BranchDeviceViewSet, basename='branch-device')

urlpatterns = [
    path('', include(router.urls)),
]
