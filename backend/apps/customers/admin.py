from django.contrib import admin
from apps.customers.models import (
    Customer, CustomerAddress, LoyaltyProgram, 
    LoyaltyTransaction, CustomerPrescriptionHistory
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'email', 'loyalty_balance', 'is_vip')
    search_fields = ('first_name', 'last_name', 'phone', 'email')
    list_filter = ('is_vip', 'city', 'pharmacy')


@admin.register(CustomerAddress)
class CustomerAddressAdmin(admin.ModelAdmin):
    list_display = ('customer', 'address_type', 'city', 'is_default')
    search_fields = ('customer__phone', 'city')
    list_filter = ('address_type',)


@admin.register(LoyaltyProgram)
class LoyaltyProgramAdmin(admin.ModelAdmin):
    list_display = ('pharmacy', 'points_per_rupee', 'redemption_rate', 'is_active')
    list_filter = ('is_active',)


@admin.register(LoyaltyTransaction)
class LoyaltyTransactionAdmin(admin.ModelAdmin):
    list_display = ('customer', 'transaction_type', 'points_amount', 'created_at')
    search_fields = ('customer__phone',)
    list_filter = ('transaction_type', 'created_at')


@admin.register(CustomerPrescriptionHistory)
class CustomerPrescriptionHistoryAdmin(admin.ModelAdmin):
    list_display = ('customer', 'medicine_name', 'last_purchased_date', 'refill_due_date')
    search_fields = ('customer__phone', 'medicine_name')
    list_filter = ('last_purchased_date',)
