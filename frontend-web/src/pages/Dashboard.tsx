import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { analyticsService, inventoryService } from '../services/api';
import { TrendingUp, ShoppingBag, Users, AlertTriangle, DollarSign, Package, Calendar, Zap, CheckCircle, Lock, CreditCard, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store';

/** Formats milliseconds into "Xd Yh Zm" — or "Xh Ym" if < 1 day — or "Ym" if < 1 hour */
function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Expired';
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const FEATURE_LABELS: Record<string, string> = {
  has_pos: 'POS & Sales', has_inventory: 'Inventory', has_transaction_history: 'Transaction History',
  has_dues: 'Dues & Credit', has_customer_management: 'Customer Mgmt', has_analytics: 'Analytics',
  has_accounting: 'Accounting', has_purchase_management: 'Purchases', has_prescriptions: 'Prescriptions',
  has_desktop_app: 'Desktop App', has_api_access: 'API Access', has_multi_branch: 'Multi-branch',
};

const getDashboardItemKey = (prefix: string, item: any, index: number) => {
  const rawId = item?.id ?? item?.medicine_id ?? item?.medicine?.id ?? item?.medicine;

  if (typeof rawId === 'string' || typeof rawId === 'number') {
    return `${prefix}-${rawId}`;
  }

  if (rawId && typeof rawId === 'object') {
    const nestedId = rawId.id ?? rawId.pk ?? rawId.value;
    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return `${prefix}-${nestedId}`;
    }
  }

  const fallback = [
    item?.generic_name,
    item?.name,
    item?.brand_name,
    item?.brand,
    item?.expiry_date,
  ].filter(Boolean).join('-');

  return fallback ? `${prefix}-${fallback}-${index}` : `${prefix}-${index}`;
};

// ─── SubscriptionCard extracted to fix React hooks-in-IIFE violation ──────────

