from django.db import models
from apps.common.models import TimestampedModel, SoftDeleteModel
from decimal import Decimal
import uuid


class MedicineCategory(SoftDeleteModel):
    """Medicine category classification."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    code = models.CharField(max_length=20, unique=True)
    icon = models.ImageField(upload_to='category_icons/', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Medicine Category'
        verbose_name_plural = 'Medicine Categories'
    
    def __str__(self):
        return self.name


class Manufacturer(SoftDeleteModel):
    """Medicine manufacturer/company."""
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=20, unique=True)
    license_number = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    class Meta:
        verbose_name = 'Manufacturer'
        verbose_name_plural = 'Manufacturers'
    
    def __str__(self):
        return self.name


class Medicine(SoftDeleteModel):
    """Core medicine database."""
    # Basic Info
    generic_name = models.CharField(max_length=255)
    brand_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, unique=True, null=True, blank=True)
    qr_code = models.CharField(max_length=255, blank=True)
    
    # Classification
    category = models.ForeignKey(MedicineCategory, on_delete=models.PROTECT, related_name='medicines')
    manufacturer = models.ForeignKey(Manufacturer, on_delete=models.PROTECT, related_name='medicines')
    
    # Pharmaceutical Info
    dosage_form = models.CharField(
        max_length=50,
        choices=[
            ('TABLET', 'Tablet'),
            ('CAPSULE', 'Capsule'),
            ('INJECTION', 'Injection'),
            ('LIQUID', 'Liquid'),
            ('POWDER', 'Powder'),
            ('CREAM', 'Cream'),
            ('OINTMENT', 'Ointment'),
            ('SYRUP', 'Syrup'),
        ]
    )
    strength = models.CharField(max_length=100)  # e.g., "500mg", "250IU"
    packaging_unit = models.CharField(max_length=50)  # e.g., "1 strip of 10 tablets"
    quantity_per_pack = models.IntegerField(default=1)
    
    # Regulatory Info
    prescription_required = models.BooleanField(default=False)
    is_controlled_drug = models.BooleanField(default=False)
    gst_category = models.CharField(max_length=50, default='5%')  # Tax category
    
    # Pricing
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)  # Maximum Retail Price
    wholesale_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Inventory Control
    reorder_level = models.IntegerField(default=50)
    maximum_stock_level = models.IntegerField(default=500)
    
    # Drug Info
    side_effects = models.TextField(blank=True)
    contraindications = models.TextField(blank=True)
    drug_interactions = models.TextField(blank=True)
    storage_instructions = models.TextField(blank=True)
    usage_instructions = models.TextField(blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    image = models.ImageField(upload_to='medicine_images/', null=True, blank=True)
    
    class Meta:
        verbose_name = 'Medicine'
        verbose_name_plural = 'Medicines'
        indexes = [
            models.Index(fields=['generic_name']),
            models.Index(fields=['brand_name']),
            models.Index(fields=['sku']),
            models.Index(fields=['barcode']),
            models.Index(fields=['is_active', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(quantity_per_pack__gt=0), name='medicine_quantity_per_pack_gt_zero'),
            models.CheckConstraint(check=models.Q(purchase_price__gte=0), name='medicine_purchase_price_non_negative'),
            models.CheckConstraint(check=models.Q(selling_price__gte=0), name='medicine_selling_price_non_negative'),
            models.CheckConstraint(check=models.Q(mrp__gte=0), name='medicine_mrp_non_negative'),
            models.CheckConstraint(check=models.Q(reorder_level__gte=0), name='medicine_reorder_non_negative'),
            models.CheckConstraint(check=models.Q(maximum_stock_level__gte=0), name='medicine_max_stock_non_negative'),
        ]
    
    def __str__(self):
        return f"{self.brand_name} ({self.strength})"


class GenericMapping(TimestampedModel):
    """Map multiple brand names to generic medicines."""
    generic_name = models.CharField(max_length=255)
    brand_medicines = models.ManyToManyField(Medicine, related_name='generic_mappings')
    
    class Meta:
        verbose_name = 'Generic Mapping'
        verbose_name_plural = 'Generic Mappings'
    
    def __str__(self):
        return self.generic_name


class Warehouse(SoftDeleteModel):
    """Pharmacy warehouse/storage location."""
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, related_name='warehouses')
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20)
    manager = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    is_main_warehouse = models.BooleanField(default=False)
    capacity = models.IntegerField()  # Number of items
    current_usage = models.IntegerField(default=0)
    
    class Meta:
        verbose_name = 'Warehouse'
        verbose_name_plural = 'Warehouses'
        unique_together = ['branch', 'code']
    
    def __str__(self):
        return f"{self.branch.name} - {self.name}"


class Shelf(TimestampedModel):
    """Shelf/rack organization within warehouse."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='shelves')
    code = models.CharField(max_length=50)  # e.g., "A1", "B2"
    row = models.CharField(max_length=10)
    column = models.CharField(max_length=10)
    
    class Meta:
        verbose_name = 'Shelf'
        verbose_name_plural = 'Shelves'
        unique_together = ['warehouse', 'code']
    
    def __str__(self):
        return f"{self.warehouse.name} - Shelf {self.code}"


