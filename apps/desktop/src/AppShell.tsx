import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  componentStack: string | null;
}

// Normalizes anything that was `throw`-n (Error, string, plain object, undefined) into readable text
function describeThrown(error: any): { name: string; message: string; stack: string } {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message || '(no message)', stack: error.stack || '(no stack)' };
  }
  if (typeof error === 'string') {
    return { name: 'string thrown', message: error, stack: '(no stack — a plain string was thrown, not an Error)' };
  }
  if (error && typeof error === 'object') {
    let json = '(could not stringify)';
    try { json = JSON.stringify(error, Object.getOwnPropertyNames(error)); } catch { /* ignore */ }
    return { name: 'object thrown', message: json, stack: '(no stack — a plain object was thrown, not an Error)' };
  }
  return { name: typeof error, message: String(error), stack: '(no stack)' };
}

class AppShellErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    const info = describeThrown(error);
    console.error('[ErrorBoundary] name:', info.name);
    console.error('[ErrorBoundary] message:', info.message);
    console.error('[ErrorBoundary] stack:', info.stack);
    console.error('[ErrorBoundary] component stack:', errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      const info = describeThrown(this.state.error);
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4 overflow-auto">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Dashboard Error</h1>
            <p className="text-gray-600 text-sm mb-4">{info.name}: {info.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-4"
            >
              Reload Application
            </button>
            <details open className="text-xs bg-gray-50 border border-gray-200 rounded p-3">
              <summary className="cursor-pointer font-semibold text-gray-700 mb-2">Technical details (please screenshot this)</summary>
              <pre className="whitespace-pre-wrap break-words text-gray-600 mt-2">{info.stack}</pre>
              {this.state.componentStack && (
                <pre className="whitespace-pre-wrap break-words text-gray-500 mt-2 border-t pt-2">{this.state.componentStack}</pre>
              )}
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lightweight boundary for individual layout sections (Sidebar/Header/routed page) so a crash
// in one section doesn't take down the whole shell — and we can pinpoint exactly which section failed.
class SectionErrorBoundary extends React.Component<{ label: string; children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    const info = describeThrown(error);
    console.error(`[SectionErrorBoundary:${this.props.label}] name:`, info.name);
    console.error(`[SectionErrorBoundary:${this.props.label}] message:`, info.message);
    console.error(`[SectionErrorBoundary:${this.props.label}] stack:`, info.stack);
    console.error(`[SectionErrorBoundary:${this.props.label}] component stack:`, errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      const info = describeThrown(this.state.error);
      return (
        <div className="p-3 m-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <strong>{this.props.label} failed to load:</strong> {info.name}: {info.message}
          <details className="mt-1">
            <summary className="cursor-pointer">Details</summary>
            <pre className="whitespace-pre-wrap break-words mt-1">{info.stack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
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
  const authStore = useAuthStore();
  const { login: webLogin, setFeatures, setSubscription, setStaffPermissions, token } = authStore;
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
    if (!user) {
      console.log('[AppShell] No user, skipping bridge');
      return;
    }

    let cancelled = false;

    const bridge = async () => {
      try {
        console.log('[AppShell] Starting bridge with user:', user.id);
        
        const storedToken = localStorage.getItem('token');
        const token: string = user.access_token || storedToken || '';

        if (cancelled) {
          console.log('[AppShell] Bridge cancelled');
          return;
        }

        if (!token) {
          console.warn('[AppShell] No token available');
          setDesktopUser(null);
          return;
        }

        localStorage.setItem('token', token);
        console.log('[AppShell] Token stored:', token.substring(0, 20) + '...');

        // Build web user object
        const webUser = {
          id: user.id,
          username: user.name,
          name: user.name,
          email: user.email,
          role: user.role,
          staff_permissions: (user as any).staff_permissions ?? null,
          is_staff_member: !!(user as any).staff_permissions,
        };

        // Call all store setters synchronously (they don't wait)
        console.log('[AppShell] Calling store setters...');
        webLogin(token, webUser);
        setFeatures(user.features ?? null);
        if ((user as any).staff_permissions) {
          setStaffPermissions((user as any).staff_permissions);
        }
        setSubscription(
          user.subscription_status
            ? {
                status: user.subscription_status,
                expires_at: user.subscription_expires_at || null,
                plan: { features_config: user.features },
              }
            : null
        );

        console.log('[AppShell] All store setters called, setting tokenReady=true');
        
        // Give store setters a micro-task to complete
        await Promise.resolve();
        
        if (cancelled) return;
        setTokenReady(true);
        console.log('[AppShell] Bridge complete');
      } catch (err) {
        console.error('[AppShell] Bridge error:', err instanceof Error ? err.message : String(err));
        console.error('[AppShell] Error stack:', err instanceof Error ? err.stack : 'N/A');
        if (!cancelled) {
          setDesktopUser(null);
        }
      }
    };

    bridge();
    return () => { cancelled = true; };
  }, [user.id, webLogin, setFeatures, setSubscription, setStaffPermissions, setDesktopUser]);

  // Logout bridge: if web auth is cleared (user clicks logout in Header), also clear desktop license
  useEffect(() => {
    if (tokenReady && !token) {
      setDesktopUser(null);
    }
  }, [token, tokenReady]);

  return (
    <AppShellErrorBoundary>
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
              <SectionErrorBoundary label="Sidebar">
                <Sidebar />
              </SectionErrorBoundary>
              <div className="flex-1 flex flex-col min-w-0 relative z-[40]">
                <SectionErrorBoundary label="Header">
                  <Header />
                </SectionErrorBoundary>
                {readOnly && (
                  <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-400 font-medium">
                    Read-only mode — validate your license to resume full access
                  </div>
                )}
                <main className="flex-1 overflow-auto">
                  <SectionErrorBoundary label="Page content">
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
                  </SectionErrorBoundary>
                </main>
              </div>
            </div>
          )}
        </Router>
      </QueryClientProvider>
    </AppShellErrorBoundary>
  )
}
