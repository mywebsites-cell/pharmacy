from django.db import models
from django.db.models import F, Sum
from apps.common.models import TimestampedModel, SoftDeleteModel
from decimal import Decimal


class Sale(SoftDeleteModel):
    """Individual sales transaction."""
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('REFUNDED', 'Refunded'),
        ('PARTIAL_REFUND', 'Partial Refund'),
    ]
    
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, related_name='sales')
    bill_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True)
    cashier = models.ForeignKey('common.CustomUser', on_delete=models.PROTECT)
    
    # Amounts
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Payment
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    payment_method = models.CharField(
        max_length=50,
        choices=[
            ('CASH', 'Cash'),
            ('CARD', 'Card'),
            ('MOBILE_PAYMENT', 'Mobile Payment'),
            ('WALLET', 'Wallet'),
            ('CREDIT', 'Credit'),
            ('MIXED', 'Mixed Payment'),
        ]
    )
    
    # Details
    is_offline_sale = models.BooleanField(default=False)
    sync_status = models.CharField(
        max_length=20,
        choices=[('PENDING', 'Pending'), ('SYNCED', 'Synced'), ('FAILED', 'Failed')],
        default='SYNCED'
    )
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Sale'
        verbose_name_plural = 'Sales'
        indexes = [
            models.Index(fields=['branch', 'created_at']),
            models.Index(fields=['bill_number']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['sync_status', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(subtotal__gte=0), name='sale_subtotal_non_negative'),
            models.CheckConstraint(check=models.Q(tax_amount__gte=0), name='sale_tax_non_negative'),
            models.CheckConstraint(check=models.Q(discount_amount__gte=0), name='sale_discount_non_negative'),
            models.CheckConstraint(check=models.Q(total_amount__gte=0), name='sale_total_non_negative'),
        ]
    
    def __str__(self):
        return f"Bill {self.bill_number}"


class SaleItem(TimestampedModel):
    """Individual items in a sale."""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey('inventory.Medicine', on_delete=models.PROTECT)
    batch = models.ForeignKey('inventory.MedicineBatch', on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        verbose_name = 'Sale Item'
        verbose_name_plural = 'Sale Items'
        indexes = [
            models.Index(fields=['sale', 'medicine']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(quantity__gt=0), name='saleitem_quantity_gt_zero'),
            models.CheckConstraint(check=models.Q(unit_price__gte=0), name='saleitem_unit_price_non_negative'),
            models.CheckConstraint(check=models.Q(total_amount__gte=0), name='saleitem_total_non_negative'),
            models.CheckConstraint(check=models.Q(tax_amount__gte=0), name='saleitem_tax_non_negative'),
            models.CheckConstraint(check=models.Q(discount_percentage__gte=0), name='saleitem_discount_non_negative'),
        ]
    
    def __str__(self):
        return f"{self.medicine.brand_name} x{self.quantity}"


class Payment(TimestampedModel):
    """Payment records for sales."""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    payment_method = models.CharField(max_length=50)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    reference_number = models.CharField(max_length=255, blank=True)
    received_by = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        indexes = [
            models.Index(fields=['sale', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(amount_paid__gt=0), name='payment_amount_gt_zero'),
        ]
    
    def __str__(self):
        return f"Payment {self.amount_paid} for {self.sale}"


class Refund(SoftDeleteModel):
    """Refund transactions."""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='refunds')
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    approved_by = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True)
    refund_method = models.CharField(max_length=50)  # back to original payment method
    status = models.CharField(
        max_length=20,
        choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('COMPLETED', 'Completed'), ('REJECTED', 'Rejected')]
    )
    
    class Meta:
        verbose_name = 'Refund'
        verbose_name_plural = 'Refunds'
        indexes = [
            models.Index(fields=['sale', 'status']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(refund_amount__gt=0), name='refund_amount_gt_zero'),
        ]
    
    def __str__(self):
        return f"Refund {self.refund_amount} for {self.sale}"
