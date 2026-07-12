from django.db import models
from apps.common.models import TimestampedModel


class Supplier(TimestampedModel):
    """Medicine suppliers."""
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=20, unique=True)
    contact_person = models.CharField(max_length=255)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    payment_terms = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
    
    def __str__(self):
        return self.name


class PurchaseOrder(TimestampedModel):
    """Purchase orders for medicines."""
    pharmacy = models.ForeignKey('pharmacy.Pharmacy', on_delete=models.CASCADE)
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    po_number = models.CharField(max_length=50, unique=True)
    order_date = models.DateField(auto_now_add=True)
    expected_delivery_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=50,
        choices=[('DRAFT', 'Draft'), ('SENT', 'Sent'), ('CONFIRMED', 'Confirmed'), ('DELIVERED', 'Delivered')]
    )
    
    class Meta:
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
    
    def __str__(self):
        return self.po_number


class Customer(TimestampedModel):
    """Customer profile."""
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    allergies = models.TextField(blank=True)
    loyalty_points = models.IntegerField(default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
    
    def __str__(self):
        return self.name


class Prescription(TimestampedModel):
    """Patient prescriptions."""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='prescriptions')
    doctor_name = models.CharField(max_length=255)
    prescription_date = models.DateField()
    notes = models.TextField()
    image = models.ImageField(upload_to='prescriptions/', null=True, blank=True)
    is_processed = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Prescription'
        verbose_name_plural = 'Prescriptions'
    
    def __str__(self):
        return f"Prescription - {self.customer.name}"


class Delivery(TimestampedModel):
    """Delivery tracking."""
    sale = models.ForeignKey('sales.Sale', on_delete=models.CASCADE)
    rider = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True)
    delivery_address = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    status = models.CharField(max_length=50, choices=[('PENDING', 'Pending'), ('IN_TRANSIT', 'In Transit'), ('DELIVERED', 'Delivered')])
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Delivery'
        verbose_name_plural = 'Deliveries'
    
    def __str__(self):
        return f"Delivery - {self.sale.bill_number}"


class Notification(TimestampedModel):
    """System notifications."""
    user = models.ForeignKey('common.CustomUser', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50)
    is_read = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
    
    def __str__(self):
        return self.title


class AccountingEntry(TimestampedModel):
    """General ledger entries."""
    account_code = models.CharField(max_length=50)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField()
    reference_id = models.CharField(max_length=255)
    
    class Meta:
        verbose_name = 'Accounting Entry'
        verbose_name_plural = 'Accounting Entries'
    
    def __str__(self):
        return f"{self.account_code} - {self.description}"
