from rest_framework import serializers
from .models import (
    MedicineCategory, Manufacturer, Medicine, GenericMapping,
    Warehouse, Shelf, MedicineBatch, Inventory, StockMovement
)


class MedicineCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicineCategory
        fields = ['id', 'name', 'description', 'code', 'icon']
        read_only_fields = ['id']


class ManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manufacturer
        fields = ['id', 'name', 'code', 'license_number', 'country', 'contact_email', 'contact_phone']
        read_only_fields = ['id']


class MedicineSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    manufacturer_name = serializers.CharField(source='manufacturer.name', read_only=True)
    
    class Meta:
        model = Medicine
        fields = [
            'id', 'generic_name', 'brand_name', 'sku', 'barcode', 'qr_code',
            'category', 'category_name', 'manufacturer', 'manufacturer_name',
            'dosage_form', 'strength', 'packaging_unit', 'quantity_per_pack',
            'prescription_required', 'is_controlled_drug', 'gst_category',
            'purchase_price', 'selling_price', 'mrp', 'wholesale_price',
            'reorder_level', 'maximum_stock_level', 'side_effects',
            'contraindications', 'drug_interactions', 'storage_instructions',
            'usage_instructions', 'is_active', 'image', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WarehouseSerializer(serializers.ModelSerializer):
    usage_percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = Warehouse
        fields = [
            'id', 'branch', 'name', 'code', 'manager', 'is_main_warehouse',
            'capacity', 'current_usage', 'usage_percentage'
        ]
        read_only_fields = ['id', 'current_usage']
    
    def get_usage_percentage(self, obj):
        if obj.capacity == 0:
            return 0
        return (obj.current_usage / obj.capacity) * 100


class ShelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shelf
        fields = ['id', 'warehouse', 'code', 'row', 'column']
        read_only_fields = ['id']


class MedicineBatchSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    is_expired = serializers.SerializerMethodField()
    days_to_expiry = serializers.SerializerMethodField()
    
    class Meta:
        model = MedicineBatch
        fields = [
            'id', 'medicine', 'medicine_name', 'branch', 'batch_number',
            'manufacturing_date', 'expiry_date', 'purchase_price', 'selling_price',
            'quantity_received', 'quantity_available', 'quantity_damaged',
            'quantity_expired', 'supplier', 'warehouse', 'shelf',
            'is_expired', 'days_to_expiry', 'is_depleted', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'is_depleted']
    
    def get_is_expired(self, obj):
        return obj.is_expired()
    
    def get_days_to_expiry(self, obj):
        return obj.days_to_expiry()


class InventorySerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    medicine_sku = serializers.CharField(source='medicine.sku', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    
    class Meta:
        model = Inventory
        fields = [
            'id', 'medicine', 'medicine_name', 'medicine_sku', 'branch',
            'branch_name', 'total_quantity', 'available_quantity',
            'reserved_quantity', 'last_stock_check'
        ]
        read_only_fields = ['id', 'last_stock_check']


class StockMovementSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = StockMovement
        fields = [
            'id', 'medicine', 'medicine_name', 'batch', 'branch',
            'movement_type', 'quantity_change', 'reference_id', 'notes',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


class GenericMappingSerializer(serializers.ModelSerializer):
    brand_medicines = MedicineSerializer(many=True, read_only=True)
    
    class Meta:
        model = GenericMapping
        fields = ['id', 'generic_name', 'brand_medicines']
        read_only_fields = ['id']
