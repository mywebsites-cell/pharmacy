from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MedicineCategoryViewSet, ManufacturerViewSet, MedicineViewSet,
    GenericMappingViewSet, WarehouseViewSet, ShelfViewSet,
    MedicineBatchViewSet, InventoryViewSet, StockMovementViewSet
)

router = DefaultRouter()
router.register(r'categories', MedicineCategoryViewSet, basename='category')
router.register(r'manufacturers', ManufacturerViewSet, basename='manufacturer')
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'generic-mappings', GenericMappingViewSet, basename='generic-mapping')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'shelves', ShelfViewSet, basename='shelf')
router.register(r'batches', MedicineBatchViewSet, basename='batch')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')

urlpatterns = [
    path('', include(router.urls)),
]
