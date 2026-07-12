from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, F
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import Sale, SaleItem, Payment, Refund
from .serializers import SaleSerializer, SaleItemSerializer, PaymentSerializer, RefundSerializer


class SaleViewSet(viewsets.ModelViewSet):
    """Manage sales transactions."""
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['branch', 'payment_status', 'payment_method']
    search_fields = ['bill_number']
    ordering_fields = ['created_at', 'total_amount']
    
    def get_queryset(self):
        """Return sales scoped to the requesting user's branch (staff) or all (owner/admin)."""
        qs = Sale.objects.select_related('branch', 'customer', 'cashier').prefetch_related('items')
        user = self.request.user
        # Staff members are limited to their own branch
        try:
            branch_staff = getattr(user, 'branch_staff_profile', None)
            if branch_staff and getattr(branch_staff, 'status', None) == 'active':
                return qs.filter(branch=branch_staff.branch)
        except Exception:
            pass
        return qs

    def perform_create(self, serializer):
        """Auto-generate a bill number and set the cashier on sale creation."""
        today = timezone.now().date()
        # Determine the branch from the request or from the staff profile
        branch_id = self.request.data.get('branch_id')
        if not branch_id:
            try:
                branch_staff = getattr(self.request.user, 'branch_staff_profile', None)
                if branch_staff:
                    branch_id = branch_staff.branch_id
            except Exception:
                pass

        # Count today's sales for this branch to generate a unique sequential bill number
        count = Sale.objects.filter(
            branch_id=branch_id,
            created_at__date=today
        ).count() if branch_id else Sale.objects.filter(created_at__date=today).count()

        bill_number = f"BL{today.strftime('%d%m%Y')}{count + 1:05d}"

        serializer.save(
            cashier=self.request.user,
            bill_number=bill_number,
        )
    
    @action(detail=False, methods=['post'])
    def create_sale(self, request):
        """Create a new sale with items."""
        from apps.inventory.models import MedicineBatch, Inventory, StockMovement
        
        branch_id = request.data.get('branch_id')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer_id')
        payment_method = request.data.get('payment_method', 'CASH')
        is_offline = request.data.get('is_offline', False)
        
        # Generate bill number
        today_sales = Sale.objects.filter(
            branch_id=branch_id,
            created_at__date=timezone.now().date()
        ).count()
        bill_number = f"BL{timezone.now().strftime('%d%m%Y')}{today_sales + 1:05d}"
        
        # Calculate totals
        subtotal = Decimal('0')
        tax_amount = Decimal('0')
        discount_amount = Decimal('0')
        
        for item in items:
            item_total = Decimal(str(item['quantity'])) * Decimal(str(item['unit_price']))
            discount = item_total * (Decimal(str(item.get('discount_percentage', 0))) / 100)
            subtotal += item_total - discount
            tax_amount += (item_total - discount) * Decimal('0.05')  # 5% tax
        
        total_amount = subtotal + tax_amount
        
        # Create sale
        sale = Sale.objects.create(
            branch_id=branch_id,
            bill_number=bill_number,
            customer_id=customer_id,
            cashier=request.user,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            payment_method=payment_method,
            is_offline_sale=is_offline,
            sync_status='PENDING' if is_offline else 'SYNCED'
        )
        
        # Create sale items and update inventory
        for item in items:
            SaleItem.objects.create(
                sale=sale,
                medicine_id=item['medicine_id'],
                batch_id=item.get('batch_id'),
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                discount_percentage=item.get('discount_percentage', 0),
                total_amount=(Decimal(str(item['quantity'])) * Decimal(str(item['unit_price'])))
            )
            
            # Update inventory
            inventory = Inventory.objects.select_for_update().get(
                medicine_id=item['medicine_id'],
                branch_id=branch_id
            )
            inventory.available_quantity -= item['quantity']
            inventory.save()
            
            # Log stock movement
            StockMovement.objects.create(
                medicine_id=item['medicine_id'],
                batch_id=item.get('batch_id'),
                branch_id=branch_id,
                movement_type='SALE',
                quantity_change=-item['quantity'],
                reference_id=str(sale.id),
                created_by=request.user
            )
        
        serializer = self.get_serializer(sale)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """Process payment for a sale."""
        sale = self.get_object()
        amount = Decimal(str(request.data.get('amount')))
        payment_method = request.data.get('payment_method', 'CASH')
        
        Payment.objects.create(
            sale=sale,
            payment_method=payment_method,
            amount_paid=amount,
            received_by=request.user
        )
        
        # Update sale status
        if amount >= sale.total_amount:
            sale.payment_status = 'COMPLETED'
        sale.save()
        
        return Response(self.get_serializer(sale).data)
    
    @action(detail=True, methods=['get'])
    def daily_sales(self, request, pk=None):
        """Get daily sales summary for a branch."""
        from decimal import Decimal
        
        branch_id = pk
        today = timezone.now().date()
        
        sales_data = Sale.objects.filter(
            branch_id=branch_id,
            created_at__date=today
        ).aggregate(
            total_sales=Sum('total_amount'),
            total_items=Sum(F('items__quantity')),
            total_discount=Sum('discount_amount'),
            cash_sales=Sum('total_amount', filter=models.Q(payment_method='CASH')),
            card_sales=Sum('total_amount', filter=models.Q(payment_method='CARD')),
        )
        
        return Response(sales_data)


class PaymentViewSet(viewsets.ModelViewSet):
    """Manage payments."""
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['sale', 'payment_method']

    def get_queryset(self):
        """Scope payments to the requesting user's branch (staff) or all (owner/admin)."""
        qs = Payment.objects.select_related('sale', 'sale__branch', 'received_by')
        try:
            branch_staff = getattr(self.request.user, 'branch_staff_profile', None)
            if branch_staff and getattr(branch_staff, 'status', None) == 'active':
                return qs.filter(sale__branch=branch_staff.branch)
        except Exception:
            pass
        return qs

class RefundViewSet(viewsets.ModelViewSet):
    """Manage refunds."""
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['sale', 'status']

    def get_queryset(self):
        """Scope refunds to the requesting user's branch (staff) or all (owner/admin)."""
        qs = Refund.objects.select_related('sale', 'sale__branch')
        try:
            branch_staff = getattr(self.request.user, 'branch_staff_profile', None)
            if branch_staff and getattr(branch_staff, 'status', None) == 'active':
                return qs.filter(sale__branch=branch_staff.branch)
        except Exception:
            pass
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a refund."""
        refund = self.get_object()
        refund.status = 'APPROVED'
        refund.approved_by = request.user
        refund.save()
        return Response(self.get_serializer(refund).data)
