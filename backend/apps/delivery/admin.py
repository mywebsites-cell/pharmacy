from django.contrib import admin
from apps.delivery.models import (
    Rider, Delivery, DeliveryTracking, DeliveryRating
)


@admin.register(Rider)
class RiderAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'status', 'is_available', 'rating')
    search_fields = ('first_name', 'last_name', 'phone')
    list_filter = ('status', 'is_available', 'vehicle_type')


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'rider', 'status', 'expected_delivery_date', 'actual_delivery_date')
    search_fields = ('customer_name', 'customer_phone', 'sale_id')
    list_filter = ('status', 'expected_delivery_date')


@admin.register(DeliveryTracking)
class DeliveryTrackingAdmin(admin.ModelAdmin):
    list_display = ('delivery', 'rider', 'latitude', 'longitude', 'timestamp')
    search_fields = ('delivery__customer_name',)
    list_filter = ('timestamp',)


@admin.register(DeliveryRating)
class DeliveryRatingAdmin(admin.ModelAdmin):
    list_display = ('delivery', 'rider', 'rating', 'created_at')
    search_fields = ('rider__first_name',)
    list_filter = ('rating', 'created_at')
