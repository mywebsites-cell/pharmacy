from django.contrib import admin
from .models import (
    MedicineCategory, Manufacturer, Medicine, GenericMapping,
    Warehouse, Shelf, MedicineBatch, Inventory, StockMovement
)


@admin.register(MedicineCategory)
class MedicineCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'code']
    search_fields = ['name', 'code']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Manufacturer)
class ManufacturerAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'country']
    search_fields = ['name', 'code']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ['brand_name', 'generic_name', 'sku', 'dosage_form', 'is_active']
    list_filter = ['category', 'is_active', 'prescription_required', 'is_controlled_drug']
    search_fields = ['brand_name', 'generic_name', 'sku', 'barcode']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(GenericMapping)
class GenericMappingAdmin(admin.ModelAdmin):
    list_display = ['generic_name']
    filter_horizontal = ['brand_medicines']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['name', 'branch', 'capacity', 'current_usage']
    list_filter = ['branch', 'is_main_warehouse']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Shelf)
class ShelfAdmin(admin.ModelAdmin):
    list_display = ['code', 'warehouse', 'row', 'column']
    list_filter = ['warehouse']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(MedicineBatch)
class MedicineBatchAdmin(admin.ModelAdmin):
    list_display = ['batch_number', 'medicine', 'expiry_date', 'quantity_available', 'is_depleted']
    list_filter = ['branch', 'is_depleted', 'expiry_date']
    search_fields = ['batch_number', 'medicine__brand_name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'is_depleted']


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ['medicine', 'branch', 'total_quantity', 'available_quantity']
    list_filter = ['branch']
    search_fields = ['medicine__brand_name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_stock_check']


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ['medicine', 'movement_type', 'quantity_change', 'branch', 'created_at']
    list_filter = ['movement_type', 'branch', 'created_at']
    search_fields = ['medicine__brand_name', 'reference_id']
    readonly_fields = ['id', 'created_at', 'updated_at']
