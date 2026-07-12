from django.contrib import admin
from .models import Sale, SaleItem, Payment, Refund


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['bill_number', 'branch', 'total_amount', 'payment_status', 'created_at']
    list_filter = ['payment_status', 'payment_method', 'created_at']
    search_fields = ['bill_number']
    readonly_fields = ['id', 'created_at', 'updated_at', 'bill_number']


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ['sale', 'medicine', 'quantity', 'total_amount']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['sale', 'payment_method', 'amount_paid', 'created_at']
    list_filter = ['payment_method', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ['sale', 'refund_amount', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
