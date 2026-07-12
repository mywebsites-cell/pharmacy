from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.delivery.views import (
    RiderViewSet, DeliveryViewSet, DeliveryTrackingViewSet, DeliveryRatingViewSet
)

router = DefaultRouter()
router.register(r'riders', RiderViewSet, basename='rider')
router.register(r'deliveries', DeliveryViewSet, basename='delivery')
router.register(r'tracking', DeliveryTrackingViewSet, basename='tracking')
router.register(r'ratings', DeliveryRatingViewSet, basename='rating')

urlpatterns = [
    path('', include(router.urls)),
]
