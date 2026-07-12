from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, F
from django.utils import timezone
from datetime import timedelta
from .models import (
    MedicineCategory, Manufacturer, Medicine, GenericMapping,
    Warehouse, Shelf, MedicineBatch, Inventory, StockMovement
)
from .serializers import (
    MedicineCategorySerializer, ManufacturerSerializer, MedicineSerializer,
    GenericMappingSerializer, WarehouseSerializer, ShelfSerializer,
    MedicineBatchSerializer, InventorySerializer, StockMovementSerializer
)


class MedicineCategoryViewSet(viewsets.ModelViewSet):
    """Manage medicine categories."""
    queryset = MedicineCategory.objects.all()
    serializer_class = MedicineCategorySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']


class ManufacturerViewSet(viewsets.ModelViewSet):
    """Manage medicine manufacturers."""
    queryset = Manufacturer.objects.all()
    serializer_class = ManufacturerSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']


class MedicineViewSet(viewsets.ModelViewSet):
    """Manage medicines in the catalog."""
    queryset = Medicine.objects.select_related('category', 'manufacturer')
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['category', 'manufacturer', 'is_active', 'prescription_required']
    search_fields = ['generic_name', 'brand_name', 'sku', 'barcode']
    ordering_fields = ['brand_name', 'selling_price', 'created_at']
    
    @action(detail=False, methods=['get'])
    def search_medicine(self, request):
        """Search medicines by name, barcode, or SKU."""
        query = request.query_params.get('q', '')
        if not query or len(query) < 2:
            return Response({'error': 'Query must be at least 2 characters'}, status=status.HTTP_400_BAD_REQUEST)
        
        medicines = Medicine.objects.filter(
            Q(generic_name__icontains=query) |
            Q(brand_name__icontains=query) |
            Q(sku__icontains=query) |
            Q(barcode__icontains=query)
        ).filter(is_active=True)[:20]
        
        serializer = self.get_serializer(medicines, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """Get medicine by barcode."""
        barcode = request.query_params.get('barcode')
        if not barcode:
            return Response({'error': 'barcode required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            medicine = Medicine.objects.get(barcode=barcode, is_active=True)
            serializer = self.get_serializer(medicine)
            return Response(serializer.data)
        except Medicine.DoesNotExist:
            return Response({'error': 'Medicine not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get medicines with low stock."""
        branch_id = request.query_params.get('branch_id') or getattr(getattr(request.user, 'branch', None), 'id', None)
        if not branch_id:
            return Response({'error': 'branch_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        low_stock_medicines = Inventory.objects.filter(
            branch_id=branch_id,
            available_quantity__lte=F('medicine__reorder_level')
        ).select_related('medicine')
        
        serializer = InventorySerializer(low_stock_medicines, many=True)
        return Response(serializer.data)


class WarehouseViewSet(viewsets.ModelViewSet):
    """Manage warehouses."""
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['branch', 'is_main_warehouse']
    
    def get_queryset(self):
        return Warehouse.objects.select_related('branch')


class ShelfViewSet(viewsets.ModelViewSet):
    """Manage shelves within warehouses."""
    serializer_class = ShelfSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['warehouse']
    
    def get_queryset(self):
        return Shelf.objects.select_related('warehouse')


class MedicineBatchViewSet(viewsets.ModelViewSet):
    """Manage medicine batches with FIFO tracking."""
    serializer_class = MedicineBatchSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['medicine', 'branch', 'is_depleted']
    search_fields = ['batch_number', 'medicine__brand_name']
    ordering_fields = ['expiry_date', 'quantity_available']
    
    def get_queryset(self):
        return MedicineBatch.objects.select_related('medicine', 'branch', 'warehouse', 'shelf')
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get batches expiring in next 30 days."""
        branch_id = request.query_params.get('branch_id')
        days = int(request.query_params.get('days', 30))
        
        query = MedicineBatch.objects.filter(
            expiry_date__lte=timezone.now().date() + timedelta(days=days),
            expiry_date__gte=timezone.now().date(),
            is_depleted=False
        ).select_related('medicine', 'branch')
        
        if branch_id:
            query = query.filter(branch_id=branch_id)
        
        serializer = self.get_serializer(query, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def expired_stock(self, request):
        """Get expired batches."""
        branch_id = request.query_params.get('branch_id')
        
        query = MedicineBatch.objects.filter(
            expiry_date__lt=timezone.now().date(),
            is_depleted=False
        ).select_related('medicine', 'branch')
        
        if branch_id:
            query = query.filter(branch_id=branch_id)
        
        serializer = self.get_serializer(query, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_damaged(self, request, pk=None):
        """Mark items as damaged."""
        batch = self.get_object()
        quantity = request.data.get('quantity', 0)
        
        if quantity > batch.quantity_available:
            return Response(
                {'error': 'Cannot mark more than available quantity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        batch.quantity_damaged += quantity
        batch.quantity_available -= quantity
        batch.save()
        
        # Log stock movement
        StockMovement.objects.create(
            medicine=batch.medicine,
            batch=batch,
            branch=batch.branch,
            movement_type='DAMAGED',
            quantity_change=-quantity,
            reference_id=str(batch.id),
            created_by=request.user
        )
        
        return Response(self.get_serializer(batch).data)


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View inventory levels."""
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['branch', 'medicine']
    search_fields = ['medicine__brand_name', 'medicine__sku']
    ordering_fields = ['total_quantity', 'available_quantity']
    
    def get_queryset(self):
        return Inventory.objects.select_related('medicine', 'branch')
    
    @action(detail=False, methods=['get'])
    def branch_inventory_summary(self, request):
        """Get inventory summary for a branch."""
        branch_id = request.query_params.get('branch_id')
        if not branch_id:
            return Response({'error': 'branch_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        inventory = Inventory.objects.filter(branch_id=branch_id).aggregate(
            total_items=Sum('total_quantity'),
            available_items=Sum('available_quantity'),
            reserved_items=Sum('reserved_quantity'),
            total_value=Sum(F('available_quantity') * F('medicine__selling_price'))
        )
        
        return Response(inventory)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """View stock movements (audit trail)."""
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['branch', 'movement_type', 'medicine']
    ordering_fields = ['created_at']
    
    def get_queryset(self):
        return StockMovement.objects.select_related(
            'medicine', 'branch', 'created_by'
        ).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def branch_movements(self, request):
        """Get stock movements for a branch with date filter."""
        branch_id = request.query_params.get('branch_id')
        days = int(request.query_params.get('days', 30))
        movement_type = request.query_params.get('movement_type')
        
        query = StockMovement.objects.filter(
            branch_id=branch_id,
            created_at__gte=timezone.now() - timedelta(days=days)
        ).select_related('medicine', 'created_by')
        
        if movement_type:
            query = query.filter(movement_type=movement_type)
        
        serializer = self.get_serializer(query, many=True)
        return Response(serializer.data)


class GenericMappingViewSet(viewsets.ModelViewSet):
    """Manage generic medicine mappings."""
    queryset = GenericMapping.objects.prefetch_related('brand_medicines')
    serializer_class = GenericMappingSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['generic_name']
