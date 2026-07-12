import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppUser, useLicenseStore } from './store/licenseStore'
import { CreditCard } from 'lucide-react'

// ---- Use the exact same Sidebar + Header as the web app ----
import { Header } from '../../../frontend-web/src/components/Header'
import { Sidebar } from '../../../frontend-web/src/components/Sidebar'

// ---- Import all pages from the web frontend source ----
import { Dashboard } from '../../../frontend-web/src/pages/Dashboard'
import POSPage from '../../../frontend-web/src/pages/POSPage'
import InventoryPage from '../../../frontend-web/src/pages/InventoryPage'
import CustomersPage from '../../../frontend-web/src/pages/CustomersPage'
import AnalyticsPage from '../../../frontend-web/src/pages/AnalyticsPage'
import AccountingPage from '../../../frontend-web/src/pages/AccountingPage'
import TransactionHistoryPage from '../../../frontend-web/src/pages/TransactionHistoryPage'
import DuesPage from '../../../frontend-web/src/pages/DuesPage'
import SalesHistoryPage from '../../../frontend-web/src/pages/SalesHistoryPage'
import RefundsPage from '../../../frontend-web/src/pages/RefundsPage'
import { SettingsPage } from '../../../frontend-web/src/pages/SettingsPage'

// ---- Auth bridge: populate web's useAuthStore from desktop license ----
import { useAuthStore } from '../../../frontend-web/src/store'

// ---- Initialize desktop API
import { initializeDesktopAPI } from '../../../frontend-web/src/services/api'

interface AppShellProps {
  readOnly?: boolean
  user: AppUser
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

const POSBlockedScreen = () => {
  const handleRenew = async () => {
    try {
      await (window as any).electronAPI.invoke('app:open-renewal-page');
    } catch (err) {
      console.error('Failed to open renewal page:', err);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full text-red-600 mb-6">
          <CreditCard className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">POS Terminal Locked</h2>
        <p className="text-gray-500 mb-6">
          Your subscription has expired. Please renew your subscription to access sales and billing operations.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRenew}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg transition"
          >
            Renew Subscription Online
          </button>
          <p className="text-xs text-gray-400">
            Note: An internet connection is required to complete purchase. Once renewed, go to Settings and click "Check Subscription Status".
          </p>
        </div>
      </div>
    </div>
  );
};

export default function AppShell({ readOnly = false, user }: AppShellProps) {
  const { login: webLogin, setFeatures, setSubscription, setStaffPermissions, token } = useAuthStore();
  const { setUser: setDesktopUser, lockState } = useLicenseStore();
  const [tokenReady, setTokenReady] = useState(false);
  const isElectron = !!(window as any).electronAPI;
  const isExpired = lockState.reason === 'subscription_expired';

  // Initialize desktop API when user logs in
  useEffect(() => {
    if (user) {
      initializeDesktopAPI(null); // null = use local SQLite, no server sync needed
    }
  }, [user?.id]);

  // Bridge: sync desktop user into web's useAuthStore so web pages & components work
  useEffect(() => {
    if (!user) return;
    let cancelled = false;  // prevent StrictMode double-fire

    const bridge = async () => {
      // Require the token from the authenticated desktop login result.
      const storedToken = localStorage.getItem('token');
      const token: string = user.access_token || storedToken || '';

      if (cancelled) return;

      if (!token) {
        setDesktopUser(null);
        return;
      }

      // Store token in localStorage first for immediate API access
      if (token) {
        localStorage.setItem('token', token);
        console.log('[AppShell] Token stored in localStorage:', token.substring(0, 20) + '...');
      }

      const webUser = {
        id: user.id,
        username: user.name,
        name: user.name,
        email: user.email,
        role: user.role,
        staff_permissions: (user as any).staff_permissions ?? null,
        is_staff_member: !!(user as any).staff_permissions,
      };

      webLogin(token, webUser);
      const features = user.features ?? null;
      setFeatures(features);
      // Bridge staff permissions if the desktop user has them
      if ((user as any).staff_permissions) {
        setStaffPermissions((user as any).staff_permissions);
      }
      setSubscription(
        user.subscription_status
          ? {
              status: user.subscription_status,
              expires_at: user.subscription_expires_at || null,
              plan: { features_config: features },
            }
          : null
      );
      setTokenReady(true);  // Signal that token is now available
    };

    bridge();
    return () => { cancelled = true; };
  }, [user.id]);

  // Logout bridge: if web auth is cleared (user clicks logout in Header), also clear desktop license
  useEffect(() => {
    if (tokenReady && !token) {
      setDesktopUser(null);
    }
  }, [token, tokenReady]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {!tokenReady ? (
          <div className="flex h-screen items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Initializing...</p>
            </div>
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden bg-gray-100">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 relative z-[40]">
              <Header />
              {readOnly && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-400 font-medium">
                  Read-only mode — validate your license to resume full access
                </div>
              )}
              <main className="flex-1 overflow-auto">
                <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sales" element={isExpired ? <POSBlockedScreen /> : <POSPage />} />
                <Route path="/transaction-history" element={<TransactionHistoryPage />} />
                <Route path="/sales-history" element={<SalesHistoryPage />} />
                <Route path="/dues" element={<DuesPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/refunds" element={<RefundsPage />} />
                <Route path="/accounting" element={<AccountingPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
        )}
      </Router>
    </QueryClientProvider>
  )
}
