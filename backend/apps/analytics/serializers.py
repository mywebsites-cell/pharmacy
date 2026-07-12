from rest_framework import serializers
from apps.analytics.models import (
    DailySalesReport, InventoryValuationReport, SalesAnalytics,
    CustomerAnalytics, KPI, ProfitLossReport
)


class DailySalesReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailySalesReport
        fields = '__all__'


class InventoryValuationReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryValuationReport
        fields = '__all__'


class SalesAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesAnalytics
        fields = '__all__'


class CustomerAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAnalytics
        fields = '__all__'


class KPISerializer(serializers.ModelSerializer):
    class Meta:
        model = KPI
        fields = '__all__'


class ProfitLossReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfitLossReport
        fields = '__all__'
