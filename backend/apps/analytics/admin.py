from django.contrib import admin
from apps.analytics.models import (
    DailySalesReport, InventoryValuationReport, SalesAnalytics,
    CustomerAnalytics, KPI, ProfitLossReport
)


@admin.register(DailySalesReport)
class DailySalesReportAdmin(admin.ModelAdmin):
    list_display = ('branch', 'report_date', 'total_sales', 'total_transactions')
    search_fields = ('branch__name',)
    list_filter = ('report_date',)


@admin.register(InventoryValuationReport)
class InventoryValuationReportAdmin(admin.ModelAdmin):
    list_display = ('branch', 'report_date', 'total_stock_value', 'dead_stock_count')
    search_fields = ('branch__name',)
    list_filter = ('report_date',)


@admin.register(SalesAnalytics)
class SalesAnalyticsAdmin(admin.ModelAdmin):
    list_display = ('branch', 'category', 'medicine_name', 'quantity_sold', 'gross_margin_percent')
    search_fields = ('category', 'medicine_name')
    list_filter = ('period_start', 'category')


@admin.register(CustomerAnalytics)
class CustomerAnalyticsAdmin(admin.ModelAdmin):
    list_display = ('pharmacy', 'period_start', 'total_customers', 'customer_retention_rate')
    search_fields = ('pharmacy__name',)
    list_filter = ('period_start',)


@admin.register(KPI)
class KPIAdmin(admin.ModelAdmin):
    list_display = ('kpi_name', 'kpi_value', 'target_value', 'status', 'measurement_date')
    search_fields = ('kpi_name',)
    list_filter = ('status', 'measurement_date')


@admin.register(ProfitLossReport)
class ProfitLossReportAdmin(admin.ModelAdmin):
    list_display = ('pharmacy', 'period_start', 'net_profit', 'net_margin_percent')
    search_fields = ('pharmacy__name',)
    list_filter = ('period_start',)
