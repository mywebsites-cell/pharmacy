from django.db import models
from django.utils import timezone
from apps.common.models import TimestampedModel
from apps.pharmacy.models import Pharmacy, Branch
import uuid


class DailySalesReport(TimestampedModel):
    """Pre-aggregated daily sales metrics"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='daily_sales_reports')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='daily_sales_reports')
    report_date = models.DateField(db_index=True)
    total_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_transactions = models.IntegerField(default=0)
    average_transaction_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_items_sold = models.IntegerField(default=0)
    total_discount_given = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tax_collected = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cash_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    card_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    upi_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    top_product = models.CharField(max_length=255, blank=True)
    top_product_quantity = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'daily_sales_reports'
        unique_together = ['pharmacy', 'branch', 'report_date']
        indexes = [
            models.Index(fields=['pharmacy', 'report_date']),
        ]
    
    def __str__(self):
        return f"{self.branch.name} - {self.report_date}"


class InventoryValuationReport(TimestampedModel):
    """Stock valuation and analysis"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='inventory_reports')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    report_date = models.DateField()
    total_medicines = models.IntegerField()
    total_quantity_on_hand = models.IntegerField()
    total_stock_value = models.DecimalField(max_digits=15, decimal_places=2)
    total_cost_value = models.DecimalField(max_digits=15, decimal_places=2)
    medicines_expiring_30_days = models.IntegerField()
    medicines_expiring_90_days = models.IntegerField()
    dead_stock_count = models.IntegerField(help_text="No movement in 90+ days")
    dead_stock_value = models.DecimalField(max_digits=15, decimal_places=2)
    low_stock_items = models.IntegerField()
    inventory_turnover_ratio = models.FloatField(null=True, blank=True)
    
    class Meta:
        db_table = 'inventory_valuation_reports'
        unique_together = ['pharmacy', 'branch', 'report_date']
    
    def __str__(self):
        return f"Inventory Report - {self.branch.name} - {self.report_date}"


class SalesAnalytics(TimestampedModel):
    """Detailed sales analysis by category, medicine, etc."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='sales_analytics')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    period_start = models.DateField()
    period_end = models.DateField()
    category = models.CharField(max_length=255)
    medicine_name = models.CharField(max_length=255, blank=True)
    quantity_sold = models.IntegerField()
    total_sales_amount = models.DecimalField(max_digits=15, decimal_places=2)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2)
    gross_profit = models.DecimalField(max_digits=15, decimal_places=2)
    gross_margin_percent = models.FloatField()
    
    class Meta:
        db_table = 'sales_analytics'
        indexes = [
            models.Index(fields=['pharmacy', 'period_start', 'period_end']),
        ]
    
    def __str__(self):
        return f"Sales Analytics - {self.medicine_name or self.category}"


class CustomerAnalytics(TimestampedModel):
    """Customer behavior and metrics"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='customer_analytics')
    period_start = models.DateField()
    period_end = models.DateField()
    total_customers = models.IntegerField()
    new_customers = models.IntegerField()
    repeat_customers = models.IntegerField()
    customer_retention_rate = models.FloatField()
    average_customer_lifetime_value = models.DecimalField(max_digits=15, decimal_places=2)
    top_customer = models.CharField(max_length=255, blank=True)
    top_customer_spend = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_loyalty_points_redeemed = models.DecimalField(max_digits=15, decimal_places=2)
    
    class Meta:
        db_table = 'customer_analytics'
    
    def __str__(self):
        return f"Customer Analytics - {self.period_start} to {self.period_end}"


class KPI(TimestampedModel):
    """Key Performance Indicators"""
    FREQUENCY_CHOICES = [('DAILY', 'Daily'), ('WEEKLY', 'Weekly'), ('MONTHLY', 'Monthly')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='kpis')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True)
    kpi_name = models.CharField(max_length=255)
    kpi_value = models.FloatField()
    unit = models.CharField(max_length=50, blank=True)
    target_value = models.FloatField(null=True, blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    measurement_date = models.DateField()
    status = models.CharField(max_length=20, choices=[
        ('ON_TRACK', 'On Track'),
        ('AT_RISK', 'At Risk'),
        ('CRITICAL', 'Critical'),
    ])
    
    class Meta:
        db_table = 'kpis'
        indexes = [
            models.Index(fields=['pharmacy', 'measurement_date']),
        ]
    
    def __str__(self):
        return f"{self.kpi_name} - {self.kpi_value} {self.unit}"


class ProfitLossReport(TimestampedModel):
    """Periodic P&L statements"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='pl_reports')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True)
    period_start = models.DateField()
    period_end = models.DateField()
    total_revenue = models.DecimalField(max_digits=15, decimal_places=2)
    total_cost_of_goods = models.DecimalField(max_digits=15, decimal_places=2)
    gross_profit = models.DecimalField(max_digits=15, decimal_places=2)
    operating_expenses = models.DecimalField(max_digits=15, decimal_places=2)
    operating_profit = models.DecimalField(max_digits=15, decimal_places=2)
    other_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    interest_expense = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_expense = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    net_profit = models.DecimalField(max_digits=15, decimal_places=2)
    gross_margin_percent = models.FloatField()
    operating_margin_percent = models.FloatField()
    net_margin_percent = models.FloatField()
    
    class Meta:
        db_table = 'profit_loss_reports'
        unique_together = ['pharmacy', 'period_start', 'period_end']
    
    def __str__(self):
        return f"P&L Report - {self.period_start} to {self.period_end}"
