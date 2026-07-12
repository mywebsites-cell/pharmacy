from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import F, Q, Avg
from apps.delivery.models import (
    Rider, Delivery, DeliveryTracking, DeliveryRating
)
from apps.delivery.serializers import (
    RiderSerializer, DeliverySerializer, DeliveryTrackingSerializer, DeliveryRatingSerializer
)


class RiderViewSet(viewsets.ModelViewSet):
    serializer_class = RiderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Rider.objects.filter(
            pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=True, methods=['post'])
    def toggle_availability(self, request, pk=None):
        rider = self.get_object()
        rider.is_available = not rider.is_available
        rider.save()
        return Response({'is_available': rider.is_available})
    
    @action(detail=False, methods=['get'])
    def available_riders(self, request):
        """Get currently available riders"""
        riders = Rider.objects.filter(
            pharmacy=request.user.pharmacy,
            is_available=True,
            status='ACTIVE'
        )
        serializer = self.get_serializer(riders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def performance_report(self, request):
        """Get rider performance metrics"""
        riders = Rider.objects.filter(
            pharmacy=request.user.pharmacy
        )
        
        report = []
        for rider in riders:
            ratings = rider.ratings.all()
            avg_rating = ratings.aggregate(Avg('rating'))['rating__avg'] or 0
            
            report.append({
                'rider_id': rider.id,
                'name': f"{rider.first_name} {rider.last_name}",
                'total_deliveries': rider.total_deliveries,
                'successful': rider.successful_deliveries,
                'failed': rider.failed_deliveries,
                'success_rate': (rider.successful_deliveries / rider.total_deliveries * 100) if rider.total_deliveries > 0 else 0,
                'avg_rating': avg_rating
            })
        
        return Response(report)


class DeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Delivery.objects.filter(
            pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=True, methods=['post'])
    def assign_rider(self, request, pk=None):
        delivery = self.get_object()
        rider_id = request.data.get('rider_id')
        
        try:
            rider = Rider.objects.get(id=rider_id, pharmacy=self.request.user.pharmacy)
        except Rider.DoesNotExist:
            return Response({'error': 'Rider not found'}, status=status.HTTP_404_NOT_FOUND)
        
        delivery.rider = rider
        delivery.status = 'ASSIGNED'
        delivery.assignment_date = timezone.now()
        delivery.save()
        
        return Response(self.get_serializer(delivery).data)
    
    @action(detail=True, methods=['post'])
    def verify_otp(self, request, pk=None):
        delivery = self.get_object()
        otp = request.data.get('otp')
        
        if delivery.otp != otp:
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
        
        delivery.otp_verified_at = timezone.now()
        delivery.status = 'DELIVERED'
        delivery.actual_delivery_date = timezone.now()
        delivery.save()
        
        # Update rider stats
        if delivery.rider:
            delivery.rider.successful_deliveries += 1
            delivery.rider.total_deliveries += 1
            delivery.rider.save()
        
        return Response({'status': 'Delivery verified'})
    
    @action(detail=True, methods=['post'])
    def mark_failed(self, request, pk=None):
        delivery = self.get_object()
        delivery.status = 'FAILED'
        delivery.failure_reason = request.data.get('reason', '')
        delivery.save()
        
        # Update rider stats
        if delivery.rider:
            delivery.rider.failed_deliveries += 1
            delivery.rider.total_deliveries += 1
            delivery.rider.save()
        
        return Response({'status': 'Delivery marked as failed'})
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending deliveries"""
        pending = Delivery.objects.filter(
            pharmacy=request.user.pharmacy,
            status__in=['PENDING', 'ASSIGNED']
        )
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)


class DeliveryTrackingViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryTrackingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DeliveryTracking.objects.filter(
            delivery__pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=False, methods=['get'])
    def live_tracking(self, request):
        """Get real-time location of delivery"""
        delivery_id = request.query_params.get('delivery_id')
        latest = DeliveryTracking.objects.filter(
            delivery_id=delivery_id
        ).latest('timestamp')
        
        return Response(self.get_serializer(latest).data)


class DeliveryRatingViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryRatingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DeliveryRating.objects.filter(
            delivery__pharmacy=self.request.user.pharmacy
        )
