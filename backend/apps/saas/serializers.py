from rest_framework import serializers
from .models import SubscriptionPlan, PaymentAccount, PaymentSubmission, TenantSubscription
from apps.pharmacy.models import Pharmacy

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'


class PaymentAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAccount
        fields = '__all__'


class PharmacyBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = ['id', 'name', 'registration_number', 'email', 'phone_number']


class PaymentSubmissionSerializer(serializers.ModelSerializer):
    pharmacy_details = PharmacyBasicSerializer(source='pharmacy', read_only=True)
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)
    # The `pharmacy` is set server-side in the view, not provided by the client.
    # Mark it read-only so validation does not require it in incoming JSON.
    class Meta:
        model = PaymentSubmission
        fields = '__all__'
        read_only_fields = ['status', 'processed_at', 'processed_by', 'pharmacy']


class TenantSubscriptionSerializer(serializers.ModelSerializer):
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)

    class Meta:
        model = TenantSubscription
        fields = '__all__'
