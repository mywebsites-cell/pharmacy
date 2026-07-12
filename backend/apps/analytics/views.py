from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from apps.analytics.models import (
    DailySalesReport, InventoryValuationReport, SalesAnalytics,
    CustomerAnalytics, KPI, ProfitLossReport
)
from apps.analytics.serializers import (
    DailySalesReportSerializer, InventoryValuationReportSerializer,
    SalesAnalyticsSerializer, CustomerAnalyticsSerializer,
    KPISerializer, ProfitLossReportSerializer
)


class DailySalesReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DailySalesReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return DailySalesReport.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-report_date')
    
    @action(detail=False, methods=['get'])
    def this_week(self, request):
        """Get sales for this week"""
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        
        report = DailySalesReport.objects.filter(
            pharmacy=request.user.pharmacy,
            report_date__range=[week_start, today]
        )
        serializer = self.get_serializer(report, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def this_month(self, request):
        """Get sales for this month"""
        today = timezone.now().date()
        month_start = today.replace(day=1)
        
        report = DailySalesReport.objects.filter(
            pharmacy=request.user.pharmacy,
            report_date__range=[month_start, today]
        )
        serializer = self.get_serializer(report, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get sales summary for period"""
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)
        
        reports = DailySalesReport.objects.filter(
            pharmacy=request.user.pharmacy,
            report_date__gte=start_date
        )
        
        summary = reports.aggregate(
            total_sales=Sum('total_sales'),
            total_transactions=Sum('total_transactions'),
            avg_transaction_value=Avg('average_transaction_value'),
            total_tax=Sum('total_tax_collected'),
            total_discount=Sum('total_discount_given')
        )
        
        return Response(summary)


class InventoryValuationReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryValuationReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return InventoryValuationReport.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-report_date')
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest inventory valuation"""
        report = InventoryValuationReport.objects.filter(
            pharmacy=request.user.pharmacy
        ).latest('report_date')
        
        return Response(InventoryValuationReportSerializer(report).data)
    
    @action(detail=False, methods=['get'])
    def dead_stock(self, request):
        """Get dead stock analysis"""
        report = InventoryValuationReport.objects.filter(
            pharmacy=request.user.pharmacy
        ).latest('report_date')
        
        return Response({
            'dead_stock_items': report.dead_stock_count,
            'dead_stock_value': report.dead_stock_value,
            'percentage_of_total': (report.dead_stock_value / report.total_stock_value * 100) if report.total_stock_value > 0 else 0
        })


class SalesAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SalesAnalyticsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return SalesAnalytics.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-period_end')
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get sales analytics by category"""
        period_days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=period_days)
        
        analytics = SalesAnalytics.objects.filter(
            pharmacy=request.user.pharmacy,
            period_start__gte=start_date
        ).values('category').annotate(
            total_sales=Sum('total_sales_amount'),
            total_qty=Sum('quantity_sold'),
            avg_margin=Avg('gross_margin_percent')
        ).order_by('-total_sales')
        
        return Response(analytics)
    
    @action(detail=False, methods=['get'])
    def top_medicines(self, request):
        """Get top selling medicines"""
        limit = int(request.query_params.get('limit', 10))
        period_days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=period_days)
        
        top = SalesAnalytics.objects.filter(
            pharmacy=request.user.pharmacy,
            period_start__gte=start_date,
            medicine_name__isnull=False
        ).values('medicine_name').annotate(
            total_sales=Sum('total_sales_amount'),
            total_qty=Sum('quantity_sold')
        ).order_by('-total_sales')[:limit]
        
        return Response(top)


class CustomerAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerAnalyticsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CustomerAnalytics.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-period_end')
    
    @action(detail=False, methods=['get'])
    def retention_trend(self, request):
        """Get customer retention trend"""
        months = int(request.query_params.get('months', 6))
        start_date = timezone.now().date() - timedelta(days=30*months)
        
        analytics = CustomerAnalytics.objects.filter(
            pharmacy=request.user.pharmacy,
            period_start__gte=start_date
        ).order_by('period_start')
        
        return Response(CustomerAnalyticsSerializer(analytics, many=True).data)


class KPIViewSet(viewsets.ModelViewSet):
    serializer_class = KPISerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return KPI.objects.filter(
            pharmacy=request.user.pharmacy
        )
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's KPIs"""
        today = timezone.now().date()
        kpis = KPI.objects.filter(
            pharmacy=request.user.pharmacy,
            measurement_date=today
        )
        serializer = self.get_serializer(kpis, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get KPI dashboard"""
        today = timezone.now().date()
        
        kpis = KPI.objects.filter(
            pharmacy=request.user.pharmacy,
            measurement_date=today
        ).values('kpi_name', 'kpi_value', 'target_value', 'status').order_by('kpi_name')
        
        return Response(kpis)


class ProfitLossReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProfitLossReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ProfitLossReport.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).order_by('-period_end')
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest P&L report"""
        report = ProfitLossReport.objects.filter(
            pharmacy=self.request.user.pharmacy
        ).latest('period_end')
        
        return Response(ProfitLossReportSerializer(report).data)
    
    @action(detail=False, methods=['get'])
    def trend(self, request):
        """Get P&L trend for last 12 months"""
        months = int(request.query_params.get('months', 12))
        start_date = timezone.now().date() - timedelta(days=30*months)
        
        reports = ProfitLossReport.objects.filter(
            pharmacy=self.request.user.pharmacy,
            period_start__gte=start_date
        ).order_by('period_start')
        
        return Response(ProfitLossReportSerializer(reports, many=True).data)
