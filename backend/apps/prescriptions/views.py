from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from apps.prescriptions.models import (
    DoctorProfile, PatientProfile, Prescription, 
    PrescriptionItem, PrescriptionAudit
)
from apps.prescriptions.serializers import (
    DoctorProfileSerializer, PatientProfileSerializer, 
    PrescriptionSerializer, PrescriptionItemSerializer, PrescriptionAuditSerializer
)


class DoctorProfileViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DoctorProfile.objects.filter(pharmacy=self.request.user.pharmacy)


class PatientProfileViewSet(viewsets.ModelViewSet):
    serializer_class = PatientProfileSerializer
    permission_classes = [IsAuthenticated]


class PrescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Prescription.objects.filter(
            pharmacy=self.request.user.pharmacy,
            is_deleted=False
        )
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        prescription = self.get_object()
        prescription.status = 'VERIFIED'
        prescription.verified_by = request.user
        prescription.verified_at = timezone.now()
        prescription.save()
        
        PrescriptionAudit.objects.create(
            prescription=prescription,
            action='VERIFIED',
            actor=request.user,
            ip_address=self.get_client_ip(request)
        )
        
        return Response({'status': 'Prescription verified'})
    
    @action(detail=True, methods=['post'])
    def mark_as_filled(self, request, pk=None):
        prescription = self.get_object()
        prescription.mark_as_filled()
        
        PrescriptionAudit.objects.create(
            prescription=prescription,
            action='FILLED',
            actor=request.user,
            ip_address=self.get_client_ip(request)
        )
        
        return Response({'status': 'Prescription marked as filled'})
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get prescriptions expiring in next 7 days"""
        today = timezone.now()
        upcoming = Prescription.objects.filter(
            pharmacy=request.user.pharmacy,
            status='VERIFIED',
            expiry_date__lte=today + timezone.timedelta(days=7),
            expiry_date__gt=today
        )
        serializer = self.get_serializer(upcoming, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search prescriptions by patient name or phone"""
        query = request.query_params.get('q', '')
        prescriptions = Prescription.objects.filter(
            pharmacy=request.user.pharmacy,
            is_deleted=False
        ).filter(
            Q(patient__first_name__icontains=query) |
            Q(patient__phone__icontains=query)
        )
        serializer = self.get_serializer(prescriptions, many=True)
        return Response(serializer.data)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class PrescriptionItemViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return PrescriptionItem.objects.filter(
            prescription__pharmacy=self.request.user.pharmacy
        )


class PrescriptionAuditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PrescriptionAuditSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return PrescriptionAudit.objects.filter(
            prescription__pharmacy=self.request.user.pharmacy
        )
