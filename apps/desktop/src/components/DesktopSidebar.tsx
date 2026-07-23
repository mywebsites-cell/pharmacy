import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLicenseStore } from '../store/licenseStore';
import {
  BarChart3, Package, ShoppingCart, Users, FileText,
  Settings, PieChart, BookOpen, CreditCard, Lock,
} from 'lucide-react';

const pharmacistMenuItems = [
  { icon: BarChart3,    label: 'Dashboard',           path: '/',                     feature: null },
  { icon: ShoppingCart, label: 'Sales / POS',          path: '/sales',                feature: 'has_pos' },
  { icon: BookOpen,     label: 'Transaction History',  path: '/transaction-history',  feature: 'has_transaction_history' },
  { icon: CreditCard,   label: 'Dues / Credit',        path: '/dues',                 feature: 'has_dues' },
  { icon: Package,      label: 'Inventory',            path: '/inventory',            feature: 'has_inventory' },
  { icon: Users,        label: 'Customers',            path: '/customers',            feature: 'has_customer_management' },
  { icon: PieChart,     label: 'Analytics',            path: '/analytics',            feature: 'has_analytics' },
  { icon: FileText,     label: 'Accounting',           path: '/accounting',           feature: 'has_accounting' },
  { icon: Settings,     label: 'Settings',             path: '/settings',             feature: null },
];

interface DesktopSidebarProps {
  open: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ open }) => {
  const location = useLocation();
  const user = useLicenseStore((s) => s.user);
  const features = user?.features ?? null;
  const isAdmin = user?.role === 'admin';

  const hasFeature = (feature: string | null | undefined) => {
    if (!feature) return true;
    if (isAdmin) return true;
    if (!features) return true;
    return !!(features as any)[feature];
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" />
      )}

      <aside
        className={`
          flex-shrink-0 h-full z-30 relative
          ${open ? 'w-64' : 'w-16'}
          bg-gray-900 border-r border-gray-700 text-white
          transition-all duration-300 overflow-hidden flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-5 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">💊</span>
            {open && (
              <span className="font-bold text-lg text-white truncate">Medicly</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {pharmacistMenuItems.map((item) => {
            const locked = !hasFeature(item.feature);
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : locked
                      ? 'text-gray-500 hover:bg-gray-800/50 cursor-pointer'
                      : 'hover:bg-gray-800 text-gray-300'
                }`}
                title={!open ? item.label : locked ? 'Upgrade to unlock' : ''}
              >
                <item.icon size={20} className={`flex-shrink-0 ${locked && !isActive ? 'opacity-50' : ''}`} />
                {open && (
                  <span className={`text-sm font-medium truncate flex-1 ${locked && !isActive ? 'opacity-50' : ''}`}>
                    {item.label}
                  </span>
                )}
                {locked && open && (
                  <Lock size={12} className="flex-shrink-0 text-gray-500 opacity-70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {open && (
          <div className="p-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center">v1.0.23 © 2026 Medicly</p>
          </div>
        )}
      </aside>
    </>
  );
};

