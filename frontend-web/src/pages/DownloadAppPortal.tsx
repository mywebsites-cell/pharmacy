import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { toast } from '../components/toast';
import {
  Monitor, Download, CreditCard, Settings, LogOut,
  CheckCircle, Shield, Zap, Wifi, WifiOff, ArrowRight,
  Star, Package
} from 'lucide-react';

const DownloadAppPortal: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'download' | 'subscribe' | 'settings'>('download');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const features = [
    { icon: Zap, label: 'Lightning Fast', desc: 'Native performance, no browser overhead' },
    { icon: Wifi, label: 'Works Offline', desc: 'Full functionality without internet' },
    { icon: Shield, label: 'Secure & Encrypted', desc: 'End-to-end encrypted local storage' },
    { icon: Package, label: 'All Features', desc: 'POS, Inventory, Reports & more' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      {/* Top Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-lg">💊</span>
            </div>
            <span className="font-bold text-lg text-white">Medicly</span>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('download')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'download'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              Download App
            </button>
            <Link
              to="/subscribe"
              onClick={() => setActiveTab('subscribe')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'subscribe'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Subscription
            </Link>
            <Link
              to="/settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>

          {/* User & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-white">{user?.name || user?.username || 'User'}</div>
              <div className="text-xs text-slate-500">{user?.email || ''}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-white text-sm transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          {/* Notice Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-8">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Web App Access is Currently Restricted
          </div>

          {/* App Icon */}
          <div className="relative inline-block mb-8">
            <div className="w-28 h-28 mx-auto bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <Monitor className="w-14 h-14 text-white" />
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 w-28 h-28 mx-auto rounded-3xl bg-blue-500/20 animate-ping" style={{ animationDuration: '3s' }} />
          </div>

          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent leading-tight">
            Medicly Desktop
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            All pharmacy operations have moved to the Desktop Application.
            Download it now for a faster, more powerful, and offline-capable experience.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 text-center hover:border-blue-500/40 hover:bg-slate-800/80 transition-all group">
              <div className="w-12 h-12 mx-auto mb-3 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Icon className="w-6 h-6 text-blue-400" />
              </div>
              <div className="font-semibold text-white text-sm mb-1">{label}</div>
              <div className="text-xs text-slate-500">{desc}</div>
            </div>
          ))}
        </div>

        {/* Download Buttons */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/60 rounded-3xl p-10 mb-12 backdrop-blur-xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

          <div className="relative">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Download the Desktop App</h2>
              <p className="text-slate-400">Available for Windows and macOS. Free with your active subscription.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
              {/* Windows */}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); toast.info('Contact your administrator for the Windows installer download link.'); }}
                className="flex-1 group relative overflow-hidden flex items-center gap-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-2xl px-6 py-5 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:scale-[1.02]"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-xs text-blue-200 font-medium">Download for</div>
                  <div className="text-lg font-bold text-white">Windows</div>
                  <div className="text-xs text-blue-300">.exe installer</div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-300 ml-auto group-hover:translate-x-1 transition-transform" />
              </a>

              {/* macOS */}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); toast.info('Contact your administrator for the macOS installer download link.'); }}
                className="flex-1 group relative overflow-hidden flex items-center gap-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 rounded-2xl px-6 py-5 transition-all hover:scale-[1.02]"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-.5 14.5c-.3.5-.7.5-1 0l-3-5c-.3-.5-.1-1 .5-1h2V7c0-.6.4-1 1-1s1 .4 1 1v3.5h2c.6 0 .8.5.5 1l-3 5z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-xs text-slate-400 font-medium">Download for</div>
                  <div className="text-lg font-bold text-white">macOS</div>
                  <div className="text-xs text-slate-400">.dmg installer</div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Install notes */}
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
              {['Requires Windows 10+ or macOS 12+', 'Auto-updates included', 'Works fully offline after setup'].map(note => (
                <div key={note} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Access Links */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            to="/subscribe"
            className="group flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/40 rounded-2xl p-5 transition-all"
          >
            <div className="w-12 h-12 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-xl flex items-center justify-center transition-colors">
              <CreditCard className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Manage Subscription</div>
              <div className="text-xs text-slate-500 mt-0.5">View & renew your plan</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to="/settings"
            className="group flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-purple-500/40 rounded-2xl p-5 transition-all"
          >
            <div className="w-12 h-12 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-xl flex items-center justify-center transition-colors">
              <Settings className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Account Settings</div>
              <div className="text-xs text-slate-500 mt-0.5">Profile & password management</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <button
            onClick={handleLogout}
            className="group flex items-center gap-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-red-500/40 rounded-2xl p-5 transition-all text-left w-full"
          >
            <div className="w-12 h-12 bg-red-500/10 group-hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors">
              <LogOut className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Sign Out</div>
              <div className="text-xs text-slate-500 mt-0.5">Log out of your account</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-600 text-xs mt-10">
          Need help? Contact your administrator • © 2026 Medicly
        </p>
      </div>
    </div>
  );
};

export default DownloadAppPortal;
