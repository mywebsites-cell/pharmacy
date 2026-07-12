from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F
from django.utils import timezone
from apps.customers.models import (
    Customer, CustomerAddress, LoyaltyProgram, 
    LoyaltyTransaction, CustomerPrescriptionHistory
)
from apps.customers.serializers import (
    CustomerSerializer, CustomerAddressSerializer, LoyaltyProgramSerializer,
    LoyaltyTransactionSerializer, CustomerPrescriptionHistorySerializer
)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Customer.objects.filter(
            pharmacy=self.request.user.pharmacy,
            is_deleted=False
        )
    
    @action(detail=True, methods=['post'])
    def add_loyalty_points(self, request, pk=None):
        customer = self.get_object()
        points = float(request.data.get('points', 0))
        
        customer.loyalty_balance += points
        customer.save()
        
        LoyaltyTransaction.objects.create(
            customer=customer,
            transaction_type='EARNED',
            points_amount=points,
            description=request.data.get('description', '')
        )
        
        return Response({'loyalty_balance': customer.loyalty_balance})
    
    @action(detail=True, methods=['post'])
    def redeem_loyalty_points(self, request, pk=None):
        customer = self.get_object()
        points = float(request.data.get('points', 0))
        
        if customer.loyalty_balance < points:
            return Response(
                {'error': 'Insufficient loyalty balance'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        customer.loyalty_balance -= points
        customer.save()
        
        LoyaltyTransaction.objects.create(
            customer=customer,
            transaction_type='REDEEMED',
            points_amount=points,
            description=request.data.get('description', '')
        )
        
        return Response({'loyalty_balance': customer.loyalty_balance})
    
    @action(detail=False, methods=['get'])
    def vip_customers(self, request):
        """Get VIP customers"""
        vip = Customer.objects.filter(
            pharmacy=request.user.pharmacy,
            is_vip=True,
            is_deleted=False
        )
        serializer = self.get_serializer(vip, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def loyalty_report(self, request):
        """Get loyalty program statistics"""
        program = LoyaltyProgram.objects.get(pharmacy=request.user.pharmacy)
        
        total_points = LoyaltyTransaction.objects.filter(
            customer__pharmacy=request.user.pharmacy,
            transaction_type='EARNED'
        ).aggregate(Sum('points_amount'))['points_amount__sum'] or 0
        
        redeemed_points = LoyaltyTransaction.objects.filter(
            customer__pharmacy=request.user.pharmacy,
            transaction_type='REDEEMED'
        ).aggregate(Sum('points_amount'))['points_amount__sum'] or 0
        
        return Response({
            'program': LoyaltyProgramSerializer(program).data,
            'total_points_issued': total_points,
            'total_points_redeemed': redeemed_points,
            'customers_with_balance': Customer.objects.filter(
                pharmacy=request.user.pharmacy,
                loyalty_balance__gt=0
            ).count()
        })


class CustomerAddressViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerAddressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CustomerAddress.objects.filter(
            customer__pharmacy=self.request.user.pharmacy
        )


class LoyaltyProgramViewSet(viewsets.ModelViewSet):
    serializer_class = LoyaltyProgramSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return LoyaltyProgram.objects.filter(
            pharmacy=self.request.user.pharmacy
        )


class LoyaltyTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoyaltyTransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return LoyaltyTransaction.objects.filter(
            customer__pharmacy=self.request.user.pharmacy
        ).order_by('-created_at')


class CustomerPrescriptionHistoryViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerPrescriptionHistorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CustomerPrescriptionHistory.objects.filter(
            customer__pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=False, methods=['get'])
    def due_for_refill(self, request):
        """Get medicines due for refill"""
        today = timezone.now()
        due = CustomerPrescriptionHistory.objects.filter(
            customer__pharmacy=request.user.pharmacy,
            refill_due_date__lte=today
        )
        serializer = self.get_serializer(due, many=True)
        return Response(serializer.data)
