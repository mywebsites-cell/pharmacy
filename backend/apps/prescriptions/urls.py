from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.prescriptions.views import (
    DoctorProfileViewSet, PatientProfileViewSet, 
    PrescriptionViewSet, PrescriptionItemViewSet, PrescriptionAuditViewSet
)

router = DefaultRouter()
router.register(r'doctors', DoctorProfileViewSet, basename='doctor')
router.register(r'patients', PatientProfileViewSet, basename='patient')
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'prescription-items', PrescriptionItemViewSet, basename='prescription-item')
router.register(r'prescription-audit', PrescriptionAuditViewSet, basename='prescription-audit')

urlpatterns = [
    path('', include(router.urls)),
]
