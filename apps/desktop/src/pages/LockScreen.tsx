import React, { useState } from 'react';
import { Lock, RefreshCw, AlertTriangle, Clock, ShieldOff, CreditCard, LogOut } from 'lucide-react';
import { LockReason, useLicenseStore } from '../store/licenseStore';

interface Props {
  reason?: LockReason;
  warning?: string;
  daysRemaining?: number;
  onUnlocked: () => void;
}

const api = (window as any).electronAPI;

const REASON_CONFIG: Record<string, { icon: React.ReactNode; title: string; description: string; color: string }> = {
  no_license: {
    icon: <Lock className="w-10 h-10" />,
    title: 'Activation Required',
    description: 'Please sign in to activate PharmacyPro on this device.',
    color: 'blue',
  },
  validation_overdue: {
    icon: <Clock className="w-10 h-10" />,
    title: 'Online Validation Required',
    description: 'Your license requires online validation every 30 days. Please connect to the internet.',
    color: 'yellow',
  },
  subscription_expired: {
    icon: <CreditCard className="w-10 h-10" />,
    title: 'Subscription Expired',
    description: 'Your subscription has expired. Renew to continue using PharmacyPro.',
    color: 'red',
  },
  license_expired: {
    icon: <AlertTriangle className="w-10 h-10" />,
    title: 'License Expired',
    description: 'Your license has expired. Please contact support.',
    color: 'red',
  },
  device_mismatch: {
    icon: <ShieldOff className="w-10 h-10" />,
    title: 'Device Not Authorized',
    description: 'This device is not authorized for your license. You can still view data and export backups.',
    color: 'orange',
  },
  suspended: {
    icon: <ShieldOff className="w-10 h-10" />,
    title: 'Account Suspended',
    description: 'Your account has been suspended. Contact support for assistance.',
    color: 'red',
  },
  pending_approval: {
    icon: <Clock className="w-10 h-10" />,
    title: 'Awaiting Approval',
    description: 'Your account is pending admin approval. Please check back later.',
    color: 'blue',
  },
};

const COLOR_CLASSES: Record<string, string> = {
  blue: 'from-blue-500 to-cyan-500',
  yellow: 'from-yellow-500 to-orange-500',
  red: 'from-red-500 to-rose-600',
  orange: 'from-orange-500 to-yellow-500',
};

export const LockScreen: React.FC<Props> = ({ reason = 'no_license', warning, daysRemaining, onUnlocked }) => {
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState('');
  const { logout } = useLicenseStore();
  const config = REASON_CONFIG[reason] || REASON_CONFIG.no_license;
  const colorClass = COLOR_CLASSES[config.color] || COLOR_CLASSES.blue;

  const handleValidate = async () => {
    setValidating(true);
    setMessage('');
    try {
      const result = await api.invoke('license:validate-online');
      if (result.success) {
        setMessage('Validation successful!');
        setTimeout(() => onUnlocked(), 1000);
      } else {
        setMessage(result.error || 'Validation failed. Try again.');
      }
    } catch {
      setMessage('Server unreachable. Check internet connection.');
    } finally {
      setValidating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const readOnly = reason === 'device_mismatch' || reason === 'subscription_expired';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Icon */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${colorClass} rounded-2xl mb-4 shadow-2xl text-white`}>
            {config.icon}
          </div>
          <h1 className="text-3xl font-bold text-white">PharmacyPro</h1>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-2">{config.title}</h2>
          <p className="text-slate-400 mb-6">{warning || config.description}</p>

          {daysRemaining !== undefined && daysRemaining < 0 && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              Expired {Math.abs(daysRemaining)} day(s) ago
            </div>
          )}

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.includes('successful')
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-3">
            {(reason === 'validation_overdue') && (
              <button
                onClick={handleValidate}
                disabled={validating}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className={`w-4 h-4 ${validating ? 'animate-spin' : ''}`} />
                {validating ? 'Validating…' : 'Validate Online Now'}
              </button>
            )}

            {readOnly && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm">
                <strong>Read-only mode active:</strong> You can view records and export backups. Sales and editing are disabled.
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          Need help? Contact{' '}
          <a href="mailto:support@pharmacypro.com" className="text-blue-500 hover:underline">
            support@pharmacypro.com
          </a>
        </p>
      </div>
    </div>
  );
};
