from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel
from apps.pharmacy.models import Pharmacy, Branch
import uuid

User = get_user_model()


class Rider(TimestampedModel):
    """Delivery rider profiles"""
    STATUS_CHOICES = [('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('ON_LEAVE', 'On Leave'), ('SUSPENDED', 'Suspended')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='riders')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='rider_profile')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True)
    date_of_birth = models.DateField()
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=10)
    license_number = models.CharField(max_length=100, unique=True)
    license_expiry = models.DateField()
    vehicle_type = models.CharField(max_length=50, choices=[
        ('BIKE', 'Bike'),
        ('SCOOTER', 'Scooter'),
        ('AUTO', 'Auto Rickshaw'),
        ('CAR', 'Car'),
    ])
    vehicle_registration = models.CharField(max_length=100, unique=True)
    vehicle_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    rating = models.FloatField(default=5.0)
    total_deliveries = models.IntegerField(default=0)
    successful_deliveries = models.IntegerField(default=0)
    failed_deliveries = models.IntegerField(default=0)
    current_latitude = models.FloatField(null=True, blank=True)
    current_longitude = models.FloatField(null=True, blank=True)
    is_available = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'riders'
        indexes = [
            models.Index(fields=['pharmacy', 'status']),
            models.Index(fields=['is_available']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Delivery(TimestampedModel):
    """Delivery orders"""
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ASSIGNED', 'Assigned'),
        ('PICKED_UP', 'Picked Up'),
        ('IN_TRANSIT', 'In Transit'),
        ('DELIVERED', 'Delivered'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='deliveries')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    sale_id = models.CharField(max_length=100)
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=20)
    delivery_address = models.TextField()
    delivery_latitude = models.FloatField()
    delivery_longitude = models.FloatField()
    delivery_instructions = models.TextField(blank=True)
    rider = models.ForeignKey(Rider, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    assignment_date = models.DateTimeField(null=True, blank=True)
    pickup_date = models.DateTimeField(null=True, blank=True)
    expected_delivery_date = models.DateTimeField()
    actual_delivery_date = models.DateTimeField(null=True, blank=True)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    otp = models.CharField(max_length=6, blank=True)
    otp_verified_at = models.DateTimeField(null=True, blank=True)
    signature_image = models.ImageField(upload_to='deliveries/signatures/%Y/%m/%d/', null=True, blank=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'deliveries'
        indexes = [
            models.Index(fields=['pharmacy', 'status']),
            models.Index(fields=['rider', 'status']),
            models.Index(fields=['expected_delivery_date']),
        ]
    
    def __str__(self):
        return f"Delivery {self.id} - {self.customer_name}"


class DeliveryTracking(TimestampedModel):
    """Real-time GPS tracking for deliveries"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name='tracking')
    rider = models.ForeignKey(Rider, on_delete=models.CASCADE)
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy = models.FloatField(null=True, blank=True, help_text="GPS accuracy in meters")
    speed = models.FloatField(null=True, blank=True, help_text="Speed in km/h")
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    
    class Meta:
        db_table = 'delivery_tracking'
        indexes = [
            models.Index(fields=['delivery', 'timestamp']),
            models.Index(fields=['rider', 'timestamp']),
        ]
    
    def __str__(self):
        return f"Tracking - {self.delivery.id} at {self.timestamp}"


class DeliveryRating(TimestampedModel):
    """Customer ratings for deliveries"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.OneToOneField(Delivery, on_delete=models.CASCADE, related_name='rating')
    rider = models.ForeignKey(Rider, on_delete=models.CASCADE, related_name='ratings')
    rating = models.IntegerField(choices=[(1, '1 Star'), (2, '2 Stars'), (3, '3 Stars'), (4, '4 Stars'), (5, '5 Stars')])
    comment = models.TextField(blank=True)
    punctuality_rating = models.IntegerField(null=True, blank=True)
    cleanliness_rating = models.IntegerField(null=True, blank=True)
    behavior_rating = models.IntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'delivery_ratings'
    
    def __str__(self):
        return f"Rating {self.rating}/5 for {self.delivery.id}"
