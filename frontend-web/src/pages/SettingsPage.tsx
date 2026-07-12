import React, { useState, useEffect } from 'react';
import { Lock, Key, RefreshCw, AlertCircle, CheckCircle, Shield, CreditCard, Info } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store';

export const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isElectron = !!(window as any).electronAPI;

  // Change password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Desktop license states
  const [desktopLicense, setDesktopLicense] = useState<any>(null);
  const [desktopLockState, setDesktopLockState] = useState<any>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (isElectron) {
      fetchDesktopStatus();
    }
  }, [isElectron]);

  const fetchDesktopStatus = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('license:get-status');
      if (result) {
        setDesktopLicense(result.license);
        setDesktopLockState(result.lockState);
      }
    } catch (err) {
      console.error('Failed to get desktop status:', err);
    }
  };

  const handleValidation = async () => {
    setValidationLoading(true);
    setValidationMessage('');
    try {
      const result = await (window as any).electronAPI.invoke('license:validate-online');
      if (result.success) {
        setValidationMessage(result.offlineFallback ? 'Validation completed offline using cached state.' : 'Subscription validated online successfully!');
        await fetchDesktopStatus();
        // Force refresh lock state in global store if method available
        if (typeof (window as any).location?.reload === 'function') {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setValidationMessage(result.error || 'Online validation failed.');
      }
    } catch {
      setValidationMessage('Central server unreachable. Please check your internet connection.');
    } finally {
      setValidationLoading(false);
    }
  };

  const handleRenew = async () => {
    try {
      await (window as any).electronAPI.invoke('app:open-renewal-page');
    } catch (err) {
      console.error('Failed to open renewal page:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    const validatePassword = (pwd: string): string | null => {
      if (pwd.length < 8) {
        return 'New password must be at least 8 characters long.';
      }
      if (!/^[A-Z]/.test(pwd)) {
        return 'First character of the new password must be capital.';
      }
      if (!pwd.includes('_') && !pwd.includes('@')) {
        return 'New password must contain at least one special character: _ or @.';
      }
      if (/\s/.test(pwd)) {
        return 'New password must not contain spaces.';
      }
      return null;
    };

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setPasswordError(pwdError);
      return;
    }

    setPasswordLoading(true);

    try {
      if (isElectron) {
        // Desktop app: calls whitelisted IPC to change password on both local and cloud databases
        const result = await (window as any).electronAPI.invoke('auth:change-password', {
          current_password: currentPassword,
          new_password: newPassword,
        });

        if (result.success) {
          setPasswordSuccess('Password changed successfully on both local and cloud databases!');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setPasswordError(result.error || 'Password change failed.');
        }
      } else {
        // Web application: directly calls the backend REST API
        const response = await api.post('/auth/change-password/', {
          current_password: currentPassword,
          new_password: newPassword,
        });

        setPasswordSuccess(response.data.detail || 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || err.response?.data?.error || 'Password change failed. Verify your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Account Settings</h1>
          <p className="text-gray-500 text-sm">Manage your profile, security credentials, and application subscription.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" /> Profile Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Username</label>
                <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                  {user?.username}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Email</label>
                <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                  {user?.email || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Role</label>
                <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium capitalize">
                  {user?.role?.replace('_', ' ').toLowerCase()}
                </div>
              </div>
              {isElectron && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Local Server Port</label>
                  <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-mono text-sm">
                    8001 (Django local)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" /> Change Password
            </h2>

            {passwordError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" /> {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  placeholder="••••••••"
                />
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
                disabled={passwordLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition flex items-center gap-2"
              >
                {passwordLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" /> Change Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Desktop Subscription / Device Sidebar Info */}
        {isElectron && desktopLicense && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" /> Subscription Status
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">License Plan</label>
                  <div className="font-bold text-gray-800 text-lg">{desktopLicense.license_type}</div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Expiry Date</label>
                  <div className="font-medium text-gray-700">
                    {desktopLicense.expires_at ? new Date(desktopLicense.expires_at).toLocaleDateString() : 'Lifetime Access'}
                  </div>
                </div>

                {desktopLockState && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Status Info</label>
                    {desktopLockState.reason === 'subscription_expired' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                )}

                {validationMessage && (
                  <div className={`p-3 rounded-lg text-xs ${
                    validationMessage.includes('successfully') || validationMessage.includes('completed')
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {validationMessage}
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleValidation}
                    disabled={validationLoading}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${validationLoading ? 'animate-spin' : ''}`} />
                    Check Subscription Status
                  </button>

                  {desktopLockState?.reason === 'subscription_expired' && (
                    <button
                      onClick={handleRenew}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold text-sm rounded-lg shadow-lg flex items-center justify-center gap-1.5 transition"
                    >
                      Renew Subscription
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
