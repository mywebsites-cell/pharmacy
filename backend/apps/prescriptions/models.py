from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel, SoftDeleteModel
from apps.pharmacy.models import Pharmacy, Branch
from apps.inventory.models import Medicine
import uuid

User = get_user_model()


class DoctorProfile(TimestampedModel):
    """Doctor registry for prescriptions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=100, unique=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=10)
    specialization = models.CharField(max_length=255)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='doctors')
    is_verified = models.BooleanField(default=False)
    verified_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'doctor_profiles'
        indexes = [
            models.Index(fields=['pharmacy', 'registration_number']),
            models.Index(fields=['email']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.registration_number}"


class PatientProfile(TimestampedModel):
    """Patient registry for prescriptions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=[('M', 'Male'), ('F', 'Female'), ('O', 'Other')])
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=10)
    allergies = models.JSONField(default=list, help_text="List of known allergies")
    chronic_conditions = models.JSONField(default=list, help_text="Pre-existing conditions")
    emergency_contact = models.CharField(max_length=255, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    insurance_provider = models.CharField(max_length=255, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    
    class Meta:
        db_table = 'patient_profiles'
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['email']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Prescription(SoftDeleteModel):
    """Digital prescription records"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('VERIFIED', 'Verified'),
        ('FILLED', 'Filled'),
        ('PARTIALLY_FILLED', 'Partially Filled'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription_number = models.CharField(max_length=100, unique=True)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='prescriptions')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.SET_NULL, null=True, related_name='prescriptions')
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='prescriptions')
    prescription_date = models.DateTimeField(default=timezone.now)
    expiry_date = models.DateTimeField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    is_controlled_drug = models.BooleanField(default=False, help_text="Schedule H or X drug requiring special handling")
    is_repeat_prescription = models.BooleanField(default=False)
    max_refills = models.IntegerField(default=0)
    refills_remaining = models.IntegerField(default=0)
    prescription_image = models.ImageField(upload_to='prescriptions/%Y/%m/%d/', null=True, blank=True)
    ocr_text = models.TextField(blank=True, help_text="OCR extracted text from prescription image")
    ocr_confidence = models.FloatField(default=0, help_text="OCR confidence score 0-1")
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_prescriptions')
    verified_at = models.DateTimeField(null=True, blank=True)
    last_filled_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'prescriptions'
        indexes = [
            models.Index(fields=['pharmacy', 'prescription_number']),
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['expiry_date']),
        ]
    
    def __str__(self):
        return f"Rx {self.prescription_number}"
    
    def mark_as_filled(self):
        self.status = 'FILLED'
        self.last_filled_date = timezone.now()
        self.refills_remaining = max(0, self.refills_remaining - 1)
        self.save()
    
    def is_expired(self):
        return timezone.now() > self.expiry_date


class PrescriptionItem(TimestampedModel):
    """Individual medicine lines on a prescription"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT)
    quantity_prescribed = models.IntegerField()
    quantity_filled = models.IntegerField(default=0)
    dosage_instructions = models.TextField(help_text="e.g., '1 tablet twice daily after meals'")
    duration_days = models.IntegerField(null=True, blank=True, help_text="Number of days for which medicine prescribed")
    special_instructions = models.TextField(blank=True, help_text="e.g., 'Do not take with milk'")
    substitution_allowed = models.BooleanField(default=False, help_text="Can pharmacist substitute with generic?")
    
    class Meta:
        db_table = 'prescription_items'
        indexes = [
            models.Index(fields=['prescription', 'medicine']),
        ]
    
    def __str__(self):
        return f"{self.prescription.prescription_number} - {self.medicine.generic_name}"


class PrescriptionAudit(TimestampedModel):
    """Audit trail for prescription changes (compliance)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=[
        ('CREATED', 'Created'),
        ('VERIFIED', 'Verified'),
        ('FILLED', 'Filled'),
        ('REFILLED', 'Refilled'),
        ('CANCELLED', 'Cancelled'),
        ('STATUS_CHANGED', 'Status Changed'),
    ])
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    change_details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        db_table = 'prescription_audit_logs'
        ordering = ['-created_at']
