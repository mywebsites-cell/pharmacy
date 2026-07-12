from rest_framework import serializers
from apps.delivery.models import (
    Rider, Delivery, DeliveryTracking, DeliveryRating
)


class RiderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rider
        fields = '__all__'


class DeliveryTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryTracking
        fields = '__all__'


class DeliverySerializer(serializers.ModelSerializer):
    rider_name = serializers.CharField(source='rider.first_name', read_only=True)
    tracking = DeliveryTrackingSerializer(many=True, read_only=True)
    
    class Meta:
        model = Delivery
        fields = '__all__'


class DeliveryRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryRating
        fields = '__all__'