class MedicineBatch(SoftDeleteModel):
    """Individual batch tracking for medicines."""
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='batches')
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, related_name='medicine_batches')
    batch_number = models.CharField(max_length=100)
    manufacturing_date = models.DateField()
    expiry_date = models.DateField()
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_received = models.IntegerField()
    quantity_available = models.IntegerField()
    quantity_damaged = models.IntegerField(default=0)
    quantity_expired = models.IntegerField(default=0)
    supplier = models.ForeignKey('purchases.Supplier', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    shelf = models.ForeignKey(Shelf, on_delete=models.SET_NULL, null=True, blank=True)
    purchase_order = models.ForeignKey('purchases.PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True)
    
    # FIFO tracking
    is_depleted = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Medicine Batch'
        verbose_name_plural = 'Medicine Batches'
        unique_together = ['medicine', 'branch', 'batch_number']
        indexes = [
            models.Index(fields=['branch', 'expiry_date']),
            models.Index(fields=['medicine', 'is_depleted']),
            models.Index(fields=['supplier', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(quantity_received__gte=0), name='batch_received_non_negative'),
            models.CheckConstraint(check=models.Q(quantity_available__gte=0), name='batch_available_non_negative'),
            models.CheckConstraint(check=models.Q(quantity_damaged__gte=0), name='batch_damaged_non_negative'),
            models.CheckConstraint(check=models.Q(quantity_expired__gte=0), name='batch_expired_non_negative'),
            models.CheckConstraint(check=models.Q(purchase_price__gte=0), name='batch_purchase_price_non_negative'),
            models.CheckConstraint(check=models.Q(selling_price__gte=0), name='batch_selling_price_non_negative'),
            models.CheckConstraint(check=models.Q(expiry_date__gt=models.F('manufacturing_date')), name='batch_expiry_after_mfg'),
        ]
    
    def __str__(self):
        return f"{self.medicine} - Batch {self.batch_number}"
    
    def is_expired(self):
        from django.utils import timezone
        return timezone.now().date() >= self.expiry_date
    
    def days_to_expiry(self):
        from django.utils import timezone
        delta = self.expiry_date - timezone.now().date()
        return delta.days


class Inventory(TimestampedModel):
    """Current stock level tracking per branch."""
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='inventory')
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, related_name='inventory')
    total_quantity = models.IntegerField(default=0)
    available_quantity = models.IntegerField(default=0)
    reserved_quantity = models.IntegerField(default=0)
    last_stock_check = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Inventory'
        verbose_name_plural = 'Inventories'
        unique_together = ['medicine', 'branch']
        indexes = [
            models.Index(fields=['branch', 'total_quantity']),
            models.Index(fields=['medicine', 'updated_at']),
        ]
        constraints = [
            models.CheckConstraint(check=models.Q(total_quantity__gte=0), name='inventory_total_non_negative'),
            models.CheckConstraint(check=models.Q(available_quantity__gte=0), name='inventory_available_non_negative'),
            models.CheckConstraint(check=models.Q(reserved_quantity__gte=0), name='inventory_reserved_non_negative'),
        ]
    
    def __str__(self):
        return f"{self.medicine.brand_name} @ {self.branch.name}: {self.available_quantity}"


class StockMovement(TimestampedModel):
    """Track all stock movements (audit trail)."""
    MOVEMENT_TYPE_CHOICES = [
        ('PURCHASE', 'Purchase'),
        ('SALE', 'Sale'),
        ('RETURN', 'Return'),
        ('ADJUSTMENT', 'Stock Adjustment'),
        ('DAMAGED', 'Damaged Stock'),
        ('EXPIRED', 'Expired Stock'),
        ('TRANSFER', 'Transfer Between Branches'),
        ('AUDIT', 'Stock Audit'),
    ]
    
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='stock_movements')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.CASCADE, related_name='stock_movements', null=True, blank=True)
    branch = models.ForeignKey('pharmacy.Branch', on_delete=models.CASCADE, related_name='stock_movements')
    movement_type = models.CharField(max_length=50, choices=MOVEMENT_TYPE_CHOICES)
    quantity_change = models.IntegerField()  # Positive or negative
    reference_id = models.CharField(max_length=255, blank=True)  # Sale ID, PO ID, etc.
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('common.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        verbose_name = 'Stock Movement'
        verbose_name_plural = 'Stock Movements'
        indexes = [
            models.Index(fields=['branch', 'created_at']),
            models.Index(fields=['medicine', 'movement_type']),
        ]
    
    def __str__(self):
        return f"{self.movement_type} - {self.medicine} ({self.quantity_change})"
