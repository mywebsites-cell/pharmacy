import React, { useState, useEffect } from 'react';
import { Search, Download, List, AlignJustify, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../services/api';
import { toast } from '../components/toast';

export default function TransactionHistoryPage() {
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, sales, purchases, refunds
  const [viewMode, setViewMode] = useState<'transaction' | 'item'>('item'); 
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); 
  
  const [page, setPage] = useState(1);
  const [renderedItemLimit, setRenderedItemLimit] = useState(100);
  const [hasMoreBackend, setHasMoreBackend] = useState(true);
  const PAGE_LIMIT = 200;

  const [backendStats, setBackendStats] = useState({ totalSales: 0, totalPurchases: 0, totalRefunds: 0, totalAmount: 0 });

  // Whenever filters change, reset to page 1 and clear data
  useEffect(() => {
    setPage(1);
    setRenderedItemLimit(100);
    setHasMoreBackend(true);
    fetchStats();
    fetchTransactions(1, true);
  }, [searchQuery, dateFrom, dateTo, filterType, sortOrder]);

  // Handle explicit page changes (Load More)
  useEffect(() => {
    if (page > 1) {
      fetchTransactions(page, false);
    }
  }, [page]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/transactions/stats', { 
        params: { search: searchQuery, typeFilter: filterType, dateFrom, dateTo } 
      });
      if (res.data) setBackendStats(res.data);
    } catch (e) {
      console.error('Failed to fetch transaction stats:', e);
    }
  };

  const fetchTransactions = async (pageToFetch: number, isReset: boolean) => {
    if (!hasMoreBackend && pageToFetch > 1 && !isReset) return;
    
    const abortTimer = setTimeout(() => setLoading(false), 10000);
    try {
      if (isReset) {
        setLoading(true);
        setAllTransactions([]);
      }
      
      const offset = (pageToFetch - 1) * PAGE_LIMIT;
      
      const res = await api.get('/transactions/history', { 
        params: { limit: PAGE_LIMIT, offset, search: searchQuery, typeFilter: filterType, dateFrom, dateTo, sortOrder } 
      });
      
      const newItems = res.data.results || [];
      
      if (newItems.length < PAGE_LIMIT) {
        setHasMoreBackend(false);
      } else {
        setHasMoreBackend(true);
      }
      
      setAllTransactions(prev => {
        if (isReset) return newItems;
        // Merge and prevent exact duplicates just in case offset shifts
        const prevIds = new Set(prev.map(p => `${p.type}-${p.id}`));
        const filteredNew = newItems.filter((item: any) => !prevIds.has(`${item.type}-${item.id}`));
        return [...prev, ...filteredNew];
      });
      
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      clearTimeout(abortTimer);
      setLoading(false);
    }
  };

  const downloadAsCSV = async () => {
    setLoading(true);
    let exportData: any[] = [];
    try {
      const res = await api.get('/transactions/history', { 
        params: { limit: 999999, offset: 0, search: searchQuery, typeFilter: filterType, dateFrom, dateTo, sortOrder } 
      });
      exportData = res.data.results || [];
    } catch (e) {
      console.error('Export failed:', e);
      toast.error('Failed to fetch data for export. Please try again.');
      setLoading(false);
      return;
    }
    setLoading(false);

    if (exportData.length === 0) {
      toast.warning('No transactions to download.');
      return;
    }

    const rows: string[][] = [];

    // Header block
    rows.push(['PHARMACY TRANSACTION HISTORY REPORT']);
    rows.push([]);
    rows.push(['Generated on:', new Date().toLocaleString('en-PK')]);

    // Date range line immediately after generated date
    const fromDateStr = dateFrom ? new Date(dateFrom).toLocaleDateString('en-PK') : 'All';
    const toDateStr = dateTo ? new Date(dateTo).toLocaleDateString('en-PK') : 'All';
    rows.push(['From:', `${fromDateStr} to ${toDateStr}`]);

    // Respect active type filter in export header
    if (filterType !== 'all') {
      const filterLabel = filterType === 'sale' ? 'Sales Only' : filterType === 'purchase' ? 'Purchases Only' : 'Refunds Only';
      rows.push(['Filter:', filterLabel]);
    } else {
      rows.push(['Filter:', 'All Transactions']);
    }
    rows.push([]);

    // Add table headers for BY ITEM format
    rows.push(['Date', 'Type', 'Medicine', 'Qty', 'Unit Price (Rs)', 'Total (Rs)']);
    rows.push([]);

    // Track totals
    let tableTotal = 0;
    let salesTotal = 0;
    let purchaseTotal = 0;
    let refundTotal = 0;
    let salesCount = 0;
    let purchaseCount = 0;
    let refundCount = 0;

    // BY ITEM export: one row per item, but grouped by transaction (date/type only on first item row)
    exportData.forEach(tx => {
      const date = new Date(tx.date).toLocaleDateString('en-PK');
      const typeLabel = tx.type === 'sale' ? 'SALE' : tx.type === 'purchase' ? 'PURCHASE' : 'REFUND';
      const items = tx.items || [];

      // Refund rows are negative in unit and total columns
      const sign = tx.type === 'refund' ? -1 : 1;
      let txComputedTotal = 0;

      if (items.length === 0) {
        const fallbackAmount = (tx.amount || 0) * sign;
        rows.push([date, typeLabel, '-', '-', '-', fallbackAmount.toString()]);
        txComputedTotal = fallbackAmount;
      } else {
        items.forEach((item: any, index: number) => {
          const qty = getItemQuantity(item);
          const unitPriceRaw = getItemUnitPrice(item);
          const unitPrice = unitPriceRaw * sign;
          const itemTotal = qty * unitPrice;

          rows.push([
            index === 0 ? date : '',
            index === 0 ? typeLabel : '',
            getItemName(item),
            qty.toString(),
            unitPrice.toString(),
            itemTotal.toString()
          ]);

          txComputedTotal += itemTotal;
        });
      }

      tableTotal += txComputedTotal;

      // Summary uses transaction-level counts; refund bucket remains positive in AMOUNTS
      if (tx.type === 'sale') {
        salesCount++;
        salesTotal += txComputedTotal;
      } else if (tx.type === 'purchase') {
        purchaseCount++;
        purchaseTotal += txComputedTotal;
      } else {
        refundCount++;
        refundTotal += Math.abs(txComputedTotal);
      }
    });

    // Total row before summary (one blank row above, two below)
    rows.push([]);
    rows.push(['Total  (Rs):', tableTotal.toString()]);
    rows.push([]);
    rows.push([]);

    // Summary block
    rows.push(['SUMMARY']);
    rows.push(['Total Transactions:', (salesCount + purchaseCount + refundCount).toString()]);
    rows.push(['  - Sales:', salesCount.toString()]);
    rows.push(['  - Purchases:', purchaseCount.toString()]);
    rows.push(['  - Refunds:', refundCount.toString()]);
    rows.push([]);
    rows.push(['AMOUNTS']);
    rows.push(['Total Sales (Rs):', salesTotal.toString()]);
    rows.push(['Total Purchases (Rs):', purchaseTotal.toString()]);
    rows.push(['Total Refunds (Rs):', refundTotal.toString()]);
    rows.push(['GRAND TOTAL (Rs):', (salesTotal + purchaseTotal - refundTotal).toString()]);

    // Convert to CSV format with proper quoting
    const csvContent = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = cell.toString().replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const dateLabel = dateFrom && dateTo
      ? `_${dateFrom}_to_${dateTo}`
      : dateFrom
      ? `_from_${dateFrom}`
      : dateTo
      ? `_to_${dateTo}`
      : '';

    link.setAttribute('href', url);
    link.setAttribute('download', `Transaction_History${dateLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = backendStats;

  const getItemName = (item: any) =>
    item.medicine?.generic_name || item.medicine_name || item.name || 'N/A';

  const getItemBrand = (item: any) =>
    item.medicine?.brand_name || item.brand_name || '';

  const getItemQuantity = (item: any) =>
    item.quantity_returned ?? item.quantity_sold ?? item.quantity_purchased ?? item.quantity ?? 0;

  const getItemUnitPrice = (item: any) =>
    item.unit_price ?? item.unit_cost ?? item.cost_per_unit ?? item.purchase_price ?? 0;

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'sale':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">SALE</span>;
      case 'purchase':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">PURCHASE</span>;
      case 'refund':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">REFUND</span>;
      default:
        return null;
    }
  };

  const getTransactionDetails = (tx: any) => {
    if (tx.type === 'sale') {
      return `Customer: ${tx.customer?.name || 'Walk-in'} • Payment: ${tx.payment_method}`;
    } else if (tx.type === 'purchase') {
      return `Supplier: ${tx.supplier_name || 'N/A'}${tx.notes ? ' • ' + tx.notes : ''}`;
    } else if (tx.type === 'refund') {
      return `Reason: ${tx.reason || 'N/A'} • Sale ID: #${tx.sale_id}`;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Transaction History</h1>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('transaction')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition ${
                viewMode === 'transaction' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Transaction View - one row per transaction"
            >
              <List size={15} /> Transaction
            </button>
            <button
              onClick={() => setViewMode('item')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition ${
                viewMode === 'item' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Item View - one row per item"
            >
              <AlignJustify size={15} /> By Item
            </button>
          </div>
          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm font-medium transition"
            title={sortOrder === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
          >
            {sortOrder === 'desc' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
            {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
          <button
            onClick={downloadAsCSV}
            disabled={allTransactions.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition text-sm font-medium"
          >
            <Download size={18} /> Download
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-green-700">{stats.totalSales}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">Total Purchases</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalPurchases}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium mb-1">Total Refunds</p>
          <p className="text-2xl font-bold text-red-700">{stats.totalRefunds}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-purple-700">Rs {stats.totalAmount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type Filter</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="all">All Transactions</option>
              <option value="sale">Only Sales</option>
              <option value="purchase">Only Purchases</option>
              <option value="refund">Only Refunds</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="ID, supplier, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border rounded-lg px-10 py-2 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
                setFilterType('all');
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {allTransactions.length} of {backendStats.totalSales + backendStats.totalPurchases + backendStats.totalRefunds} transactions
        </div>
      </div>

      {/* Transactions List */}
      {(() => {
        return (
          <>
            {loading && allTransactions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Loading transactions...</div>
      ) : allTransactions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 text-lg">No transactions found matching your filters</p>
        </div>
      ) : viewMode === 'transaction' ? (
        /* ===== TRANSACTION VIEW: one row per transaction ===== */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                    <span className="flex items-center gap-1">Date {sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {allTransactions.map((tx) => (
                  <tr key={`tx-${tx.type}-${tx.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{new Date(tx.date).toLocaleDateString('en-PK')}</td>
                    <td className="px-4 py-3">{getTransactionBadge(tx.type)}</td>
                    <td className="px-4 py-3 text-gray-800">
                      {(tx.items || []).length > 0 ? (
                        <div className="space-y-0.5">
                          {(tx.items || []).slice(0, 10).map((item: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="font-medium">{getItemName(item)}</span>
                              {getItemBrand(item) && <span className="text-gray-500 ml-1">({getItemBrand(item)})</span>}
                              <span className="text-gray-500 ml-2">× {getItemQuantity(item)}</span>
                            </div>
                          ))}
                          {(tx.items || []).length > 10 && (
                            <div className="text-xs text-blue-500 font-medium mt-1">... and {(tx.items || []).length - 10} more items (Switch to 'By Item' view to see all)</div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-lg">
                      <span className={tx.type === 'sale' ? 'text-green-600' : tx.type === 'purchase' ? 'text-blue-600' : 'text-red-600'}>
                        Rs {(tx.amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ===== ITEM VIEW: one independent row per item ===== */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                    <span className="flex items-center gap-1">Date {sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Medicine</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const flatRows: React.ReactNode[] = [];
                  allTransactions.forEach((tx) => {
                    const items = tx.items || [];
                    const dateLabel = new Date(tx.date).toLocaleDateString('en-PK');
                    if (items.length === 0) {
                      flatRows.push(
                        <tr key={`${tx.type}-${tx.id}-no-items`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{dateLabel}</td>
                          <td className="px-4 py-3">{getTransactionBadge(tx.type)}</td>
                          <td className="px-4 py-3 text-gray-500">-</td>
                          <td className="px-4 py-3 text-right">-</td>
                          <td className="px-4 py-3 text-right">-</td>
                          <td className="px-4 py-3 text-right font-semibold">
                            Rs {(tx.amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    } else {
                      items.forEach((item: any, itemIndex: number) => {
                        const itemTotal = getItemQuantity(item) * getItemUnitPrice(item);
                        flatRows.push(
                          <tr key={`${tx.type}-${tx.id}-item-${itemIndex}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">{dateLabel}</td>
                            <td className="px-4 py-3">{getTransactionBadge(tx.type)}</td>
                            <td className="px-4 py-3 text-gray-800">
                              <div className="font-medium">{getItemName(item)}</div>
                              {getItemBrand(item) && (
                                <div className="text-xs text-gray-500">{getItemBrand(item)}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-800">{getItemQuantity(item)}</td>
                            <td className="px-4 py-3 text-right text-gray-800">
                              Rs {getItemUnitPrice(item).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              <span className={tx.type === 'sale' ? 'text-green-600' : tx.type === 'purchase' ? 'text-blue-600' : 'text-red-600'}>
                                Rs {itemTotal.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    }
                  });

                  const visibleRows = flatRows.slice(0, renderedItemLimit);
                  const hasMoreItems = flatRows.length > renderedItemLimit;

                  return (
                    <>
                      {visibleRows}
                      {hasMoreItems && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 bg-gray-50 text-center">
                            <button
                              onClick={() => setRenderedItemLimit(p => p + 100)}
                              className="px-6 py-2 text-sm font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-sm"
                            >
                              Load 100 more items (Showing {visibleRows.length} of {flatRows.length} items on this page)
                            </button>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
            
            {hasMoreBackend && (
              <div className="flex justify-center items-center px-4 py-4 bg-white border border-gray-100 mt-4 rounded-xl shadow-sm">
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="px-6 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Loading...' : `Load More (Showing ${allTransactions.length} of ${backendStats.totalSales + backendStats.totalPurchases + backendStats.totalRefunds})`}
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
