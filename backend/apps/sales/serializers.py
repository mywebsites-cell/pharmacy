from rest_framework import serializers
from .models import Sale, SaleItem, Payment, Refund


class SaleItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    
    class Meta:
        model = SaleItem
        fields = ['id', 'medicine', 'medicine_name', 'batch', 'quantity', 'unit_price', 'discount_percentage', 'tax_amount', 'total_amount']
        read_only_fields = ['id']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'sale', 'payment_method', 'amount_paid', 'reference_number', 'received_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = ['id', 'sale', 'refund_amount', 'reason', 'approved_by', 'refund_method', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)
    
    class Meta:
        model = Sale
        fields = [
            'id', 'branch', 'bill_number', 'customer', 'customer_name', 'cashier', 'cashier_name',
            'subtotal', 'tax_amount', 'discount_amount', 'total_amount', 'payment_status',
            'payment_method', 'is_offline_sale', 'sync_status', 'notes', 'items', 'payments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'bill_number', 'created_at', 'updated_at']
