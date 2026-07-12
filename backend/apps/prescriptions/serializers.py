from rest_framework import serializers
from apps.prescriptions.models import (
    DoctorProfile, PatientProfile, Prescription, 
    PrescriptionItem, PrescriptionAudit
)


class DoctorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = '__all__'


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = '__all__'


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.generic_name', read_only=True)
    
    class Meta:
        model = PrescriptionItem
        fields = '__all__'


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)
    patient_name = serializers.CharField(source='patient.first_name', read_only=True)
    
    class Meta:
        model = Prescription
        fields = '__all__'


class PrescriptionAuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    
    class Meta:
        model = PrescriptionAudit
        fields = '__all__'
