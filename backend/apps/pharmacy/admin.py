from django.contrib import admin
from .models import Pharmacy, Branch, BranchSettings, License, TaxConfiguration


@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ['name', 'registration_number', 'city', 'is_active', 'is_verified']
    list_filter = ['is_active', 'is_verified', 'created_at']
    search_fields = ['name', 'registration_number', 'email']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ['name', 'pharmacy', 'code', 'city', 'is_active']
    list_filter = ['pharmacy', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'city']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(BranchSettings)
class BranchSettingsAdmin(admin.ModelAdmin):
    list_display = ['branch', 'enable_offline_mode', 'enable_credit_billing']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['pharmacy', 'license_type', 'license_number', 'expiry_date', 'is_active']
    list_filter = ['is_active', 'expiry_date']
    search_fields = ['license_number']
    readonly_fields = ['id', 'created_at']


@admin.register(TaxConfiguration)
class TaxConfigurationAdmin(admin.ModelAdmin):
    list_display = ['pharmacy', 'tax_id', 'tax_rate', 'is_registered']
    list_filter = ['is_registered']
    readonly_fields = ['id', 'created_at', 'updated_at']
