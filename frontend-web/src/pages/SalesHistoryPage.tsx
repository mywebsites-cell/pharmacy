import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Download } from 'lucide-react';
import api from '../services/api';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sales, searchQuery, dateFrom, dateTo]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales/sales/', { params: { limit: 1500 } });
      const allSales = (res.data.results || res.data || [])
        .map((s: any) => ({ ...s, _timestamp: new Date(s.date || s.created_at).getTime() }))
        .sort((a: any, b: any) => b._timestamp - a._timestamp);
      setSales(allSales);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = sales;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((sale: any) => 
        sale.id.toString().includes(q) ||
        (sale.customer?.name || 'Walk-in').toLowerCase().includes(q) ||
        sale.items?.some((item: any) => 
          (item.medicine?.generic_name || '').toLowerCase().includes(q) ||
          (item.medicine?.brand_name || '').toLowerCase().includes(q)
        )
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((sale: any) => new Date(sale.date) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((sale: any) => new Date(sale.date) <= toDate);
    }

    setFilteredSales(filtered);
  };

  const fmt = (n: number) => n?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) ?? '0';

  const downloadAsCSV = () => {
    if (filteredSales.length === 0) {
      alert('No sales data to download');
      return;
    }

    // Prepare headers
    const headers = ['Date & Time', 'Medicine', 'Qty', 'Unit Price', 'Item Total', 'Sale Total'];
    
    // Prepare rows
    const rows: string[][] = [];
    filteredSales.forEach((sale: any) => {
      const saleDate = new Date(sale.date).toLocaleDateString('en-PK');
      const saleTime = new Date(sale.date).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
      const dateTime = `${saleDate} ${saleTime}`;
      
      sale.items?.forEach((item: any, idx: number) => {
        const medicineName = item.medicine?.generic_name || item.medicine?.name || 'N/A';
        const brandName = item.medicine?.brand_name || '';
        const dosageForm = item.medicine?.dosage_form || '';
        const medicineDisplay = `${medicineName}${brandName ? ` (${brandName})` : ''}${dosageForm ? ` - ${dosageForm}` : ''}`;
        
        rows.push([
          idx === 0 ? dateTime : '',
          medicineDisplay,
          item.quantity_sold.toString(),
          `Rs ${item.unit_price?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) || '0'}`,
          `Rs ${(item.unit_price * item.quantity_sold).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
          idx === 0 ? `Rs ${(sale.total_amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : ''
        ]);
      });
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
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
    link.setAttribute('download', `Sales_History${dateLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Sales History & Records</h1>
        <button
          onClick={downloadAsCSV}
          disabled={filteredSales.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition text-sm font-medium"
        >
          <Download size={18} /> Download
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Sale ID, customer, medicine..."
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
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2 transition text-sm"
            >
              <RotateCcw size={16} /> Clear
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredSales.length} of {sales.length} sales
        </div>
      </div>

      {/* Sales Records */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading sales history...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500 text-lg">No sales found matching your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700">Medicine</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700">Qty</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Unit Price</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Item Total</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700">Sale Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale: any) => {
                  const items = sale.items || [];
                  
                  return items.map((item: any, itemIdx: number) => (
                    <tr key={`${sale.id}-${itemIdx}`} className={`border-b transition hover:bg-blue-50 ${itemIdx > 0 ? 'bg-gray-50' : ''}`}>

                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {itemIdx === 0 ? (
                          <>
                            <p className="text-sm">{new Date(sale.date).toLocaleDateString('en-PK')}</p>
                            <p className="text-xs text-gray-500">{new Date(sale.date).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</p>
                          </>
                        ) : ''}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-800 font-medium">{item.medicine?.generic_name || item.medicine?.name}</div>
                        <div className="text-xs text-gray-500">{item.medicine?.brand_name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{item.medicine?.dosage_form || ''}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700 font-semibold">{item.quantity_sold}</td>
                      <td className="py-3 px-4 text-right text-gray-700">Rs {item.unit_price?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) || '0'}</td>
                      <td className="py-3 px-4 text-right text-blue-600 font-semibold">Rs {(item.unit_price * item.quantity_sold).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        {itemIdx === 0 ? `Rs ${(sale.total_amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : ''}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      {filteredSales.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Total Sales Transactions</p>
            <p className="text-3xl font-bold text-blue-600">{filteredSales.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Total Items Sold</p>
            <p className="text-3xl font-bold text-purple-600">
              {filteredSales.reduce((sum, s) => sum + (s.items?.reduce((itemSum: number, item: any) => itemSum + item.quantity_sold, 0) || 0), 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600">Rs {fmt(filteredSales.reduce((sum: number, s) => sum + (s.total_amount || 0), 0))}</p>
          </div>
        </div>
      )}
    </div>
  );
}
