import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function StaffActivation() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'otp' | 'password' | 'done'>('otp');
  const [form, setForm] = useState({
    email: '',
    otp: '',
    username: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/pharmacy/branch-staff/accept_invite/', form);
      setStep('done');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl shadow-blue-500/30 mb-4 text-3xl">
            💊
          </div>
          <h1 className="text-2xl font-bold text-white">Medicly</h1>
          <p className="text-blue-300/70 text-sm mt-1">Staff Account Activation</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {step === 'done' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Account Activated!</h2>
              <p className="text-slate-400 text-sm mb-6">
                Your staff account has been created. You can now log in with your username and password.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Activate Your Account</h2>
                <p className="text-slate-400 text-sm">
                  Enter the 6-digit code from your invitation email, choose a username and set a secure password.
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Invitation Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                />
              </div>

              {/* OTP */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Invitation Code (OTP)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={form.otp}
                  onChange={(e) => set('otp', e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Choose a Username</label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  placeholder="e.g. ali_pharmacist"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={(e) => set('confirm_password', e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Activating…
                  </>
                ) : (
                  'Activate Account'
                )}
              </button>

              <p className="text-center text-slate-500 text-xs">
                Already activated?{' '}
                <button type="button" onClick={() => navigate('/login')} className="text-blue-400 hover:text-blue-300 transition">
                  Log in here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
