import React, { useState, useRef, useEffect } from 'react';
import { Shield, Eye, EyeOff, Wifi, WifiOff, ArrowLeft, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { useLicenseStore } from '../store/licenseStore';

interface Props {
  onSuccess: () => void;
}

const api = (window as any).electronAPI;
const IS_ELECTRON = !!api;
const DJANGO_URL = 'https://pharmacy-django-fj01.onrender.com';

// Browser (non-Electron) fallback: calls the local Django server directly
async function browserLogin(email: string, password: string) {
  try {
    const response = await fetch(`${DJANGO_URL}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.detail || 'Invalid credentials' };
    }

    const token = data.access;
    if (!token) {
      return { success: false, error: 'Login succeeded but no access token was returned.' };
    }

    const subscriptionRes = await fetch(`${DJANGO_URL}/api/v1/admin/tenant-subscriptions/my_subscription/`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!subscriptionRes.ok) {
      if (subscriptionRes.status === 404) {
        return { success: false, code: 'NO_ACTIVE_SUBSCRIPTION', error: 'No active subscription found for this account.' };
      }
      return { success: false, error: 'Could not verify subscription. Please try again.' };
    }

    const subscription = await subscriptionRes.json();
    const features = subscription?.plan_details?.features_config || subscription?.plan?.features_config || null;
    const subStatus = subscription?.status;
    const subExpiresAt = subscription?.expires_at || null;

    const isActive = subStatus === 'active' && (!subExpiresAt || new Date(subExpiresAt) > new Date());
    if (!isActive) {
      return { success: false, code: 'SUBSCRIPTION_EXPIRED', error: 'Your subscription is not active.' };
    }

    if (!features?.has_desktop_app) {
      return { success: false, code: 'NO_DESKTOP_ACCESS', error: 'Your plan does not include desktop access.' };
    }

    const userPayload = data.user || {};
    const role = data.role || userPayload.role || 'user';
    const userIdRaw = userPayload.id;
    const userId = Number(userIdRaw);

    return {
      success: true,
      user: {
        id: Number.isFinite(userId) ? userId : 1,
        name: userPayload.name || userPayload.username || email,
        email: userPayload.email || (email.includes('@') ? email : `${email}@local`),
        role,
        license_type: 'MONTHLY' as const,
        access_token: token,
        subscription_status: subStatus,
        subscription_expires_at: subExpiresAt,
      },
      features,
      lockState: { locked: false, read_only: false },
    };
  } catch {
    return { success: false, error: 'Cannot connect to local server. Make sure the app is running.' };
  }
}

// ─── Forgot Password API helpers ─────────────────────────────────────────────

async function sendForgotOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${DJANGO_URL}/api/v1/auth/password-reset/send-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.detail || 'Failed to send OTP.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot connect to server.' };
  }
}

async function confirmResetOtp(
  email: string,
  otp: string,
  new_password: string,
  confirm_password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${DJANGO_URL}/api/v1/auth/password-reset/confirm-reset-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password, confirm_password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.detail || 'Failed to reset password.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Cannot connect to server.' };
  }
}

// ─── OTP Input component ──────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, disabled }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = [...digits];
      if (arr[idx] !== '' && arr[idx] !== ' ') {
        arr[idx] = '';
        onChange(arr.join('').replace(/ /g, ''));
      } else if (idx > 0) {
        arr[idx - 1] = '';
        onChange(arr.join('').replace(/ /g, ''));
        refs.current[idx - 1]?.focus();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = [...digits];
    arr[idx] = char;
    onChange(arr.join('').replace(/ /g, ''));
    if (char && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[idx] === ' ' ? '' : (digits[idx] || '')}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKey(e, idx)}
          disabled={disabled}
          className={`
            w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-slate-900 text-white
            transition-all duration-200 focus:outline-none
            ${digits[idx] && digits[idx] !== ' '
              ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
              : 'border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{ caretColor: 'transparent' }}
        />
      ))}
    </div>
  );
};

// ─── Screens ──────────────────────────────────────────────────────────────────

type Screen =
  | 'login'
  | 'forgot-email' | 'forgot-otp' | 'forgot-newpass' | 'forgot-done'
  | 'staff-email' | 'staff-otp' | 'staff-newpass' | 'staff-done';

