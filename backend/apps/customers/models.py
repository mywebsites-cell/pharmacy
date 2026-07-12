from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel, SoftDeleteModel
from apps.pharmacy.models import Pharmacy, Branch
import uuid

User = get_user_model()


class Customer(SoftDeleteModel):
    """Customer/patient profile for sales and loyalty"""
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other'), ('P', 'Prefer not to say')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='customers')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=10, blank=True)
    allergies = models.JSONField(default=list)
    chronic_conditions = models.JSONField(default=list)
    emergency_contact = models.CharField(max_length=255, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    insurance_provider = models.CharField(max_length=255, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_validity_date = models.DateField(null=True, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    loyalty_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Loyalty points or cash balance")
    sms_consent = models.BooleanField(default=True)
    email_consent = models.BooleanField(default=True)
    whatsapp_consent = models.BooleanField(default=False)
    push_notification_consent = models.BooleanField(default=False)
    is_vip = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'customers'
        indexes = [
            models.Index(fields=['pharmacy', 'phone']),
            models.Index(fields=['email']),
            models.Index(fields=['is_vip', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(credit_limit__gte=0), name='customer_credit_limit_non_negative'),
            models.CheckConstraint(check=models.Q(outstanding_balance__gte=0), name='customer_outstanding_non_negative'),
            models.CheckConstraint(check=models.Q(loyalty_balance__gte=0), name='customer_loyalty_non_negative'),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class CustomerAddress(TimestampedModel):
    """Multiple delivery addresses per customer"""
    TYPES = [('HOME', 'Home'), ('WORK', 'Work'), ('OTHER', 'Other')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    address_type = models.CharField(max_length=20, choices=TYPES, default='HOME')
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=10)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'customer_addresses'
    
    def __str__(self):
        return f"{self.customer} - {self.address_type}"


class LoyaltyProgram(TimestampedModel):
    """Loyalty program configuration per branch"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.OneToOneField(Pharmacy, on_delete=models.CASCADE, related_name='loyalty_program')
    points_per_rupee = models.FloatField(default=1.0, help_text="How many points earned per rupee spent")
    redemption_rate = models.FloatField(default=1.0, help_text="How many rupees worth of discount per point redeemed")
    tier_bronze_min = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tier_silver_min = models.DecimalField(max_digits=12, decimal_places=2, default=5000)
    tier_gold_min = models.DecimalField(max_digits=12, decimal_places=2, default=25000)
    tier_platinum_min = models.DecimalField(max_digits=12, decimal_places=2, default=100000)
    tier_bronze_discount = models.FloatField(default=0, help_text="Extra discount % for tier")
    tier_silver_discount = models.FloatField(default=2)
    tier_gold_discount = models.FloatField(default=5)
    tier_platinum_discount = models.FloatField(default=10)
    points_expiry_days = models.IntegerField(default=365)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'loyalty_programs'
    
    def __str__(self):
        return f"Loyalty - {self.pharmacy.name}"


class LoyaltyTransaction(TimestampedModel):
    """Transaction history for loyalty points"""
    TRANSACTION_TYPE = [
        ('EARNED', 'Points Earned'),
        ('REDEEMED', 'Points Redeemed'),
        ('EXPIRED', 'Points Expired'),
        ('ADJUSTED', 'Manual Adjustment'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='loyalty_transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE)
    points_amount = models.DecimalField(max_digits=12, decimal_places=2)
    sale_id = models.CharField(max_length=100, blank=True, null=True, help_text="Link to sale transaction")
    description = models.TextField()
    expiry_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'loyalty_transactions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.customer} - {self.transaction_type} - {self.points_amount}"


class CustomerPrescriptionHistory(TimestampedModel):
    """Track prescription history for each customer"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='prescription_history')
    medicine_name = models.CharField(max_length=255)
    medicine_brand = models.CharField(max_length=255, blank=True)
    dosage_instructions = models.TextField(blank=True)
    last_purchased_date = models.DateTimeField()
    refill_due_date = models.DateTimeField(null=True, blank=True)
    frequency = models.CharField(max_length=100, help_text="e.g., Daily, Weekly, Monthly")
    doctor_name = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = 'customer_prescription_history'
        indexes = [
            models.Index(fields=['customer', 'last_purchased_date']),
        ]
