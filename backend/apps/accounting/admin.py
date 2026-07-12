from django.contrib import admin
from apps.accounting.models import (
    ChartOfAccounts, JournalEntry, JournalEntryLine, 
    GeneralLedger, TaxReport
)


@admin.register(ChartOfAccounts)
class ChartOfAccountsAdmin(admin.ModelAdmin):
    list_display = ('account_code', 'account_name', 'account_type', 'current_balance', 'is_active')
    search_fields = ('account_code', 'account_name')
    list_filter = ('account_type', 'is_active')


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'reference_type', 'entry_date', 'status', 'created_by')
    search_fields = ('reference_number',)
    list_filter = ('status', 'reference_type', 'entry_date')


@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = ('journal_entry', 'account', 'debit_amount', 'credit_amount')
    search_fields = ('journal_entry__reference_number',)


@admin.register(GeneralLedger)
class GeneralLedgerAdmin(admin.ModelAdmin):
    list_display = ('account', 'period_date', 'opening_balance', 'total_debits', 'total_credits', 'closing_balance')
    search_fields = ('account__account_name',)
    list_filter = ('period_date',)


@admin.register(TaxReport)
class TaxReportAdmin(admin.ModelAdmin):
    list_display = ('pharmacy', 'tax_type', 'period_start', 'period_end', 'tax_amount', 'tax_paid')
    search_fields = ('pharmacy__name',)
    list_filter = ('tax_type', 'period_start')
