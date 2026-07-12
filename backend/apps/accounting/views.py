from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q
from django.utils import timezone
from apps.accounting.models import (
    ChartOfAccounts, JournalEntry, JournalEntryLine, 
    GeneralLedger, TaxReport
)
from apps.accounting.serializers import (
    ChartOfAccountsSerializer, JournalEntrySerializer, 
    JournalEntryLineSerializer, GeneralLedgerSerializer, TaxReportSerializer
)


class ChartOfAccountsViewSet(viewsets.ModelViewSet):
    serializer_class = ChartOfAccountsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ChartOfAccounts.objects.filter(
            pharmacy=self.request.user.pharmacy,
            is_active=True
        )


class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return JournalEntry.objects.filter(
            pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        entry = self.get_object()
        if entry.status != 'DRAFT':
            return Response(
                {'error': 'Only draft entries can be posted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify debits equal credits
        lines = entry.lines.all()
        total_debits = lines.aggregate(Sum('debit_amount'))['debit_amount__sum'] or 0
        total_credits = lines.aggregate(Sum('credit_amount'))['credit_amount__sum'] or 0
        
        if total_debits != total_credits:
            return Response(
                {'error': 'Debits do not equal credits'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        entry.status = 'POSTED'
        entry.posted_by = request.user
        entry.posted_at = timezone.now()
        entry.save()
        
        # Update general ledger
        for line in lines:
            period_date = entry.entry_date
            gl, _ = GeneralLedger.objects.get_or_create(
                account=line.account,
                period_date=period_date
            )
            gl.total_debits += line.debit_amount
            gl.total_credits += line.credit_amount
            gl.closing_balance = gl.opening_balance + gl.total_debits - gl.total_credits
            gl.save()
        
        return Response({'status': 'Entry posted'})
    
    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        """Generate trial balance"""
        accounts = ChartOfAccounts.objects.filter(
            pharmacy=request.user.pharmacy
        )
        
        trial_balance = []
        for account in accounts:
            gl = GeneralLedger.objects.filter(account=account).aggregate(
                debits=Sum('total_debits'),
                credits=Sum('total_credits')
            )
            trial_balance.append({
                'account': account.account_name,
                'debit': gl['debits'] or 0,
                'credit': gl['credits'] or 0
            })
        
        return Response(trial_balance)


class JournalEntryLineViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntryLineSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return JournalEntryLine.objects.filter(
            journal_entry__pharmacy=self.request.user.pharmacy
        )


class GeneralLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GeneralLedgerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        account_id = self.request.query_params.get('account_id')
        qs = GeneralLedger.objects.filter(
            account__pharmacy=self.request.user.pharmacy
        )
        if account_id:
            qs = qs.filter(account_id=account_id)
        return qs


class TaxReportViewSet(viewsets.ModelViewSet):
    serializer_class = TaxReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TaxReport.objects.filter(
            pharmacy=self.request.user.pharmacy
        )
    
    @action(detail=False, methods=['post'])
    def generate_gst_report(self, request):
        """Generate GST report for period"""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        # Calculate total taxable sales for period
        from apps.sales.models import Sale
        sales = Sale.objects.filter(
            pharmacy=request.user.pharmacy,
            created_at__date__range=[start_date, end_date],
            status='COMPLETED'
        )
        
        total_taxable = sales.aggregate(Sum('total_before_tax'))['total_before_tax__sum'] or 0
        total_tax = sales.aggregate(Sum('tax_amount'))['tax_amount__sum'] or 0
        
        report = TaxReport.objects.create(
            pharmacy=request.user.pharmacy,
            tax_type='GST',
            period_start=start_date,
            period_end=end_date,
            total_taxable_sales=total_taxable,
            tax_rate=request.data.get('tax_rate', 5),
            tax_amount=total_tax
        )
        
        return Response(TaxReportSerializer(report).data)
