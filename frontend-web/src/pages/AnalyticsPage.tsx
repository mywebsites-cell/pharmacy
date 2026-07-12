import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag, Users, AlertTriangle, Calendar } from 'lucide-react';
import { analyticsService, inventoryService } from '../services/api';

export default function AnalyticsPage() {
  const [reports, setReports] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = period === 'week' ? { days: 7 } : period === 'month' ? { days: 30 } : { days: 365 };

      const [sales, inventory, kpi, expiryRes] = await Promise.allSettled([
        analyticsService.getDailySales(params.days),
        analyticsService.getInventoryValuation(),
        analyticsService.getDashboard(),
        inventoryService.getExpiringSoon(90),
      ]);

      setReports({
        sales: sales.status === 'fulfilled' ? sales.value.data : { results: [] },
        inventory: inventory.status === 'fulfilled' ? inventory.value.data : null,
        kpi: kpi.status === 'fulfilled' ? kpi.value.data : null,
        expiring: expiryRes.status === 'fulfilled' ? expiryRes.value.data?.results || [] : [],
      });

      if (sales.status === 'rejected') console.error('Analytics sales error:', sales.reason);
      if (inventory.status === 'rejected') console.error('Analytics inventory error:', inventory.reason);
      if (kpi.status === 'rejected') console.error('Analytics kpi error:', kpi.reason);
      if (expiryRes.status === 'rejected') console.error('Analytics expiry error:', expiryRes.reason);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading analytics...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold">Total Revenue</h3>
            <DollarSign size={24} />
          </div>
          <div className="text-3xl font-bold">Rs {reports?.kpi?.total_revenue?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) || '0'}</div>
          <div className="text-sm mt-2 opacity-90">{reports?.kpi?.total_sales || 0} sales</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold">Total Sales</h3>
            <ShoppingBag size={24} />
          </div>
          <div className="text-3xl font-bold">{reports?.kpi?.total_sales || 0}</div>
          <div className="text-sm mt-2 opacity-90">Transactions this {period}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold">Total Customers</h3>
            <Users size={24} />
          </div>
          <div className="text-3xl font-bold">{reports?.kpi?.total_customers || 0}</div>
          <div className="text-sm mt-2 opacity-90">Registered customers</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold">Gross Margin</h3>
            <TrendingUp size={24} />
          </div>
          <div className="text-3xl font-bold">{reports?.kpi?.gross_margin?.toFixed(1) || '0'}%</div>
          <div className="text-sm mt-2 opacity-90">Profit margin</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 size={20} /> Sales Trend ({period})
          </h3>
          <div className="h-64 bg-gradient-to-t from-blue-100 to-transparent flex items-end justify-around px-4 gap-2">
            {reports?.sales?.results?.slice(-7)?.map((day, i) => {
              const maxRevenue = Math.max(...reports.sales.results.map(d => d.revenue || 1));
              const height = (day.revenue / maxRevenue) * 200;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-blue-500 rounded text-center text-xs text-white" style={{ height: `${Math.max(height, 20)}px` }}>
                    {day.transactions}
                  </div>
                  <span className="text-xs text-gray-600">{day.date?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold mb-4">Inventory Valuation</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Total Stock Value</span>
                <span className="font-bold">Rs {reports?.inventory?.total_value?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) || '0'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Total Items</span>
                <span className="font-bold">{reports?.inventory?.total_items || 0} items</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Low Stock Items</span>
                <span className="font-bold">{reports?.inventory?.low_stock_count || 0} items</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: reports?.inventory?.low_stock_count > 0 ? '50%' : '5%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1"><AlertTriangle size={13} className="text-red-500" /> Expired / Expiring (90d)</span>
                <span className={`font-bold ${(reports?.expiring?.length || 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>{reports?.expiring?.length || 0} items</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: (reports?.expiring?.length || 0) > 0 ? '60%' : '2%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Alert Table */}
      {(reports?.expiring?.length || 0) > 0 && (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-red-500" /> Expiry Alerts
          <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{reports.expiring.length}</span>
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Medicine</th>
              <th className="text-left px-4 py-2">Expiry Date</th>
              <th className="text-left px-4 py-2">Days Left</th>
              <th className="text-left px-4 py-2">Stock</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.expiring.map((med: any, i: number) => {
              const isExpired = med.days_left < 0;
              const isUrgent = !isExpired && med.days_left <= 30;
              return (
                <tr key={i} className={`border-b ${isExpired ? 'bg-red-50' : isUrgent ? 'bg-orange-50' : 'bg-yellow-50'}`}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{med.generic_name}</div>
                    <div className="text-xs text-gray-500">{med.brand_name}</div>
                  </td>
                  <td className="px-4 py-2">{med.expiry_date}</td>
                  <td className={`px-4 py-2 font-bold ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-yellow-700'}`}>
                    {isExpired ? `${Math.abs(med.days_left)}d ago` : `${med.days_left}d`}
                  </td>
                  <td className="px-4 py-2">{med.quantity_on_hand ?? 0}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {isExpired ? 'EXPIRED' : isUrgent ? 'URGENT' : 'WARNING'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Top Selling Medicines */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Top Selling Medicines</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Medicine Name</th>
              <th className="text-left px-4 py-2">Units Sold</th>
              <th className="text-left px-4 py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {reports?.kpi?.top_medicines && reports.kpi.top_medicines.length > 0 ? (
              reports.kpi.top_medicines.map((med, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">
                    <div>{med.generic_name}</div>
                    <div className="text-xs text-gray-500">{med.brand_name}</div>
                  </td>
                  <td className="px-4 py-2">{med.quantity_on_hand || 0} in stock</td>
                  <td className="px-4 py-2">Rs {((med.purchase_price || 0) * (med.quantity_on_hand || 0)).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-center text-gray-500">No medicine data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