const SubscriptionCard: React.FC<{ subscription: any; features: any; FEATURE_LABELS: Record<string, string> }> = ({ subscription, features, FEATURE_LABELS }) => {
  const navigate = useNavigate();
  const plan = subscription?.plan_details ?? (typeof subscription?.plan === 'object' ? subscription?.plan : null);
  const status = subscription?.status;
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const [countdownLabel, setCountdownLabel] = useState<string>(() =>
    expiresAt ? formatCountdown(expiresAt.getTime() - Date.now()) : ''
  );
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setCountdownLabel(formatCountdown(expiresAt!.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [subscription?.expires_at]);

  const now = new Date();
  const msLeft = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  const isActive = status === 'active' && msLeft != null && msLeft > 0;
  const isPending = status === 'pending';
  const totalDays = plan?.duration_days || 30;
  const daysLeft = msLeft != null ? msLeft / 86400000 : null;
  const usedDays = isActive && daysLeft != null ? Math.max(0, totalDays - daysLeft) : totalDays;
  const progressPct = isActive ? Math.min(100, (usedDays / totalDays) * 100) : 100;

  const enabledFeatures = features
    ? Object.entries(FEATURE_LABELS).filter(([key]) => (features as any)[key]).map(([, label]) => label)
    : [];
  const lockedFeatures = features
    ? Object.entries(FEATURE_LABELS).filter(([key]) => !(features as any)[key]).map(([, label]) => label)
    : [];

  return (
    <div className={`rounded-2xl border p-5 ${isActive ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200' : isPending ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${isActive ? 'bg-gradient-to-br from-blue-600 to-purple-600' : isPending ? 'bg-amber-500' : 'bg-red-500'}`}>
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-gray-800">{plan?.name || 'No Plan'}</h3>
              {isActive && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVE</span>}
              {isPending && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">PENDING APPROVAL</span>}
              {!isActive && !isPending && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">EXPIRED</span>}
            </div>
            {isActive && expiresAt && (
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className={`text-sm font-mono ${daysLeft != null && daysLeft <= 7 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  {countdownLabel} remaining · expires {expiresAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
            {isPending && <p className="text-sm text-amber-700 mt-1">Your payment is being reviewed. Access will be activated once approved.</p>}
            {!isActive && !isPending && <p className="text-sm text-red-600 mt-1">Your subscription has expired. Upgrade to restore access.</p>}
            {isActive && (
              <div className="mt-2 w-48 md:w-64">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${progressPct > 80 ? 'bg-red-500' : progressPct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/subscribe')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-sm shadow transition-all hover:shadow-blue-400/30 flex-shrink-0"
        >
          <Zap className="w-4 h-4" />
          {isActive ? 'Upgrade Plan' : 'Subscribe Now'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {enabledFeatures.length > 0 && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Plan Includes</p>
          <div className="flex flex-wrap gap-2">
            {enabledFeatures.map(f => (
              <span key={f} className="flex items-center gap-1 text-xs bg-white border border-green-200 text-green-700 px-2.5 py-1 rounded-full font-medium shadow-sm">
                <CheckCircle className="w-3 h-3" /> {f}
              </span>
            ))}
            {lockedFeatures.length > 0 && lockedFeatures.slice(0, 3).map(f => (
              <span key={f} className="flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-400 px-2.5 py-1 rounded-full font-medium">
                <Lock className="w-3 h-3" /> {f}
              </span>
            ))}
            {lockedFeatures.length > 3 && (
              <span className="text-xs text-gray-400 px-2.5 py-1 rounded-full border border-gray-200 bg-white font-medium">+{lockedFeatures.length - 3} more locked</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const features = useAuthStore((state) => state.features);
  const [kpi, setKpi] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiringMeds, setExpiringMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, stockRes, expiryRes] = await Promise.allSettled([
        analyticsService.getDashboard(),
        inventoryService.getLowStock(),
        inventoryService.getExpiringSoon(90),
      ]);

      setKpi(kpiRes.status === 'fulfilled' ? kpiRes.value.data : null);
      setLowStock(stockRes.status === 'fulfilled' ? stockRes.value.data?.results || [] : []);
      setExpiringMeds(expiryRes.status === 'fulfilled' ? expiryRes.value.data?.results || [] : []);

      if (kpiRes.status === 'rejected') console.error('Dashboard KPI error:', kpiRes.reason);
      if (stockRes.status === 'rejected') console.error('Dashboard stock error:', stockRes.reason);
      if (expiryRes.status === 'rejected') console.error('Dashboard expiry error:', expiryRes.reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);


  const cards = [
    {
      label: 'Total Revenue',
      value: kpi ? `Rs ${(kpi.total_revenue || 0).toLocaleString()}` : '...',
      icon: DollarSign,
      color: 'bg-blue-500',
      light: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Total Sales',
      value: kpi ? kpi.total_sales || 0 : '...',
      icon: ShoppingBag,
      color: 'bg-green-500',
      light: 'bg-green-50 text-green-700',
    },
    {
      label: 'Customers',
      value: kpi ? kpi.total_customers || 0 : '...',
      icon: Users,
      color: 'bg-purple-500',
      light: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Gross Margin',
      value: kpi ? `${kpi.gross_margin || 0}%` : '...',
      icon: TrendingUp,
      color: 'bg-orange-500',
      light: 'bg-orange-50 text-orange-700',
    },
  ];

  const salesTrend = kpi?.sales_trend || [0, 0, 0, 0, 0, 0, 0];
  const maxTrend = Math.max(...salesTrend, 1);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          title="Refresh dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition shadow-sm disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Subscription Plan Card — visible to non-admin users */}
      {user?.role !== 'admin' && (
        <SubscriptionCard subscription={subscription} features={features} FEATURE_LABELS={FEATURE_LABELS} />
      )}



      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">
                  {loading ? <span className="text-gray-300 animate-pulse">—</span> : card.value}
                </p>
              </div>
              <div className={`${card.light} p-2 md:p-3 rounded-lg`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" /> Weekly Sales Trend
          </h3>
          <div className="flex items-end justify-between gap-2 h-40">
            {salesTrend.map((val: number, i: number) => (
              <div key={i} className="flex flex-col items-center flex-1 gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${(val / maxTrend) * 100}%` }}
                  title={`Rs ${val}`}
                />
                <span className="text-xs text-gray-400">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" /> Low Stock Alerts
            {lowStock.length > 0 && (
              <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStock.length}
              </span>
            )}
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Package size={32} className="mb-2" />
              <p className="text-sm">All stock levels are healthy</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {lowStock.map((med: any, index: number) => (
                <div key={getDashboardItemKey('low-stock', med, index)} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{med.generic_name || med.name}</p>
                    <p className="text-xs text-gray-500">{med.brand_name || med.brand}</p>
                  </div>
                  <span className="text-sm font-bold text-orange-600">{med.quantity_on_hand ?? med.quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expiry Alerts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-red-500" /> Expiry Alerts
          {expiringMeds.length > 0 && (
            <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {expiringMeds.length} item{expiringMeds.length > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : expiringMeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Calendar size={32} className="mb-2" />
            <p className="text-sm">No medicines expiring in the next 90 days</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringMeds.map((med: any, index: number) => {
              const isExpired = med.days_left < 0;
              const isUrgent = med.days_left >= 0 && med.days_left <= 30;
              const bgClass = isExpired ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200';
              const badgeClass = isExpired ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';
              const label = isExpired ? 'EXPIRED' : `${med.days_left}d left`;
              return (
                <div key={getDashboardItemKey('expiry', med, index)} className={`border rounded-lg p-3 ${bgClass}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{med.generic_name || med.name}</p>
                      <p className="text-xs text-gray-500">{med.brand_name || med.brand}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Exp: {med.expiry_date}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 whitespace-nowrap ${badgeClass}`}>{label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Stock: {med.quantity_on_hand ?? 0} units</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Medicines */}
      {kpi?.top_medicines && kpi.top_medicines.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Top Selling Medicines</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpi.top_medicines.map((med: any, i: number) => (
              <div key={getDashboardItemKey('top-med', med, i)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{med.generic_name || med.name}</p>
                  <p className="text-xs text-gray-500">{med.brand_name || med.brand}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