export const ActivationScreen: React.FC<Props> = ({ onSuccess }) => {
  const [screen, setScreen] = useState<Screen>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setLockState } = useLicenseStore();

  // Forgot password shared state
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpConfirmPass, setFpConfirmPass] = useState('');
  const [fpShowNew, setFpShowNew] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpResendCooldown, setFpResendCooldown] = useState(0);

  // Staff activation shared state
  const [saEmail, setSaEmail] = useState('');
  const [saOtp, setSaOtp] = useState('');
  const [saNewPass, setSaNewPass] = useState('');
  const [saConfirmPass, setSaConfirmPass] = useState('');
  const [saShowNew, setSaShowNew] = useState(false);
  const [saShowConfirm, setSaShowConfirm] = useState(false);
  const [saLoading, setSaLoading] = useState(false);
  const [saError, setSaError] = useState('');
  const [saResendCooldown, setSaResendCooldown] = useState(0);

  // Countdown timer for resend (shared for both forgot-pw and staff activation)
  useEffect(() => {
    if (fpResendCooldown <= 0) return;
    const t = setTimeout(() => setFpResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [fpResendCooldown]);

  useEffect(() => {
    if (saResendCooldown <= 0) return;
    const t = setTimeout(() => setSaResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [saResendCooldown]);

  // ── Login handler ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = IS_ELECTRON
        ? await api.invoke('auth:login', { email, password })
        : await browserLogin(email, password);

      if (!result.success) {
        const codeMessages: Record<string, string> = {
          PENDING_APPROVAL: 'Your account is awaiting admin approval.',
          SUSPENDED: 'Your account has been suspended. Contact support.',
          NO_ACTIVE_SUBSCRIPTION: 'No active subscription found. Please subscribe first.',
          DEVICE_LIMIT: 'Lifetime license allows one device only. Contact support to transfer.',
          DEVICE_REVOKED: 'This device has been revoked. Contact support.',
          NO_DESKTOP_ACCESS: 'Your current plan does not include Desktop App access. Please upgrade to the Enterprise plan.',
          SUBSCRIPTION_EXPIRED: 'Your subscription has expired. Please renew to continue using the desktop app.',
        };
        setError(codeMessages[result.code] || result.error || 'Login failed');
        return;
      }

      setUser({ ...result.user, features: result.features ?? undefined });
      setLockState(result.lockState || { locked: false, read_only: false });
      onSuccess();
    } catch {
      setError('Connection error. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot step 1 — send OTP ─────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);
    const { ok, error: err } = await sendForgotOtp(fpEmail);
    setFpLoading(false);
    if (!ok) { setFpError(err || 'Failed to send OTP.'); return; }
    setFpOtp('');
    setFpResendCooldown(60);
    setScreen('forgot-otp');
  };

  // ── Forgot step 2 — verify OTP ───────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpOtp.length < 6) { setFpError('Please enter the full 6-digit code.'); return; }
    // Just advance; actual verification happens on password submit
    setFpError('');
    setScreen('forgot-newpass');
  };

  // ── Forgot step 3 — set new password ────────────────────────────────────────
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (fpNewPass !== fpConfirmPass) { setFpError('Passwords do not match.'); return; }
    setFpLoading(true);
    const { ok, error: err } = await confirmResetOtp(fpEmail, fpOtp, fpNewPass, fpConfirmPass);
    setFpLoading(false);
    if (!ok) { setFpError(err || 'Failed to reset password.'); return; }
    setScreen('forgot-done');
  };

  // ── Resend OTP (forgot password) ─────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (fpResendCooldown > 0) return;
    setFpError('');
    setFpLoading(true);
    const { ok, error: err } = await sendForgotOtp(fpEmail);
    setFpLoading(false);
    if (!ok) { setFpError(err || 'Failed to resend OTP.'); return; }
    setFpResendCooldown(60);
    setFpOtp('');
  };

  // ── Staff Activation handlers ──────────────────────────────────────────────

  const handleSendActivationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaError('');
    setSaLoading(true);
    const { ok, error: err } = await sendStaffActivationOtp(saEmail);
    setSaLoading(false);
    if (!ok) { setSaError(err || 'Failed to send OTP.'); return; }
    setSaOtp('');
    setSaResendCooldown(60);
    setScreen('staff-otp');
  };

  const handleVerifyActivationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saOtp.length < 6) { setSaError('Please enter the full 6-digit code.'); return; }
    setSaError('');
    setScreen('staff-newpass');
  };

  const handleCompleteActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaError('');
    if (saNewPass !== saConfirmPass) { setSaError('Passwords do not match.'); return; }
    if (saNewPass.length < 8) { setSaError('Password must be at least 8 characters.'); return; }
    setSaLoading(true);
    const { ok, error: err } = await acceptStaffInvite(saEmail, saOtp, saNewPass, saConfirmPass);
    setSaLoading(false);
    if (!ok) { setSaError(err || 'Activation failed.'); return; }
    setScreen('staff-done');
  };

  const handleResendActivationOtp = async () => {
    if (saResendCooldown > 0) return;
    setSaError('');
    setSaLoading(true);
    const { ok, error: err } = await sendStaffActivationOtp(saEmail);
    setSaLoading(false);
    if (!ok) { setSaError(err || 'Failed to resend OTP.'); return; }
    setSaResendCooldown(60);
    setSaOtp('');
  };

  // ── Shared card wrapper ───────────────────────────────────────────────────────
  const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-2xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Medicly</h1>
          <p className="text-slate-400 mt-1">Professional Pharmacy Management</p>
        </div>
        {children}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // SCREEN: Login
  // ════════════════════════════════════════════════════════════
  if (screen === 'login') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username or Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="Enter your username or email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => { setFpEmail(''); setFpError(''); setScreen('forgot-email'); }}
                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In & Activate'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <span>Internet required for first login</span>
            <span className="flex items-center gap-1">
              {navigator.onLine ? (
                <><Wifi className="w-3 h-3 text-green-400" /><span className="text-green-400">Online</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">Offline</span></>
              )}
            </span>
          </div>
        </div>

        {/* Staff activation link */}
        <p className="text-center text-slate-500 text-xs mt-4">
          New staff member?{' '}
          <button
            type="button"
            onClick={() => { setSaEmail(''); setSaError(''); setScreen('staff-email'); }}
            className="text-blue-400 hover:text-blue-300 hover:underline focus:outline-none font-medium"
          >
            Activate your account
          </button>
        </p>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Forgot — Step 1 (Enter Email)
  // ════════════════════════════════════════════════════════════
  if (screen === 'forgot-email') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          {/* Back button */}
          <button
            type="button"
            onClick={() => { setFpError(''); setScreen('login'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </button>

          {/* Icon + heading */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Forgot Password</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Enter the email address associated with your account and we'll send you a one-time verification code.
          </p>

          {fpError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {fpError}
            </div>
          )}

          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                required
                disabled={fpLoading}
                autoFocus
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={fpLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              {fpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending Code…
                </span>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Forgot — Step 2 (Enter OTP)
  // ════════════════════════════════════════════════════════════
  if (screen === 'forgot-otp') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          {/* Back button */}
          <button
            type="button"
            onClick={() => { setFpError(''); setScreen('forgot-email'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Icon + heading */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Enter Verification Code</h2>
          </div>
          <p className="text-slate-400 text-sm mb-1 leading-relaxed">
            We sent a 6-digit code to
          </p>
          <p className="text-blue-400 font-medium text-sm mb-6 truncate">{fpEmail}</p>

          {fpError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {fpError}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <OtpInput value={fpOtp} onChange={setFpOtp} disabled={fpLoading} />

            <button
              type="submit"
              disabled={fpLoading || fpOtp.length < 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-40 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              Verify Code
            </button>
          </form>

          {/* Resend */}
          <div className="mt-5 text-center text-sm text-slate-500">
            Didn't receive a code?{' '}
            {fpResendCooldown > 0 ? (
              <span className="text-slate-400">Resend in {fpResendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={fpLoading}
                className="text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50 focus:outline-none"
              >
                Resend Code
              </button>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Forgot — Step 3 (New Password)
  // ════════════════════════════════════════════════════════════
  if (screen === 'forgot-newpass') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          {/* Back button */}
          <button
            type="button"
            onClick={() => { setFpError(''); setScreen('forgot-otp'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Icon + heading */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Create New Password</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Choose a strong password. It must be at least 8 characters, start with a capital letter, and contain <span className="text-slate-300">_</span> or <span className="text-slate-300">@</span>.
          </p>

          {fpError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {fpError}
            </div>
          )}

          <form onSubmit={handleSetNewPassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={fpShowNew ? 'text' : 'password'}
                  value={fpNewPass}
                  onChange={(e) => setFpNewPass(e.target.value)}
                  required
                  disabled={fpLoading}
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition pr-12"
                  placeholder="New password"
                />
                <button
                  type="button"
                  onClick={() => setFpShowNew(!fpShowNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {fpShowNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={fpShowConfirm ? 'text' : 'password'}
                  value={fpConfirmPass}
                  onChange={(e) => setFpConfirmPass(e.target.value)}
                  required
                  disabled={fpLoading}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition pr-12"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setFpShowConfirm(!fpShowConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {fpShowConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password match indicator */}
            {fpConfirmPass && (
              <p className={`text-xs flex items-center gap-1.5 ${fpNewPass === fpConfirmPass ? 'text-green-400' : 'text-red-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${fpNewPass === fpConfirmPass ? 'bg-green-400' : 'bg-red-400'}`} />
                {fpNewPass === fpConfirmPass ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}

            <button
              type="submit"
              disabled={fpLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg mt-2"
            >
              {fpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating Password…
                </span>
              ) : (
                'Set New Password'
              )}
            </button>
          </form>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Staff Activation — Step 1 (Enter Email)
  // ════════════════════════════════════════════════════════════
  if (screen === 'staff-email') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => { setSaError(''); setScreen('login'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Activate Staff Account</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Enter the email address your administrator used to invite you. We'll send a one-time code to activate your account.
          </p>

          {saError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{saError}</div>
          )}

          <form onSubmit={handleSendActivationOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Your Email Address</label>
              <input
                type="email"
                value={saEmail}
                onChange={(e) => setSaEmail(e.target.value)}
                required
                disabled={saLoading}
                autoFocus
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                placeholder="you@pharmacy.com"
              />
            </div>
            <button
              type="submit"
              disabled={saLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              {saLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending Code…
                </span>
              ) : 'Send Activation Code'}
            </button>
          </form>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Staff Activation — Step 2 (Enter OTP)
  // ════════════════════════════════════════════════════════════
  if (screen === 'staff-otp') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => { setSaError(''); setScreen('staff-email'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Enter Activation Code</h2>
          </div>
          <p className="text-slate-400 text-sm mb-1">We sent a 6-digit code to</p>
          <p className="text-cyan-400 font-medium text-sm mb-6 truncate">{saEmail}</p>

          {saError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{saError}</div>
          )}

          <form onSubmit={handleVerifyActivationOtp} className="space-y-6">
            <OtpInput value={saOtp} onChange={setSaOtp} disabled={saLoading} />
            <button
              type="submit"
              disabled={saLoading || saOtp.length < 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
            >
              Verify Code
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500">
            Didn't receive a code?{' '}
            {saResendCooldown > 0 ? (
              <span className="text-slate-400">Resend in {saResendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResendActivationOtp}
                disabled={saLoading}
                className="text-cyan-400 hover:text-cyan-300 hover:underline disabled:opacity-50 focus:outline-none"
              >
                Resend Code
              </button>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Staff Activation — Step 3 (Set Password)
  // ════════════════════════════════════════════════════════════
  if (screen === 'staff-newpass') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => { setSaError(''); setScreen('staff-otp'); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Create Your Password</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Set a secure password for your staff account. You'll use this to sign in on any device.
          </p>

          {saError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{saError}</div>
          )}

          <form onSubmit={handleCompleteActivation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={saShowNew ? 'text' : 'password'}
                  value={saNewPass}
                  onChange={(e) => setSaNewPass(e.target.value)}
                  required
                  disabled={saLoading}
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition pr-12"
                  placeholder="New password"
                />
                <button type="button" onClick={() => setSaShowNew(!saShowNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {saShowNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={saShowConfirm ? 'text' : 'password'}
                  value={saConfirmPass}
                  onChange={(e) => setSaConfirmPass(e.target.value)}
                  required
                  disabled={saLoading}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition pr-12"
                  placeholder="Confirm password"
                />
                <button type="button" onClick={() => setSaShowConfirm(!saShowConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {saShowConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {saConfirmPass && (
              <p className={`text-xs flex items-center gap-1.5 ${saNewPass === saConfirmPass ? 'text-green-400' : 'text-red-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${saNewPass === saConfirmPass ? 'bg-green-400' : 'bg-red-400'}`} />
                {saNewPass === saConfirmPass ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}

            <button
              type="submit"
              disabled={saLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg mt-2"
            >
              {saLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Activating…
                </span>
              ) : 'Activate Account'}
            </button>
          </form>
        </div>
      </PageWrapper>
    );
  }

  // ════════════════════════════════════════════════════════════
  // SCREEN: Staff Activation — Done
  // ════════════════════════════════════════════════════════════
  if (screen === 'staff-done') {
    return (
      <PageWrapper>
        <div className="bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-2xl mb-5">
            <CheckCircle2 className="w-9 h-9 text-cyan-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Account Activated!</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Your staff account has been activated successfully.
            You can now sign in with your email and new password.
          </p>
          <button
            type="button"
            onClick={() => {
              setSaEmail(''); setSaOtp(''); setSaNewPass(''); setSaConfirmPass('');
              setSaError(''); setError('');
              setScreen('login');
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
          >
            Sign In Now
          </button>
        </div>
      </PageWrapper>
    );
  }

  return null;
};
