from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.common.models import TimestampedModel
from apps.pharmacy.models import Pharmacy, Branch
import uuid

User = get_user_model()


class ChartOfAccounts(TimestampedModel):
    """Chart of Accounts for double-entry accounting"""
    ACCOUNT_TYPES = [
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('EQUITY', 'Equity'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='chart_of_accounts')
    account_code = models.CharField(max_length=50, unique=True)  # e.g., 1000, 1100, 2000, etc.
    account_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    parent_account = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_accounts')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'chart_of_accounts'
        unique_together = ['pharmacy', 'account_code']
        indexes = [
            models.Index(fields=['pharmacy', 'account_type']),
        ]
    
    def __str__(self):
        return f"{self.account_code} - {self.account_name}"


class JournalEntry(TimestampedModel):
    """Journal entries for double-entry accounting"""
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('POSTED', 'Posted'),
        ('REVERSED', 'Reversed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='journal_entries')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    entry_date = models.DateField(default=timezone.now)
    reference_type = models.CharField(max_length=50, choices=[
        ('SALES', 'Sales'),
        ('PURCHASE', 'Purchase'),
        ('PAYMENT', 'Payment'),
        ('RECEIPT', 'Receipt'),
        ('ADJUSTMENT', 'Adjustment'),
    ])
    reference_number = models.CharField(max_length=100)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_entries')
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_entries')
    posted_at = models.DateTimeField(null=True, blank=True)
    reversed_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'journal_entries'
        indexes = [
            models.Index(fields=['pharmacy', 'entry_date']),
            models.Index(fields=['reference_type', 'reference_number']),
        ]
    
    def __str__(self):
        return f"{self.reference_type} - {self.reference_number}"


class JournalEntryLine(TimestampedModel):
    """Individual debit/credit lines in a journal entry"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccounts, on_delete=models.PROTECT)
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    description = models.CharField(max_length=255, blank=True)
    
    class Meta:
        db_table = 'journal_entry_lines'
    
    def __str__(self):
        return f"{self.account.account_name} - Dr: {self.debit_amount}, Cr: {self.credit_amount}"


class GeneralLedger(TimestampedModel):
    """Running balance per account"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(ChartOfAccounts, on_delete=models.CASCADE, related_name='ledger_entries')
    period_date = models.DateField()
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_debits = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_credits = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    class Meta:
        db_table = 'general_ledger'
        unique_together = ['account', 'period_date']
    
    def __str__(self):
        return f"{self.account.account_name} - {self.period_date}"


class TaxReport(TimestampedModel):
    """Tax compliance reports"""
    TAX_TYPES = [('GST', 'GST'), ('VAT', 'VAT'), ('INCOME_TAX', 'Income Tax')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='tax_reports')
    tax_type = models.CharField(max_length=50, choices=TAX_TYPES)
    period_start = models.DateField()
    period_end = models.DateField()
    total_taxable_sales = models.DecimalField(max_digits=15, decimal_places=2)
    tax_rate = models.FloatField()
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2)
    tax_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_due = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    filed_date = models.DateField(null=True, blank=True)
    filing_reference = models.CharField(max_length=100, blank=True)
    
    class Meta:
        db_table = 'tax_reports'
        unique_together = ['pharmacy', 'tax_type', 'period_start', 'period_end']
    
    def __str__(self):
        return f"{self.tax_type} - {self.period_start} to {self.period_end}"
