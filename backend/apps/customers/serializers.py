from rest_framework import serializers
from apps.customers.models import (
    Customer, CustomerAddress, LoyaltyProgram, 
    LoyaltyTransaction, CustomerPrescriptionHistory
)


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    addresses = CustomerAddressSerializer(many=True, read_only=True)
    
    class Meta:
        model = Customer
        fields = '__all__'


class LoyaltyProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyProgram
        fields = '__all__'


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyTransaction
        fields = '__all__'


class CustomerPrescriptionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerPrescriptionHistory
        fields = '__all__'
