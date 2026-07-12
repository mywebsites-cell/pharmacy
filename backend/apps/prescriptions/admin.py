from django.contrib import admin
from apps.prescriptions.models import (
    DoctorProfile, PatientProfile, Prescription, 
    PrescriptionItem, PrescriptionAudit
)


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'registration_number', 'specialization', 'is_verified')
    search_fields = ('name', 'registration_number', 'email')
    list_filter = ('is_verified', 'pharmacy')


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'email')
    search_fields = ('first_name', 'phone', 'email')
    list_filter = ('city', 'state')


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ('prescription_number', 'patient', 'doctor', 'status', 'expiry_date')
    search_fields = ('prescription_number', 'patient__phone')
    list_filter = ('status', 'expiry_date', 'is_controlled_drug')


@admin.register(PrescriptionItem)
class PrescriptionItemAdmin(admin.ModelAdmin):
    list_display = ('prescription', 'medicine', 'quantity_prescribed', 'quantity_filled')
    search_fields = ('prescription__prescription_number', 'medicine__generic_name')
    list_filter = ('prescription__status',)


@admin.register(PrescriptionAudit)
class PrescriptionAuditAdmin(admin.ModelAdmin):
    list_display = ('prescription', 'action', 'actor', 'created_at')
    search_fields = ('prescription__prescription_number',)
    list_filter = ('action', 'created_at')
