import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUIStore, useAuthStore } from '../store';
import { BarChart3, Package, ShoppingCart, Users, FileText, Settings, PieChart, BookOpen, CreditCard, Shield, Activity, Layers, Lock, Building2 } from 'lucide-react';

// Map each sidebar route to its staff permission key
const STAFF_PERMISSION_MAP: Record<string, keyof import('../store').StaffPermissions> = {
  '/sales': 'can_access_pos',
  '/transaction-history': 'can_access_transaction_history',
  '/dues': 'can_access_dues',
  '/inventory': 'can_access_inventory',
  '/customers': 'can_access_customers',
  '/analytics': 'can_access_analytics',
  '/accounting': 'can_access_accounting',
};

export const Sidebar: React.FC = () => {
  const { sidebarOpen, toggleSidebar, viewingAsRole, setViewingAsRole } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const features = useAuthStore((state) => state.features);
  const staffPermissions = useAuthStore((state) => state.staffPermissions);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isStaffMember = !!user?.is_staff_member;
  const onAdminRoute = location.pathname.startsWith('/admin');
  const showingAdminView = isAdmin && (viewingAsRole === 'admin' || onAdminRoute);

  // Auto-sync viewingAsRole with the current route
  useEffect(() => {
    if (isAdmin) {
      if (onAdminRoute && viewingAsRole !== 'admin') setViewingAsRole('admin');
      else if (!onAdminRoute && viewingAsRole !== 'pharmacist') setViewingAsRole('pharmacist');
    }
  }, [location.pathname, isAdmin]);

  const adminMenuItems = [
    { icon: Shield, label: 'Control Center', path: '/admin/dashboard' },
    { icon: Users, label: 'User Management', path: '/admin/users' },
    { icon: BarChart3, label: 'System Overview', path: '/admin/config' },
    { icon: Activity, label: 'Audit Logs', path: '/admin/logs' },
    { icon: Layers, label: 'Subscriptions', path: '/admin/subscriptions' },
  ];

  const pharmacistMenuItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/', feature: null },
    { icon: ShoppingCart, label: 'Sales / POS', path: '/sales', feature: 'has_pos' },
    { icon: BookOpen, label: 'Transaction History', path: '/transaction-history', feature: 'has_transaction_history' },
    { icon: CreditCard, label: 'Dues / Credit', path: '/dues', feature: 'has_dues' },
    { icon: Package, label: 'Inventory', path: '/inventory', feature: 'has_inventory' },
    { icon: Users, label: 'Customers', path: '/customers', feature: 'has_customer_management' },
    { icon: PieChart, label: 'Analytics', path: '/analytics', feature: 'has_analytics' },
    { icon: FileText, label: 'Accounting', path: '/accounting', feature: 'has_accounting' },
    { icon: Building2, label: 'Branch Management', path: '/branches', feature: 'has_multi_branch' },
    { icon: Settings, label: 'Settings', path: '/settings', feature: null },
  ];

  const menuItems = showingAdminView ? adminMenuItems : pharmacistMenuItems;

  const hasFeature = (feature: string | null | undefined, path: string) => {
    if (!feature) return true; // no subscription restriction
    if (isAdmin) return true;  // admins have everything

    // Layer 1: subscription plan gate
    if (features && !(features as any)[feature]) return false;

    // Layer 2: staff permission gate (only applies to staff members)
    if (isStaffMember && staffPermissions) {
      const permKey = STAFF_PERMISSION_MAP[path];
      if (permKey && !staffPermissions[permKey]) return false;
    }

    return true;
  };

  // Auto-close sidebar on mobile after navigating
  const handleNavClick = () => {
    if (window.innerWidth < 768) toggleSidebar();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`
          flex-shrink-0 h-full z-30 relative
          ${sidebarOpen ? 'w-64' : 'w-16'}
          ${showingAdminView ? 'bg-slate-900 border-r border-slate-700' : 'bg-gray-900 border-r border-gray-700'} text-white transition-all duration-300 overflow-hidden
          flex flex-col
        `}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center justify-between px-3 py-5 border-b ${showingAdminView ? 'border-slate-700' : 'border-gray-700'}`}>
          <div className="flex items-center gap-3 min-w-0">
            {showingAdminView ? (
              <div className="p-1 flex-shrink-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <Shield size={20} className="text-white" />
              </div>
            ) : (
              <span className="text-2xl flex-shrink-0">💊</span>
            )}
            {sidebarOpen && (
              <div className="min-w-0">
                <span className="font-bold text-lg text-white truncate block">
                  {showingAdminView ? 'Admin Panel' : 'Medicly'}
                </span>
                {/* Show branch name for staff members */}
                {isStaffMember && user?.branch_name && !showingAdminView && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 truncate mt-0.5">
                    <Building2 size={11} className="flex-shrink-0" />
                    {user.branch_name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const locked = !hasFeature((item as any).feature, item.path);
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors relative ${
                  isActive
                    ? showingAdminView
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                      : 'bg-blue-600 text-white'
                    : locked
                      ? 'text-gray-500 hover:bg-gray-800/50 cursor-pointer'
                      : showingAdminView
                        ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                }`}
                title={!sidebarOpen ? item.label : locked ? 'Upgrade to unlock' : ''}
              >
                <item.icon size={20} className={`flex-shrink-0 ${locked && !isActive ? 'opacity-50' : ''}`} />
                {sidebarOpen && (
                  <span className={`text-sm font-medium truncate flex-1 ${locked && !isActive ? 'opacity-50' : ''}`}>
                    {item.label}
                  </span>
                )}
                {locked && sidebarOpen && (
                  <Lock size={12} className="flex-shrink-0 text-gray-500 opacity-70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className={`p-4 border-t ${showingAdminView ? 'border-slate-700' : 'border-gray-700'}`}>
            {showingAdminView ? (
              <p className="text-xs text-slate-500 text-center">System Administration</p>
            ) : (
              <p className="text-xs text-gray-500 text-center">v1.0.0 © 2026 Medicly</p>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
