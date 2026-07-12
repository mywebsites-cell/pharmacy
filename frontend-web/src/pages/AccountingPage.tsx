import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, FileText, BarChart2, ShoppingCart } from 'lucide-react';
import { accountingService } from '../services/api';

export default function AccountingPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'annual'>('monthly');
  const [report, setReport] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchReport(); }, [period]);
  useEffect(() => { fetchSummary(); }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await accountingService.getProfitLoss(period);
      setReport(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    try {
      const res = await accountingService.getSummary();
      setSummary(res.data);
    } catch (e) { console.error(e); }
  };

  const fmt = (n: number) => n?.toLocaleString('en-PK', { maximumFractionDigits: 0 }) ?? '0';

  const PERIODS = [
    { key: 'daily', label: 'Today' },
    { key: 'monthly', label: 'This Month' },
    { key: 'annual', label: 'This Year' },
  ] as const;

  const dailyBreakdown = report?.daily_breakdown || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Accounting & Finance</h1>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${period === p.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview cards for all 3 periods */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'daily', label: "Today's Sales", color: 'blue' },
            { key: 'monthly', label: 'This Month', color: 'green' },
            { key: 'annual', label: 'This Year', color: 'purple' },
          ].map(({ key, label, color }) => (
            <div key={key} onClick={() => setPeriod(key as any)} className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition hover:shadow-md ${period === key ? `border-${color}-400` : 'border-transparent'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold text-${color}-600 mt-1`}>Rs {fmt(summary[key]?.revenue)}</p>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Profit: <span className="text-green-600 font-semibold">Rs {fmt(summary[key]?.profit)}</span></span>
                <span>{summary[key]?.transactions} sales</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main P&L for selected period */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : report && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Revenue</p>
              <p className="text-xl font-bold text-blue-600">Rs {fmt(report.total_revenue)}</p>
              <p className="text-xs text-gray-400 mt-1">{report.total_transactions} transactions</p>
            </div>
            <div className="bg-red-50 border-l-4 border-red-400 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Cost of Goods</p>
              <p className="text-xl font-bold text-red-500">Rs {fmt(report.total_cost_of_goods)}</p>
              <p className="text-xs text-gray-400 mt-1">Purchase cost</p>
            </div>
            <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Gross Profit</p>
              <p className="text-xl font-bold text-green-600">Rs {fmt(report.gross_profit)}</p>
              <p className="text-xs text-gray-400 mt-1">{report.gross_margin_percent?.toFixed(1)}% margin</p>
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Net Profit</p>
              <p className="text-xl font-bold text-purple-600">Rs {fmt(report.net_profit)}</p>
              <p className="text-xs text-gray-400 mt-1">{report.label}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* P&L Statement */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-gray-700">
                <FileText size={18} /> Profit & Loss — {report.label}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="font-semibold text-gray-700">Total Revenue</span>
                  <span className="font-bold text-blue-600">Rs {fmt(report.total_revenue)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-600">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="text-red-500">− Rs {fmt(report.total_cost_of_goods)}</span>
                </div>
                <div className="flex justify-between py-2 border-t font-semibold">
                  <span>Gross Profit</span>
                  <span className={report.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}>Rs {fmt(report.gross_profit)}</span>
                </div>
                <div className="flex justify-between py-1 text-xs text-gray-500">
                  <span>Gross Margin</span>
                  <span>{report.gross_margin_percent?.toFixed(2)}%</span>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                  <div className="flex justify-between font-bold text-base">
                    <span>NET PROFIT</span>
                    <span className={report.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}>Rs {fmt(report.net_profit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-gray-700">
                <BarChart2 size={18} /> Sales Breakdown
              </h3>
              {dailyBreakdown.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No sales in this period yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 text-xs text-gray-500 font-medium">Date</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Sales</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Revenue</th>
                        <th className="text-right py-2 text-xs text-gray-500 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBreakdown.map((row: any) => (
                        <tr key={row.date} className="border-b hover:bg-gray-50">
                          <td className="py-2 text-gray-700">{row.date}</td>
                          <td className="py-2 text-right text-gray-500">{row.transactions}</td>
                          <td className="py-2 text-right text-blue-600 font-medium">Rs {fmt(row.revenue)}</td>
                          <td className="py-2 text-right text-green-600 font-medium">Rs {fmt(row.revenue - row.cogs)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-gray-50">
                      <tr>
                        <td className="py-2 font-bold text-xs">Total</td>
                        <td className="py-2 text-right font-bold text-xs">{report.total_transactions}</td>
                        <td className="py-2 text-right font-bold text-blue-600 text-xs">Rs {fmt(report.total_revenue)}</td>
                        <td className="py-2 text-right font-bold text-green-600 text-xs">Rs {fmt(report.net_profit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !report && (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p>No sales data found for this period. Make some sales from the POS to see data here.</p>
        </div>
      )}
    </div>
  );
}
