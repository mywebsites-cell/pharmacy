from rest_framework import serializers
from apps.accounting.models import (
    ChartOfAccounts, JournalEntry, JournalEntryLine, 
    GeneralLedger, TaxReport
)


class ChartOfAccountsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartOfAccounts
        fields = '__all__'


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.account_name', read_only=True)
    
    class Meta:
        model = JournalEntryLine
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = JournalEntry
        fields = '__all__'


class GeneralLedgerSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.account_name', read_only=True)
    
    class Meta:
        model = GeneralLedger
        fields = '__all__'


class TaxReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxReport
        fields = '__all__'
