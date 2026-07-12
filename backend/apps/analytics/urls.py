from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.analytics.views import (
    DailySalesReportViewSet, InventoryValuationReportViewSet,
    SalesAnalyticsViewSet, CustomerAnalyticsViewSet, KPIViewSet, ProfitLossReportViewSet
)

router = DefaultRouter()
router.register(r'daily-sales', DailySalesReportViewSet, basename='daily-sales')
router.register(r'inventory-valuation', InventoryValuationReportViewSet, basename='inventory-valuation')
router.register(r'sales-analytics', SalesAnalyticsViewSet, basename='sales-analytics')
router.register(r'customer-analytics', CustomerAnalyticsViewSet, basename='customer-analytics')
router.register(r'kpis', KPIViewSet, basename='kpi')
router.register(r'profit-loss', ProfitLossReportViewSet, basename='profit-loss')

urlpatterns = [
    path('', include(router.urls)),
]
