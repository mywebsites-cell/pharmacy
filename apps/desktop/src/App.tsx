import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLicenseStore } from './store/licenseStore';
import { ActivationScreen } from './pages/ActivationScreen';
import { LockScreen } from './pages/LockScreen';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { Download, CheckCircle2, X } from 'lucide-react';

// --- Lazy import the main app shell (same as existing frontend) ---
// We reuse all existing pages from the web frontend
const AppShell = React.lazy(() => import('./AppShell'));

const api = (window as any).electronAPI;
const isElectron = !!(window as any).electronAPI;

type UpdateState = 'idle' | 'downloading' | 'ready';

export default function App() {
  const { user, lockState, setLockState, setUser, setOnline, refreshLockState } = useLicenseStore();
  const [booting, setBooting] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // \u2500\u2500 Update state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Check license on startup
  useEffect(() => {
    const boot = async () => {
      if (isElectron) {
        // 5-second timeout so a hanging IPC never blocks the app forever
        await Promise.race([
          refreshLockState(),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);
      }
      setBooting(false);
    };
    boot();

    // Online/offline events
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Silent background updater listener ─────────────────────────────────
  useEffect(() => {
    if (!isElectron || !api?.on) return;

    api.on('updater:update-available', (info: any) => {
      setUpdateState('downloading');
      setUpdateVersion(info.version);
    });

    api.on('updater:download-progress', (progress: any) => {
      setDownloadPercent(Math.round(progress.percent ?? 0));
    });

    api.on('updater:update-ready', (info: any) => {
      setUpdateState('ready');
      setUpdateVersion(info.version);
      setDownloadPercent(100);
    });

    return () => {
      api.removeAllListeners?.('updater:update-available');
      api.removeAllListeners?.('updater:download-progress');
      api.removeAllListeners?.('updater:update-ready');
    };
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading PharmacyPro…</p>
        </div>
      </div>
    );
  }

  // Not logged in — show activation/login screen
  if (!user) {
    return <ActivationScreen onSuccess={() => refreshLockState()} />;
  }

  // Locked (not read-only) — full lock screen
  if (lockState.locked && !lockState.read_only) {
    return (
      <LockScreen
        reason={lockState.reason}
        warning={lockState.warning}
        daysRemaining={lockState.days_remaining}
        onUnlocked={() => refreshLockState()}
      />
    );
  }

  // Main app — with optional warning banner
  const daysRemaining = lockState.days_remaining ?? 999;

  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <div className="flex flex-col h-screen">
        {/* Subscription expiry warning banner */}
        {!bannerDismissed && daysRemaining <= 5 && (
          <SubscriptionBanner
            daysRemaining={daysRemaining}
            expiresAt={user.subscription_expires_at}
            licenseType={user.license_type}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        {/* Read-only mode banner */}
        {lockState.read_only && (
          <div className="bg-orange-900/80 border-b border-orange-500/50 px-4 py-2 text-orange-200 text-sm text-center">
            <strong>Read-only mode:</strong> Viewing records only. Sales and editing are disabled.
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <AppShell readOnly={lockState.read_only} user={user} />
        </div>

        {/* ── Subtle update-ready banner at the very bottom ────────────────── */}
        {!updateDismissed && updateState === 'downloading' && (
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/90 border-t border-blue-700/50 text-blue-100 text-xs">
            <Download size={13} className="animate-pulse flex-shrink-0" />
            <span>
              Downloading update {updateVersion ? `v${updateVersion}` : ''}… {downloadPercent}%
            </span>
            <div className="flex-1 h-1 bg-blue-800 rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
          </div>
        )}

        {!updateDismissed && updateState === 'ready' && (
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-900/90 border-t border-emerald-700/50 text-emerald-100 text-xs">
            <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-400" />
            <span>
              Update {updateVersion ? `v${updateVersion}` : ''} ready — will install automatically when you close the app.
            </span>
            <button
              onClick={() => setUpdateDismissed(true)}
              className="ml-auto text-emerald-400 hover:text-emerald-200 transition-colors"
              aria-label="Dismiss update notification"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </React.Suspense>
  );
}
