import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { authService } from '../services/api';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  initialMode?: 'login' | 'register';
}

const validatePassword = (pwd: string): string | null => {
  if (pwd.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/^[A-Z]/.test(pwd)) {
    return 'First character of the password must be capital.';
  }
  if (!pwd.includes('_') && !pwd.includes('@')) {
    return 'Password must contain at least one special character: _ or @.';
  }
  if (/\s/.test(pwd)) {
    return 'Password must not contain spaces.';
  }
  return null;
};

export const Login: React.FC<LoginProps> = ({ initialMode = 'login' }) => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(() => {
    const m = searchParams.get('mode');
    if (m === 'forgot') return 'forgot';
    return initialMode;
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'forgot') {
      setMode('forgot');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.login(username, password);
      login(response.data.access, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (!pharmacyName.trim()) {
      setError('Pharmacy Name is required.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register/send-otp/', {
        username,
        email,
        password,
        pharmacy_name: pharmacyName,
      });
      setOtpSent(true);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to send verification code. Check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp) {
      setError('Verification code is required.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/register/', {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        pharmacy_name: pharmacyName,
        otp,
      });
      login(response.data.access, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Registration failed. Check the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/send-otp/', { email });
      setOtpSent(true);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to request reset. Make sure the email is registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (!otp) {
      setError('Verification code is required.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm-reset-otp/', {
        email,
        otp,
        new_password: password,
        confirm_password: confirmPassword,
      });
      setResetSuccess('Password reset successfully! Redirecting you to sign in...');
      setTimeout(() => {
        switchMode('login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to reset password. Check the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setError('');
    setResetSuccess('');
    setOtpSent(false);
    setUsername('');
    setEmail('');
    setPharmacyName('');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">💊</span>
          </div>
          <h1 className="text-3xl font-bold text-white">PharmacyPro</h1>
          <p className="text-blue-200 mt-1">Complete Pharmacy Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          {mode !== 'forgot' && (
            <div className="flex">
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-gray-50 text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'bg-gray-50 text-gray-500 hover:text-gray-700'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            {resetSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {resetSuccess}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email</label>
                  <input
                    type="text"
                    placeholder="Enter your username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-blue-600 hover:text-blue-500 hover:underline focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : mode === 'register' ? (
              otpSent ? (
                <form onSubmit={handleRegisterConfirm} className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Verify Your Email</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    A 6-digit verification code has been sent to <span className="font-semibold text-gray-700">{email}</span>. Please enter it below.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Verifying...' : 'Verify & Register'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-500 mt-2 block"
                  >
                    Back to Edit Details
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterInit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="My Pharmacy Ltd."
                      value={pharmacyName}
                      onChange={(e) => setPharmacyName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-150">
                    <p className="font-semibold text-gray-500">Password requirements:</p>
                    <ul className="list-disc list-inside">
                      <li>At least 8 characters long</li>
                      <li>First letter must be Capital (A-Z)</li>
                      <li>At least one special character: _ or @</li>
                      <li>No spaces allowed</li>
                    </ul>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Sending verification...' : 'Create Account'}
                  </button>
                </form>
              )
            ) : (
              otpSent ? (
                <form onSubmit={handleForgotPasswordConfirm} className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-1">Reset Password</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Enter the code sent to your email and set your new password.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-150">
                    <p className="font-semibold text-gray-500">Password requirements:</p>
                    <ul className="list-disc list-inside">
                      <li>At least 8 characters long</li>
                      <li>First letter must be Capital (A-Z)</li>
                      <li>At least one special character: _ or @</li>
                      <li>No spaces allowed</li>
                    </ul>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-500 mt-2 block"
                  >
                    Resend Code / Change Email
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotPasswordInit} className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-2">Reset Password</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your email address and we'll send you an OTP code to verify and reset your password.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? 'Sending code...' : 'Send Verification Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-500 mt-2 block"
                  >
                    Back to Sign In
                  </button>
                </form>
              )
            )}
          </div>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          © 2026 PharmacyPro. All rights reserved.
        </p>
      </div>
    </div>
  );
};

