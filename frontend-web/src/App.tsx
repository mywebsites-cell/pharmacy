import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivateRoute } from './components/PrivateRoute';
import { ToastContainer } from './components/toast';
import { ConfirmModal } from './components/ConfirmModal';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminPanel } from './pages/AdminPanel';
import BranchManagementPanel from './pages/BranchManagementPanel';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import FeatureGate from './components/FeatureGate';
import { useAuthStore, ADMIN_FEATURES } from './store';
import LandingPage from './pages/LandingPage';
import SubscriptionPage from './pages/SubscriptionPage';
import DownloadAppPortal from './pages/DownloadAppPortal';
import api from './services/api';
import POSPage from './pages/POSPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AccountingPage from './pages/AccountingPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import DuesPage from './pages/DuesPage';
import { SettingsPage } from './pages/SettingsPage';
import StaffActivation from './pages/StaffActivation';
import './index.css';

const queryClient = new QueryClient();

function AppLayout() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const setSubscription = useAuthStore((state) => state.setSubscription);
  const setFeatures = useAuthStore((state) => state.setFeatures);
  const navigate = useNavigate();
  const location = useLocation();

  // Web-app enabled/disabled state
  const [webAppEnabled, setWebAppEnabled] = useState<boolean>(true);
  const [webAppStatusLoaded, setWebAppStatusLoaded] = useState<boolean>(false);

  // Fetch web app status (public endpoint, no auth required)
  useEffect(() => {
    api.get('/admin/settings/web-app-status/')
      .then((res) => {
        setWebAppEnabled(res.data.web_app_enabled !== false);
      })
      .catch(() => {
        // Default to enabled if API unavailable (fail-open)
        setWebAppEnabled(true);
      })
      .finally(() => {
        setWebAppStatusLoaded(true);
      });
  }, []);

  // On mount / login, fetch subscription status for non-admin users
  useEffect(() => {
    if (!token) return;
    if (user?.role === 'admin') {
      setFeatures(ADMIN_FEATURES); // admin gets all features
      return;
    }
    api.get('/admin/tenant-subscriptions/my_subscription/').then(res => {
      const sub = res.data;
      setSubscription(sub);
      // Store feature flags from plan
      const fc = sub?.plan_details?.features_config || sub?.plan?.features_config;
      if (fc) {
        setFeatures(fc);
      } else {
        setFeatures(null);
      }
      const isActive = sub?.status === 'active' && (!sub?.expires_at || new Date(sub.expires_at) > new Date());
      const isPending = sub?.status === 'pending';
      const isAdminUser = user?.role === 'admin';
      if (!isActive && !isPending && !isAdminUser && location.pathname !== '/subscribe') {
        navigate('/subscribe');
      }
    }).catch((err) => {
      const isAdminUser = user?.role === 'admin';
      if (err?.response?.status === 404) {
        setSubscription(null);
        setFeatures(null);
        if (!isAdminUser && location.pathname !== '/subscribe') navigate('/subscribe');
        return;
      }
      // If API unreachable, allow access if cached subscription is valid
      const cached = subscription;
      if (!cached || cached.status !== 'active' || (cached.expires_at && new Date(cached.expires_at) <= new Date())) {
        if (!isAdminUser && location.pathname !== '/subscribe') navigate('/subscribe');
      }
    });
  }, [token, user, navigate, location.pathname, subscription]);

  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login initialMode="login" />} />
        <Route path="/signup" element={<Login initialMode="register" />} />
        <Route path="/staff/activate" element={<StaffActivation />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  // Non-admin users without active subscription go to /subscribe
  const isAdmin = user?.role === 'admin';
  const subActive = isAdmin || (subscription?.status === 'active' && (!subscription?.expires_at || new Date(subscription.expires_at) > new Date()));

  // Admins who land on /subscribe (from a previous redirect) should go to dashboard
  if (isAdmin && location.pathname === '/subscribe') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!subActive && location.pathname !== '/subscribe') {
    return <Navigate to="/subscribe" replace />;
  }

  if (location.pathname === '/subscribe') {
    return (
      <Routes>
        <Route path="/subscribe" element={<SubscriptionPage />} />
      </Routes>
    );
  }

  // ─── Web App Disabled Gate ─────────────────────────────────────────────────
  // When web app is turned OFF, regular (non-admin) users see the Download App Portal.
  // They can still navigate to /subscribe and /settings from within the portal.
  // Super Admins are never affected.
  const isNormalUser = !isAdmin;
  const isRestrictedPath = !location.pathname.startsWith('/subscribe') && !location.pathname.startsWith('/settings');

  if (webAppStatusLoaded && !webAppEnabled && isNormalUser) {
    // Allow /subscribe and /settings to render in the portal's own mini-router
    if (location.pathname === '/settings') {
      return (
        <div className="min-h-screen bg-slate-900">
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      );
    }
    if (location.pathname === '/subscribe') {
      return (
        <Routes>
          <Route path="/subscribe" element={<SubscriptionPage />} />
        </Routes>
      );
    }
    // All other routes → show the Download App Portal
    return <DownloadAppPortal />;
  }

  const isSuperAdminView = location.pathname.startsWith('/admin') && user?.role === 'admin';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {!isSuperAdminView && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 relative z-[40]">
        {!isSuperAdminView && <Header />}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<FeatureGate feature="has_pos" label="Sales / POS"><POSPage /></FeatureGate>} />
            <Route path="/transaction-history" element={<FeatureGate feature="has_transaction_history" label="Transaction History"><TransactionHistoryPage /></FeatureGate>} />
            <Route path="/dues" element={<FeatureGate feature="has_dues" label="Dues & Credit"><DuesPage /></FeatureGate>} />
            <Route path="/inventory" element={<FeatureGate feature="has_inventory" label="Inventory"><InventoryPage /></FeatureGate>} />
            <Route path="/customers" element={<FeatureGate feature="has_customer_management" label="Customer Management"><CustomersPage /></FeatureGate>} />
            <Route path="/accounting" element={<FeatureGate feature="has_accounting" label="Accounting"><AccountingPage /></FeatureGate>} />
            <Route path="/analytics" element={<FeatureGate feature="has_analytics" label="Analytics"><AnalyticsPage /></FeatureGate>} />
            
            {/* Pharmacy Branch Manager Panel */}
            <Route path="/branches" element={<FeatureGate feature="has_multi_branch" label="Branch Management"><BranchManagementPanel /></FeatureGate>} />

            {/* Super Admin Panel */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminPanel />} />
            <Route path="/admin/users" element={<AdminPanel />} />
            <Route path="/admin/config" element={<AdminPanel />} />
            <Route path="/admin/logs" element={<AdminPanel />} />
            <Route path="/admin/subscriptions" element={<AdminPanel />} />
            <Route path="/admin/payment-accounts" element={<AdminPanel />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppLayout />
      </Router>
      {/* Global notification & confirm layers — always rendered above everything */}
      <ToastContainer />
      <ConfirmModal />
    </QueryClientProvider>
  );
}

export default App;
