from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounting.views import (
    ChartOfAccountsViewSet, JournalEntryViewSet, JournalEntryLineViewSet,
    GeneralLedgerViewSet, TaxReportViewSet
)

router = DefaultRouter()
router.register(r'chart-of-accounts', ChartOfAccountsViewSet, basename='coa')
router.register(r'journal-entries', JournalEntryViewSet, basename='journal-entry')
router.register(r'journal-lines', JournalEntryLineViewSet, basename='journal-line')
router.register(r'general-ledger', GeneralLedgerViewSet, basename='general-ledger')
router.register(r'tax-reports', TaxReportViewSet, basename='tax-report')

urlpatterns = [
    path('', include(router.urls)),
]
