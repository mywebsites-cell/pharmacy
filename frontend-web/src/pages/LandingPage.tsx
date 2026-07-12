import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-xl">💊</span>
          </div>
          <span className="text-xl font-bold tracking-tight">PharmacyPro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2 text-sm font-semibold text-white/90 hover:text-white border border-white/20 rounded-lg hover:border-white/40 transition-all duration-200"
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/40 transition-all duration-200"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-28 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          Trusted by pharmacies worldwide
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
          Complete Pharmacy<br />Management System
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Streamline your pharmacy operations — manage inventory, process sales, track prescriptions,
          and analyze performance from a single powerful platform.
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/signup"
            className="px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-xl shadow-blue-900/50 transition-all duration-200 text-base"
          >
            Get Started Free
          </Link>
          <Link
            to="/login"
            className="px-7 py-3.5 text-white/80 hover:text-white font-semibold rounded-xl border border-white/10 hover:border-white/30 transition-all duration-200 text-base"
          >
            Sign In →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Everything you need to run your pharmacy</h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
            Built for modern pharmacies — from independent stores to multi-branch chains.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🧾',
                title: 'Point of Sale',
                desc: 'Fast, intuitive POS with barcode scanning, discount support, and receipt printing.',
              },
              {
                icon: '📦',
                title: 'Inventory Control',
                desc: 'Real-time stock tracking, expiry alerts, automatic reorder notifications.',
              },
              {
                icon: '💊',
                title: 'Prescription Management',
                desc: 'Track and manage prescriptions with patient history and doctor notes.',
              },
              {
                icon: '📊',
                title: 'Analytics & Reports',
                desc: 'Revenue charts, top-selling products, and daily/monthly performance reports.',
              },
              {
                icon: '👥',
                title: 'Customer Management',
                desc: 'Build customer profiles, track dues, and manage loyalty programs.',
              },
              {
                icon: '🏦',
                title: 'Accounting',
                desc: 'Integrated ledger, purchase tracking, and financial summaries at a glance.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors duration-200"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-3xl p-14">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-slate-400 mb-8">Create your free account in under a minute.</p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-xl shadow-blue-900/50 transition-all duration-200"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} PharmacyPro. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
