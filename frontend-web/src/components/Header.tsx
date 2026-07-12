import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, User, Bell, ChevronDown, Shield, AlertCircle, Package, AlertTriangle, CreditCard, X, Building2 } from 'lucide-react';
import { useUIStore, useAuthStore } from '../store';
import api, { inventoryService, analyticsService } from '../services/api';

export const Header: React.FC = () => {
  const { toggleSidebar, viewingAsRole, setViewingAsRole } = useUIStore();
  const { user, logout, subscription } = useAuthStore();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Notification bell state ─────────────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifData, setNotifData] = useState<{
    lowStock: number;
    expiringSoon: number;   // ≤ 30 days
    expired: number;
    overdueDues: number;
  } | null>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notification counts once on mount
  const fetchNotifications = useCallback(async () => {
    try {
      const [stockRes, expiryRes, kpiRes] = await Promise.allSettled([
        inventoryService.getLowStock(),
        inventoryService.getExpiringSoon(30),
        analyticsService.getDashboard(),
      ]);

      const lowStockItems = stockRes.status === 'fulfilled'
        ? (stockRes.value.data?.results || stockRes.value.data || [])
        : [];

      const expiringItems = expiryRes.status === 'fulfilled'
        ? (expiryRes.value.data?.results || expiryRes.value.data || [])
        : [];

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const expired = expiringItems.filter((m: any) => {
        if (!m.expiry_date) return false;
        return new Date(m.expiry_date) < today;
      });
      const expiringSoon = expiringItems.filter((m: any) => {
        if (!m.expiry_date) return false;
        const d = new Date(m.expiry_date);
        return d >= today;
      });

      const overdueDues = kpiRes.status === 'fulfilled'
        ? (kpiRes.value.data?.overdue_dues_count || 0)
        : 0;

      setNotifData({
        lowStock: lowStockItems.length,
        expiringSoon: expiringSoon.length,
        expired: expired.length,
        overdueDues,
      });
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const totalAlerts = notifData
    ? notifData.lowStock + notifData.expiringSoon + notifData.expired + notifData.overdueDues
    : 0;

  const isAdmin = user?.role === 'admin';

  const getDaysUntilExpiry = () => {
    if (!subscription?.expires_at) return null;
    const diff = new Date(subscription.expires_at).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };
  const daysUntilExpiry = getDaysUntilExpiry();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
      {daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 flex justify-center items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Your subscription expires in {daysUntilExpiry} days.
          <Link to="/subscribe" className="font-semibold underline ml-2 hover:text-amber-900">Renew Now</Link>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 text-lg hidden sm:block">PharmacyPro</span>
        </div>

        <div className="flex items-center gap-2">
          {/* ── Notification Bell ─────────────────────────────── */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifPanel((p) => !p)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-gray-600" />
              {totalAlerts > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {totalAlerts > 99 ? '99+' : totalAlerts}
                </span>
              )}
            </button>

            {/* Notification panel */}
            {showNotifPanel && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-semibold text-gray-800 text-sm">Alerts</span>
                  <div className="flex items-center gap-2">
                    {totalAlerts > 0 && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {totalAlerts} active
                      </span>
                    )}
                    <button onClick={() => setShowNotifPanel(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-50">
                  {notifData && notifData.expired > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); navigate('/inventory'); }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertCircle size={16} className="text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-700">{notifData.expired} Expired Medicine{notifData.expired > 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-500">Remove from shelf immediately</p>
                      </div>
                    </button>
                  )}

                  {notifData && notifData.expiringSoon > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); navigate('/inventory'); }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={16} className="text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-orange-700">{notifData.expiringSoon} Expiring Soon</p>
                        <p className="text-xs text-gray-500">Within the next 30 days</p>
                      </div>
                    </button>
                  )}

                  {notifData && notifData.lowStock > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); navigate('/inventory'); }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-700">{notifData.lowStock} Low Stock Item{notifData.lowStock > 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-500">Below minimum threshold</p>
                      </div>
                    </button>
                  )}

                  {notifData && notifData.overdueDues > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); navigate('/dues'); }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-yellow-50 transition text-left"
                    >
                      <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CreditCard size={16} className="text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">{notifData.overdueDues} Overdue Due{notifData.overdueDues > 1 ? 's' : ''}</p>
                        <p className="text-xs text-gray-500">Customers with outstanding balance</p>
                      </div>
                    </button>
                  )}

                  {(!notifData || totalAlerts === 0) && (
                    <div className="px-4 py-6 text-center">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Bell size={20} className="text-green-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">All clear!</p>
                      <p className="text-xs text-gray-400 mt-1">No active alerts right now</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => { fetchNotifications(); }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Refresh alerts
                  </button>
                </div>
              </div>
            )}
          </div>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                <User size={14} className="text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name || user?.username || 'User'}</span>
              <ChevronDown size={16} className="text-gray-600" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{user?.name || user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-500 mt-1">Role: <span className="font-medium capitalize">{user?.role}</span></p>
                {/* Branch name for staff members */}
                {user?.is_staff_member && user?.branch_name && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Building2 size={11} /> {user.branch_name}
                  </p>
                )}
              </div>

                {isAdmin && (
                  <>
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                        <Shield size={14} /> View As
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setViewingAsRole('pharmacist');
                            setShowProfileMenu(false);
                            navigate('/');
                          }}
                          className={`flex-1 px-3 py-1 text-xs rounded font-medium transition-colors ${
                            viewingAsRole === 'pharmacist'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Pharmacy
                        </button>
                        <button
                          onClick={() => {
                            setViewingAsRole('admin');
                            setShowProfileMenu(false);
                            navigate('/admin/dashboard');
                          }}
                          className={`flex-1 px-3 py-1 text-xs rounded font-medium transition-colors ${
                            viewingAsRole === 'admin'
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Admin
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

