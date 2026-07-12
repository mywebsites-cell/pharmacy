import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Upload, X, RefreshCw, LogOut, AlertCircle, CreditCard, Building2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store';

interface Plan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  description: string;
  features_config?: Record<string, any>;
  color: string;
  is_popular?: boolean;
}

interface PaymentAccount {
  id: number;
  account_title: string;
  bank_name: string;
  account_number: string;
  iban: string;
  qr_code: string | null;
  instructions: string;
}

type Step = 'plans' | 'payment' | 'pending';

const colorMap: Record<string, string> = {
  blue: 'from-blue-500 to-blue-700 border-blue-500',
  purple: 'from-purple-500 to-purple-700 border-purple-500',
  emerald: 'from-emerald-500 to-emerald-700 border-emerald-500',
};

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingStatus, setPendingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrPreview, setQrPreview] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      // Fetch plans separately to ensure they always load
      const plansRes = await api.get('/admin/subscription-plans/');
      setPlans(Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data.results || []));

      let subRes;
      try {
        subRes = await api.get('/admin/tenant-subscriptions/my_subscription/');
      } catch (err: any) {
        // 404 means the user just doesn't have an active subscription yet, which is expected for new users.
        if (err.response?.status !== 404) {
          throw err;
        }
      }

      if (subRes) {
        const sub = subRes.data;
        if (sub?.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date())) {
          // Update global state so App.tsx knows we are active
          useAuthStore.getState().setSubscription(sub);
          const fc = sub?.plan_details?.features_config || sub?.plan?.features_config;
          if (fc) {
            useAuthStore.getState().setFeatures(fc);
          } else {
            useAuthStore.getState().setFeatures(null);
          }
          // Already active — go to app
          navigate('/');
          return;
        }
        if (sub?.status === 'pending' || sub?.submission_id) {
          setPendingStatus(sub);
          setStep('pending');
        }
      }
    } catch (err) {
      console.error("Error fetching initial subscription data", err);
    }
    setLoading(false);
  };

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan);
    setError('');
    try {
      const res = await api.get('/admin/payment-accounts/');
      const accounts = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setPaymentAccounts(accounts);
      if (accounts.length > 0) setSelectedAccount(accounts[0]);
    } catch {
      setPaymentAccounts([]);
    }
    setStep('payment');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setScreenshotBase64(result);
      setScreenshotPreview(result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const openFilePicker = () => {
    if (!fileInputRef.current) return;
    // Allow selecting the same file again by clearing the previous value first.
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleSubmit = async () => {
    if (!screenshotBase64) { setError('Please upload your payment screenshot.'); return; }
    if (!selectedPlan) { setError('No plan selected.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/admin/payment-submissions/', {
        plan_id: selectedPlan.id,
        amount: selectedPlan.price,
        screenshot_base64: screenshotBase64,
        receipt_image: screenshotBase64,
        payment_account_id: selectedAccount?.id || null,
        amount_paid: selectedPlan.price,
        notes,
      });
      setStep('pending');
      setPendingStatus({ status: 'pending' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-lg">💊</span>
          </div>
          <span className="font-bold text-lg">PharmacyPro</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">Signed in as <span className="text-white font-medium">{user?.username}</span></span>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      {/* Step: Plans */}
      {step === 'plans' && (
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3">Choose a Subscription Plan</h1>
            <p className="text-slate-400 text-lg">Select a plan and pay to activate your PharmacyPro account.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const gradient = colorMap[plan.color] || colorMap.blue;
              return (
                <div key={plan.id} className={`relative rounded-2xl border bg-white/5 hover:bg-white/[0.08] transition-all duration-200 overflow-hidden ${plan.is_popular ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-white/10'}`}>
                  {plan.is_popular && (
                    <div className="absolute top-0 right-0 bg-purple-600 text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
                  )}
                  <div className={`h-2 w-full bg-gradient-to-r ${gradient.split(' ').slice(0,2).join(' ')}`} />
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-extrabold">Rs {plan.price.toLocaleString()}</span>
                      <span className="text-slate-400 text-sm ml-2">/ {plan.duration_days} days</span>
                    </div>
                    <ul className="space-y-2 mb-6">
                      {(() => {
                        const featureLabels: Record<string, string> = {
                          has_pos: 'POS & Sales', has_inventory: 'Inventory Management',
                          has_transaction_history: 'Transaction History', has_dues: 'Dues & Credit',
                          has_customer_management: 'Customer Management', has_analytics: 'Advanced Analytics',
                          has_accounting: 'Accounting', has_purchase_management: 'Purchase Management',
                          has_prescriptions: 'Prescriptions', has_desktop_app: 'Desktop App (Offline)',
                          has_api_access: 'API Access', has_multi_branch: 'Multi-branch Support',
                        };
                        const fc = plan.features_config || {};
                        const activeFeatures = Object.entries(featureLabels)
                          .filter(([key]) => fc[key])
                          .map(([, label]) => label);
                        if (fc.max_medicines) activeFeatures.unshift(`Up to ${fc.max_medicines} medicines`);
                        else if (fc.max_medicines === null || fc.max_medicines === undefined) {}
                        if (fc.max_customers) activeFeatures.unshift(`Up to ${fc.max_customers} customers`);
                        return activeFeatures.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ));
                      })()}
                    </ul>
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient.split(' ').slice(0,2).join(' ')} hover:opacity-90 transition-opacity`}
                    >
                      Select {plan.name}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Payment */}
      {step === 'payment' && selectedPlan && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <button onClick={() => setStep('plans')} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 text-sm transition-colors">
            ← Back to plans
          </button>
          <h2 className="text-3xl font-bold mb-2">Complete Payment</h2>
          <p className="text-slate-400 mb-8">Transfer <span className="text-white font-semibold">Rs {selectedPlan.price.toLocaleString()}</span> for the <span className="text-white font-semibold">{selectedPlan.name}</span> plan, then upload your screenshot.</p>

          {/* Payment Accounts */}
          {paymentAccounts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-400" />Payment Accounts</h3>
              <div className="space-y-3">
                {paymentAccounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className={`border rounded-xl p-5 cursor-pointer transition-all ${selectedAccount?.id === account.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-white">{account.account_title}</div>
                        <div className="text-slate-400 text-sm mt-1">{account.bank_name}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <CreditCard className="w-4 h-4 text-slate-500" />
                          <span className="font-mono text-sm text-slate-300">{account.account_number}</span>
                        </div>
                        {account.iban && (
                          <div className="text-slate-500 text-xs mt-1">IBAN: {account.iban}</div>
                        )}
                        {account.instructions && (
                          <div className="text-blue-300 text-xs mt-2 bg-blue-500/10 rounded-lg px-3 py-2">{account.instructions}</div>
                        )}
                      </div>
                      {account.qr_code && (
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrPreview({
                                src: account.qr_code as string,
                                title: `${account.account_title} (${account.bank_name})`,
                              });
                            }}
                            className="group"
                          >
                            <img
                              src={account.qr_code}
                              alt="QR Code"
                              className="w-24 h-24 rounded-lg border border-white/10 bg-white p-1 group-hover:scale-105 transition-transform"
                            />
                            <p className="text-xs text-center text-slate-500 mt-1 group-hover:text-slate-300">Tap to scan</p>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot Upload */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-emerald-400" />Upload Payment Screenshot</h3>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {!screenshotPreview ? (
              <div
                onClick={openFilePicker}
                className="border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl p-10 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">Click to upload screenshot</p>
                <p className="text-slate-500 text-sm mt-1">PNG, JPG, JPEG — max 5MB</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors"
                >
                  Choose File
                </button>
              </div>
            ) : (
              <div className="relative inline-block">
                <img src={screenshotPreview} alt="Payment screenshot" className="max-h-64 rounded-xl border border-white/10 object-contain" />
                <button
                  onClick={() => {
                    setScreenshotPreview(null);
                    setScreenshotBase64(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 rounded-full p-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Additional Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Transaction reference number, any details..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !screenshotBase64}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Payment for Approval'}
          </button>
        </div>
      )}

      {/* Step: Pending */}
      {step === 'pending' && (
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Payment Under Review</h2>
          <p className="text-slate-400 text-lg mb-8">
            Your payment screenshot has been submitted. Our admin will review and approve it shortly.
            You'll be able to access the app once approved.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left mb-8">
            <div className="flex items-center gap-3 text-amber-300 font-semibold mb-2">
              <Clock className="w-5 h-5" /> Pending Approval
            </div>
            <p className="text-slate-400 text-sm">Typical review time is within a few hours. Please check back later.</p>
          </div>
          <button
            onClick={fetchInitial}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Check Status
          </button>
          <button onClick={handleLogout} className="mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors block mx-auto">
            Sign out and come back later
          </button>
        </div>
      )}

      {/* QR Scan Modal */}
      {qrPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-6"
          onClick={() => setQrPreview(null)}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrPreview(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="Close QR preview"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-lg font-semibold mb-1">Scan to Pay</h4>
            <p className="text-sm text-slate-400 mb-4">{qrPreview.title}</p>

            <div className="bg-white rounded-xl p-3">
              <img src={qrPreview.src} alt="Payment QR code" className="w-full h-auto rounded-lg" />
            </div>

            <p className="text-xs text-slate-500 mt-3 text-center">Use your banking app to scan this QR, then upload the payment screenshot.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
