import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Shield, Users, Activity, Settings, Layers, CheckCircle, XCircle, Clock, Home, Edit, Trash2, TrendingUp, TrendingDown, Search, Filter, ShieldCheck, CreditCard, Upload, X, Monitor, ToggleLeft, ToggleRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { toast } from '../components/toast';
import { useConfirm } from '../components/ConfirmModal';

export const AdminPanel: React.FC = () => {
  const { user } = useAuthStore();
  const confirm = useConfirm();
  const location = useLocation();

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-slate-300">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500 opacity-50" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="mt-2">Only Super Admins can view the Super Admin Panel.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: Shield },
    { name: 'Subscription Plans', path: '/admin/config', icon: Settings },
    { name: 'Pending Approvals', path: '/admin/subscriptions', icon: Layers },
    { name: 'Payment Accounts', path: '/admin/payment-accounts', icon: CreditCard },
    { name: 'Users & Tenants', path: '/admin/users', icon: Users },
    { name: 'Audit Logs', path: '/admin/logs', icon: Activity },
  ];

  const [plans, setPlans] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [tenantSubscriptions, setTenantSubscriptions] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showPaymentAccountModal, setShowPaymentAccountModal] = useState(false);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<any>(null);
  const paymentAccountQrInputRef = React.useRef<HTMLInputElement>(null);
  const [paymentAccountForm, setPaymentAccountForm] = useState({ 
    account_title: '', bank_name: '', account_number: '', iban: '', instructions: '', qr_code: ''
  });
  
  // User Management
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userFormData, setUserFormData] = useState({ username: '', email: '', role: 'user', password: '' });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState({ 
    name: '', price: '', duration_days: 30, description: '', color: 'blue', is_popular: false,
    has_pos: false, has_inventory: false, has_transaction_history: false, has_dues: false, 
    has_customer_management: false, has_analytics: false, has_accounting: false, 
    has_purchase_management: false, has_prescriptions: false, has_desktop_app: false, 
    has_api_access: false, has_multi_branch: false,
    max_medicines: '', max_customers: '',
    max_branches: 1, max_devices_per_branch: 1
  });

  // Super Admin Promotion State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedPromoteUser, setSelectedPromoteUser] = useState<any>(null);
  const [securityEmailOption, setSecurityEmailOption] = useState('ahmadafridi979@gmail.com');
  const [promotionOtp, setPromotionOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Web App Toggle
  const [webAppEnabled, setWebAppEnabled] = useState<boolean>(true);
  const [webToggleLoading, setWebToggleLoading] = useState(false);

  // Fetch current web app status on mount
  useEffect(() => {
    api.get('/admin/settings/web-app-status/')
      .then((res) => setWebAppEnabled(res.data.web_app_enabled !== false))
      .catch(() => setWebAppEnabled(true));
  }, []);

  const handleWebAppToggle = async () => {
    setWebToggleLoading(true);
    try {
      const res = await api.post('/admin/settings/web-app-toggle/');
      setWebAppEnabled(res.data.web_app_enabled);
    } catch {
      toast.error('Failed to toggle web app status. Please try again.');
    }
    setWebToggleLoading(false);
  };

  useEffect(() => {
    // Always load users on mount so they're available everywhere
    const loadInitialData = async () => {
      try {
        const usersRes = await api.get('/admin/users/');
        setUsers(usersRes.data.results || usersRes.data || []);
        const submissionsRes = await api.get('/admin/payment-submissions/');
        const allSubmissions = submissionsRes.data.results || submissionsRes.data || [];
        setPendingApprovalsCount(allSubmissions.filter((s: any) => s?.status === 'pending').length);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    
    loadInitialData();
  }, []);

  useEffect(() => {
    if (location.pathname === '/admin/config') fetchPlans();
    if (location.pathname === '/admin/subscriptions') fetchSubmissions();
    if (location.pathname === '/admin/users') fetchUsersAndSubscriptions();
    if (location.pathname === '/admin/payment-accounts') fetchPaymentAccounts();
    fetchPendingApprovalsCount();
  }, [location.pathname]);

  const fetchPendingApprovalsCount = async () => {
    try {
      const res = await api.get('/admin/payment-submissions/');
      const allSubmissions = res.data.results || res.data || [];
      setPendingApprovalsCount(allSubmissions.filter((s: any) => s?.status === 'pending').length);
    } catch (err) {
      console.error('Failed to fetch pending approvals count:', err);
    }
  };

  const fetchUsersAndSubscriptions = async () => {
    setLoading(true);
    try {
      const [usersRes, subsRes, plansRes] = await Promise.all([
        api.get('/admin/users/'),
        api.get('/admin/tenant-subscriptions/'),
        api.get('/admin/subscription-plans/')
      ]);
      setUsers(usersRes.data.results || usersRes.data || []);
      setTenantSubscriptions(subsRes.data.results || subsRes.data || []);
      setPlans(plansRes.data.results || plansRes.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/subscription-plans/');
      console.log("FETCH PLANS RESP:", res.data);
      setPlans(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payment-submissions/');
      const allSubmissions = res.data.results || res.data || [];
      setSubmissions(allSubmissions);
      setPendingApprovalsCount(allSubmissions.filter((s: any) => s?.status === 'pending').length);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getSubscriptionLabel = (subscription: any) => {
    if (!subscription) return { text: 'No active plan', active: false };

    const status = String(subscription?.status || '').toLowerCase();
    const planNameFromSub = subscription?.plan_name || subscription?.plan_details?.name;
    const planNameFromPlans = plans.find((p: any) => String(p?.id) === String(subscription?.plan))?.name;
    const planName = planNameFromSub || planNameFromPlans || (subscription?.plan ? `Plan #${subscription.plan}` : 'Plan');

    if (status === 'active') {
      return { text: planName, active: true };
    }

    if (status === 'pending') {
      return { text: `${planName} (Pending)` , active: false };
    }

    if (status === 'expired') {
      return { text: `${planName} (Expired)` , active: false };
    }

    if (status === 'cancelled') {
      return { text: `${planName} (Cancelled)` , active: false };
    }

    return { text: planName, active: false };
  };

  const getSubmissionImageSrc = (submission: any): string | null => {
    const raw = submission?.screenshot_base64 || submission?.receipt_image;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('data:image/')) return raw;
    if (raw.includes(';base64,')) return raw;
    return `data:image/png;base64,${raw}`;
  };

  const getSubmissionUser = (submission: any) => {
    const pharmacyId = submission?.pharmacy || submission?.pharmacy_id;
    const linkedUser = (users || []).find((u: any) => String(u?.pharmacy_id || '') === String(pharmacyId || ''));
    return {
      username: linkedUser?.username || submission?.pharmacy_details?.name || `Pharmacy #${pharmacyId || 'N/A'}`,
      email: linkedUser?.email || submission?.pharmacy_details?.email || 'N/A',
      pharmacyId: pharmacyId || 'N/A',
    };
  };

  const getSubmissionPlanLabel = (submission: any) => {
    return submission?.plan_name || submission?.plan_details?.name || `Plan #${submission?.plan || submission?.plan_id || 'N/A'}`;
  };

  const getSubmissionDateLabel = (submission: any) => {
    const dt = submission?.submitted_at || submission?.created_at;
    if (!dt) return 'N/A';
    const parsed = new Date(dt);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
  };

  const fetchPaymentAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payment-accounts/');
      setPaymentAccounts(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch payment accounts:', err);
    }
    setLoading(false);
  };

  const getUserDetails = (userId: number) => {
    return users.find(u => u.id === userId);
  };

  const getPlanDetails = (planId: number) => {
    return plans.find(p => p.id === planId);
  };

  const handleViewSubmission = (submission: any) => {
    setSelectedSubmission(submission);
    setShowSubmissionModal(true);
    setRejectReason('');
    
    // Fetch full submission details with screenshot
    api.get(`/admin/payment-submissions/${submission.id}/`).then(res => {
      setSelectedSubmission(res.data);
    }).catch(err => {
      console.error('Failed to fetch submission details:', err);
    });
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/admin/payment-submissions/${id}/approve/`);
      setShowSubmissionModal(false);
      setSelectedSubmission(null);
      fetchSubmissions();
      toast.success('Subscription approved successfully!');
    } catch (err) {
      toast.error('Failed to approve submission. Please try again.');
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) {
      toast.warning('Please provide a rejection reason before rejecting.');
      return;
    }
    try {
      await api.post(`/admin/payment-submissions/${id}/reject/`, {
        reason: rejectReason
      });
      setShowSubmissionModal(false);
      setSelectedSubmission(null);
      setRejectReason('');
      fetchSubmissions();
      toast.success('Payment submission rejected.');
    } catch (err) {
      toast.error('Failed to reject submission. Please try again.');
    }
  };

  // User Management Functions
  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setUserFormData({
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      password: ''
    });
    setOtpSent(false);
    setPromotionOtp('');
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string | number) => {
    const ok = await confirm({ message: 'Delete this user? This action cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${userId}/`);
      setUsers((prev) => prev.filter((u: any) => String(u.id) !== String(userId)));
      setTenantSubscriptions((prev) => prev.filter((s: any) => String(s.pharmacy) !== String(userId)));
      fetchUsersAndSubscriptions();
      toast.success('User deleted successfully.');
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to delete user';
      toast.error(detail);
      console.error('Failed to delete user:', detail);
    }
  };

  const handleDeletePlan = async (planId: string | number) => {
    const ok = await confirm({ message: 'Delete this subscription plan? This action cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/admin/subscription-plans/${planId}/`);
      setPlans((prev) => prev.filter((p: any) => String(p.id) !== String(planId)));
      fetchPlans();
      toast.success('Subscription plan deleted successfully.');
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to delete plan';
      toast.error(detail);
      console.error('Failed to delete plan:', detail);
    }
  };

  const handlePromoteUser = async (userId: number) => {
    const ok = await confirm({ message: 'Promote this user to Staff? They will be able to manage their pharmacy.' });
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${userId}/`, { role: 'staff' });
      fetchUsers();
      toast.success('User promoted to Staff.');
    } catch (err) {
      toast.error('Failed to promote user.');
    }
  };

  const handleDemoteUser = async (userId: number) => {
    const ok = await confirm({ message: 'Demote this user to regular User? They will lose staff access.', destructive: true });
    if (!ok) return;
    try {
      await api.patch(`/admin/users/${userId}/`, { role: 'user' });
      fetchUsers();
      toast.success('User demoted to regular User.');
    } catch (err) {
      toast.error('Failed to demote user.');
    }
  };

  const handleSaveUserChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updateData: any = {
        username: userFormData.username,
        email: userFormData.email,
        role: userFormData.role
      };
      if (userFormData.password) {
        updateData.password = userFormData.password;
      }
      
      await api.patch(`/admin/users/${selectedUser.id}/`, updateData);
      setShowUserModal(false);
      setSelectedUser(null);
      fetchUsers();
      toast.success('User updated successfully.');
    } catch (err) {
      toast.error('Failed to update user. Please try again.');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users/');
      setUsers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleRequestPromotionOtp = async () => {
    setOtpLoading(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/request_superuser_promotion_otp/`, {
        security_email: securityEmailOption
      });
      setOtpSent(true);
      toast.success(`OTP sent to ${securityEmailOption}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    }
    setOtpLoading(false);
  };

  const handleConfirmPromotion = async () => {
    if (!promotionOtp) {
      toast.warning('Please enter the 6-digit OTP first.');
      return;
    }
    setOtpLoading(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/confirm_superuser_promotion/`, {
        security_email: securityEmailOption,
        otp: promotionOtp
      });
      setShowUserModal(false);
      setSelectedUser(null);
      setPromotionOtp('');
      setOtpSent(false);
      fetchUsers();
      toast.success('User successfully promoted to Super Admin!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP or promotion failed.');
    }
    setOtpLoading(false);
  };

  const handleRequestDemotionOtp = async () => {
    setOtpLoading(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/request_superuser_demotion_otp/`, {
        security_email: securityEmailOption
      });
      setOtpSent(true);
      toast.success(`OTP sent to ${securityEmailOption}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    }
    setOtpLoading(false);
  };

  const handleConfirmDemotion = async () => {
    if (!promotionOtp) {
      toast.warning('Please enter the 6-digit OTP first.');
      return;
    }
    setOtpLoading(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/confirm_superuser_demotion/`, {
        security_email: securityEmailOption,
        otp: promotionOtp
      });
      setShowUserModal(false);
      setSelectedUser(null);
      setPromotionOtp('');
      setOtpSent(false);
      fetchUsers();
      toast.success('User successfully demoted from Super Admin.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP or demotion failed.');
    }
    setOtpLoading(false);
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newPlan.name,
      price: newPlan.price,
      duration_days: newPlan.duration_days,
      description: newPlan.description,
      color: newPlan.color,
      is_popular: newPlan.is_popular,
      max_branches: newPlan.has_multi_branch ? parseInt(newPlan.max_branches as any) : 1,
      max_devices_per_branch: parseInt(newPlan.max_devices_per_branch as any),
      features_config: {
        has_pos: newPlan.has_pos,
        has_inventory: newPlan.has_inventory,
        has_transaction_history: newPlan.has_transaction_history,
        has_dues: newPlan.has_dues,
        has_customer_management: newPlan.has_customer_management,
        has_analytics: newPlan.has_analytics,
        has_accounting: newPlan.has_accounting,
        has_purchase_management: newPlan.has_purchase_management,
        has_prescriptions: newPlan.has_prescriptions,
        has_desktop_app: newPlan.has_desktop_app,
        has_api_access: newPlan.has_api_access,
        has_multi_branch: newPlan.has_multi_branch,
        max_medicines: newPlan.max_medicines ? parseInt(newPlan.max_medicines as string) : null,
        max_customers: newPlan.max_customers ? parseInt(newPlan.max_customers as string) : null
      }
    };

    try {
      if (editingPlanId) {
        await api.patch(`/admin/subscription-plans/${editingPlanId}/`, payload);
      } else {
        await api.post('/admin/subscription-plans/', payload);
      }
      setShowPlanForm(false);
      setEditingPlanId(null);
      setNewPlan({ 
        name: '', price: '', duration_days: 30, description: '', color: 'blue', is_popular: false,
        has_pos: false, has_inventory: false, has_transaction_history: false, has_dues: false, 
        has_customer_management: false, has_analytics: false, has_accounting: false, 
        has_purchase_management: false, has_prescriptions: false, has_desktop_app: false, 
        has_api_access: false, has_multi_branch: false,
        max_medicines: '', max_customers: '',
        max_branches: 1, max_devices_per_branch: 1
      });
      fetchPlans();
    } catch (err) {
      toast.error(editingPlanId ? 'Failed to update plan. Please try again.' : 'Failed to create plan. Please try again.');
    }
  };

  const handleEditPlan = (plan: any) => {
    const fc = plan.features_config || {};
    setEditingPlanId(String(plan.id));
    setNewPlan({
      name: plan.name || '',
      price: String(plan.price ?? ''),
      duration_days: Number(plan.duration_days || 30),
      description: plan.description || '',
      color: plan.color || 'blue',
      is_popular: Boolean(plan.is_popular),
      has_pos: Boolean(fc.has_pos),
      has_inventory: Boolean(fc.has_inventory),
      has_transaction_history: Boolean(fc.has_transaction_history),
      has_dues: Boolean(fc.has_dues),
      has_customer_management: Boolean(fc.has_customer_management),
      has_analytics: Boolean(fc.has_analytics),
      has_accounting: Boolean(fc.has_accounting),
      has_purchase_management: Boolean(fc.has_purchase_management),
      has_prescriptions: Boolean(fc.has_prescriptions),
      has_desktop_app: Boolean(fc.has_desktop_app),
      has_api_access: Boolean(fc.has_api_access),
      has_multi_branch: Boolean(fc.has_multi_branch),
      max_medicines: fc.max_medicines ? String(fc.max_medicines) : '',
      max_customers: fc.max_customers ? String(fc.max_customers) : '',
      max_branches: Number(plan.max_branches || 1),
      max_devices_per_branch: Number(plan.max_devices_per_branch || 1)
    });
    setShowPlanForm(true);
  };

  const handleEditPaymentAccount = (account: any) => {
    setSelectedPaymentAccount(account);
    setPaymentAccountForm({
      account_title: account.account_title,
      bank_name: account.bank_name,
      account_number: account.account_number,
      iban: account.iban || '',
      instructions: account.instructions || '',
      qr_code: account.qr_code || ''
    });
    setShowPaymentAccountModal(true);
  };

  const handlePaymentAccountQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPaymentAccountForm(prev => ({
        ...prev,
        qr_code: event.target?.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAccountForm.account_title.trim() || !paymentAccountForm.bank_name.trim() || !paymentAccountForm.account_number.trim()) {
      toast.warning('Please fill in all required fields (Title, Bank, Account Number).');
      return;
    }

    try {
      const data = {
        account_title: paymentAccountForm.account_title,
        bank_name: paymentAccountForm.bank_name,
        account_number: paymentAccountForm.account_number,
        iban: paymentAccountForm.iban,
        instructions: paymentAccountForm.instructions,
        qr_code: paymentAccountForm.qr_code
      };

      if (selectedPaymentAccount) {
        await api.patch(`/admin/payment-accounts/${selectedPaymentAccount.id}/`, data);
        toast.success('Payment account updated successfully.');
      } else {
        await api.post('/admin/payment-accounts/', data);
        toast.success('Payment account created successfully.');
      }

      setShowPaymentAccountModal(false);
      setSelectedPaymentAccount(null);
      setPaymentAccountForm({ account_title: '', bank_name: '', account_number: '', iban: '', instructions: '', qr_code: '' });
      fetchPaymentAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to save payment account.');
    }
  };

  const handleDeletePaymentAccount = async (accountId: string | number) => {
    const ok = await confirm({ message: 'Delete this payment account? This cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await api.delete(`/admin/payment-accounts/${accountId}/`);
      setPaymentAccounts((prev) => prev.filter((p: any) => String(p.id) !== String(accountId)));
      fetchPaymentAccounts();
      toast.success('Payment account deleted successfully.');
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to delete payment account';
      toast.error(detail);
      console.error('Failed to delete payment account:', detail);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="mb-8 border-b border-slate-700 pb-4 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-blue-400" />
            Super Admin Control Center
          </h1>
          <p className="text-slate-400">Manage the global SaaS platform, tenants, and system configurations.</p>
        </div>
        <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors shadow-sm">
          <Home className="w-4 h-4" /> Return to Pharmacy
        </Link>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);
          const showPendingDot = tab.path === '/admin/subscriptions' && pendingApprovalsCount > 0;
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
              {showPendingDot && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
                  title={`${pendingApprovalsCount} pending approval${pendingApprovalsCount > 1 ? 's' : ''}`}
                />
              )}
            </Link>
          );
        })}
      </div>

      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 min-h-[400px]">
        {location.pathname === '/admin/dashboard' && (
          <div className="space-y-8">
            {/* Platform Overview */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Platform Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                  <div className="text-slate-400 mb-1">Total Pharmacies</div>
                  <div className="text-3xl font-bold text-white">{users.length || 0}</div>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                  <div className="text-slate-400 mb-1">Active Subscriptions</div>
                  <div className="text-3xl font-bold text-emerald-400">{tenantSubscriptions.filter((s: any) => s?.status === 'active').length}</div>
                </div>
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                  <div className="text-slate-400 mb-1">Pending Approvals</div>
                  <div className="text-3xl font-bold text-amber-400">{pendingApprovalsCount}</div>
                </div>
              </div>
            </div>

            {/* Platform Access Controls */}
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Monitor className="w-6 h-6 text-blue-400" />
                Platform Access Controls
              </h2>
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700 rounded-2xl p-6 max-w-2xl">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full transition-colors ${
                        webAppEnabled
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      }`} />
                      <h3 className="text-lg font-semibold text-white">Web Application Access</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        webAppEnabled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}>
                        {webAppEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {webAppEnabled
                        ? 'Regular users can currently access pharmacy operations via the web browser. Toggle this off to redirect all users to the Desktop Application.'
                        : 'Regular users are redirected to the Download App page when they log in. They can still manage their subscription and account settings. Only Super Admins have full web app access.'}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={handleWebAppToggle}
                    disabled={webToggleLoading}
                    title={webAppEnabled ? 'Click to disable web app for regular users' : 'Click to enable web app for regular users'}
                    className={`flex-shrink-0 relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                      webAppEnabled
                        ? 'bg-emerald-500 focus:ring-emerald-500'
                        : 'bg-slate-600 focus:ring-slate-500'
                    } ${webToggleLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                      webAppEnabled ? 'translate-x-8' : 'translate-x-0'
                    }`} />
                    {webToggleLoading && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </span>
                    )}
                  </button>
                </div>

                {/* Warning when disabling */}
                {!webAppEnabled && (
                  <div className="mt-5 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                    <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400">⚠️</div>
                    <div className="text-sm text-amber-300">
                      <strong>Web app is disabled.</strong> Regular users who log in will be shown the Download Desktop App page instead of the pharmacy interface. Super Admins retain full access.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {location.pathname === '/admin/users' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">Tenant Management</h2>
                <p className="text-slate-400 mt-1">Manage global users, pharmacy roles, and their subscription status.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-200 placeholder:text-slate-500 w-64 transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="appearance-none bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-8 py-2 text-sm focus:border-blue-500 outline-none text-slate-200 transition-all cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Super Admin</option>
                    <option value="user">Pharmacy Owner</option>
                    <option value="staff">Staff Member</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Activity className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                <p>Loading tenant database...</p>
              </div>
            ) : (
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="px-6 py-4 font-semibold">User</th>
                        <th className="px-6 py-4 font-semibold">Role</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold">Subscription</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(() => {
                        try {
                          if (!Array.isArray(users)) return <tr><td colSpan={5} className="p-8 text-center text-slate-500">Users data is corrupted or loading.</td></tr>;
                          
                          const filtered = users
                            .filter(u => userRoleFilter === 'all' || u?.role === userRoleFilter)
                            .filter(u => userSearchQuery === '' || 
                              (u?.username && u.username.toLowerCase().includes(userSearchQuery.toLowerCase())) || 
                              (u?.email && u.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                            );

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                  No users found.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((u) => {
                            const userPharmacyId = String(u?.pharmacy_id || '');
                            const ts = (tenantSubscriptions || []).find(
                              (s) => String(s?.pharmacy) === userPharmacyId
                            );
                            const subscriptionLabel = getSubscriptionLabel(ts);
                            return (
                              <tr key={u.id || Math.random()} className="hover:bg-slate-800/50 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                                      {(u?.username || 'U').substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-slate-200">{u?.username || 'Unknown'}</div>
                                      <div className="text-xs text-slate-500 mt-0.5">{u?.email || 'No email'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                    u?.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                    u?.role === 'staff' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  }`}>
                                    {u?.role === 'admin' ? 'Super Admin' : u?.role === 'staff' ? 'Staff' : 'Owner'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${u?.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></div>
                                    <span className={u?.is_active ? 'text-emerald-400' : 'text-slate-500'}>
                                      {u?.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {ts ? (
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <Layers className={`w-3.5 h-3.5 ${subscriptionLabel.active ? 'text-emerald-400' : 'text-amber-400'}`} />
                                        <span className={`font-semibold ${subscriptionLabel.active ? 'text-emerald-400' : 'text-amber-400'}`}>{subscriptionLabel.text}</span>
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Expires: {ts.expires_at ? new Date(ts.expires_at).toLocaleDateString() : 'N/A'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-slate-500 flex items-center gap-2">
                                      <XCircle className="w-3.5 h-3.5" /> No active plan
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex gap-2 justify-end opacity-100">
                                    <button onClick={() => handleEditUser(u)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title="Edit User">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    {u?.role !== 'admin' && (
                                      <>
                                        {u?.role === 'user' ? (
                                          <button onClick={() => handlePromoteUser(u.id)} className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-all" title="Promote to Staff">
                                            <TrendingUp className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <button onClick={() => handleDemoteUser(u.id)} className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all" title="Demote to User">
                                            <TrendingDown className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Delete User">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        } catch (error: any) {
                          return (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-red-500 font-mono">
                                <strong>UI Rendering Error:</strong> {error.message}
                              </td>
                            </tr>
                          );
                        }
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {location.pathname === '/admin/config' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Subscription Plans</h2>
                <p className="text-slate-400">Manage pricing tiers available for pharmacies.</p>
              </div>
              <button
                onClick={() => {
                  if (showPlanForm) {
                    setEditingPlanId(null);
                    setNewPlan({
                      name: '', price: '', duration_days: 30, description: '', color: 'blue', is_popular: false,
                      has_pos: false, has_inventory: false, has_transaction_history: false, has_dues: false,
                      has_customer_management: false, has_analytics: false, has_accounting: false,
                      has_purchase_management: false, has_prescriptions: false, has_desktop_app: false,
                      has_api_access: false, has_multi_branch: false,
                      max_medicines: '', max_customers: '',
                      max_branches: 1, max_devices_per_branch: 1
                    });
                    setShowPlanForm(false);
                    return;
                  }
                  setEditingPlanId(null);
                  setShowPlanForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                {showPlanForm ? 'Cancel' : '+ Create Plan'}
              </button>
            </div>

              {showPlanForm && (
                <form onSubmit={createPlan} className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm text-slate-400 mb-1">Plan Name</label>
                      <input required type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" placeholder="e.g. Pro Plan" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Price ($)</label>
                      <input required type="number" step="0.01" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" placeholder="99.99" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Duration (Days)</label>
                      <input required type="number" value={newPlan.duration_days} onChange={e => setNewPlan({...newPlan, duration_days: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-slate-400 mb-1">Description</label>
                      <input type="text" value={newPlan.description} onChange={e => setNewPlan({...newPlan, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" placeholder="Plan description" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Color Theme</label>
                      <select value={newPlan.color} onChange={e => setNewPlan({...newPlan, color: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2">
                        <option value="blue">Blue</option>
                        <option value="purple">Purple</option>
                        <option value="emerald">Emerald</option>
                      </select>
                    </div>
                    <div className="flex items-center mt-6">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input type="checkbox" checked={newPlan.is_popular} onChange={e => setNewPlan({...newPlan, is_popular: e.target.checked})} className="rounded bg-slate-900 border-slate-700" />
                        Mark as Popular
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Max Medicines</label>
                      <input type="number" value={newPlan.max_medicines} onChange={e => setNewPlan({...newPlan, max_medicines: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" placeholder="Unlimited if blank" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Max Customers</label>
                      <input type="number" value={newPlan.max_customers} onChange={e => setNewPlan({...newPlan, max_customers: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2" placeholder="Unlimited if blank" />
                    </div>
                    {newPlan.has_multi_branch && (
                      <div>
                        <label className="block text-sm text-emerald-400 mb-1 font-semibold">Max Branches</label>
                        <input type="number" min="1" value={newPlan.max_branches} onChange={e => setNewPlan({...newPlan, max_branches: parseInt(e.target.value) || 1})} className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2 text-white" />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-blue-400 mb-1 font-semibold">Max Devices Per Branch</label>
                      <input type="number" min="1" value={newPlan.max_devices_per_branch} onChange={e => setNewPlan({...newPlan, max_devices_per_branch: parseInt(e.target.value) || 1})} className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-2 text-white" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Feature Flags</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries({
                        has_pos: 'POS & Sales',
                        has_inventory: 'Inventory',
                        has_transaction_history: 'Transaction History',
                        has_dues: 'Dues & Credit',
                        has_customer_management: 'Customers',
                        has_analytics: 'Analytics',
                        has_accounting: 'Accounting',
                        has_purchase_management: 'Purchases',
                        has_prescriptions: 'Prescriptions',
                        has_desktop_app: 'Desktop App',
                        has_api_access: 'API Access',
                        has_multi_branch: 'Multi-Branch'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm hover:text-white transition-colors">
                          <input type="checkbox" checked={(newPlan as any)[key]} onChange={e => setNewPlan({...newPlan, [key]: e.target.checked})} className="rounded bg-slate-900 border-slate-700" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold mt-4">
                    {editingPlanId ? 'Update Plan' : 'Save Plan'}
                  </button>
                </form>
              )}
            
            {loading ? <p>Loading plans...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div key={plan.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-2xl font-black text-emerald-400 my-2">${plan.price}</p>
                    <p className="text-sm text-slate-400 mb-2">{plan.duration_days} Days</p>
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700 mb-4 space-y-1 text-xs">
                      <div className="flex justify-between text-emerald-400 font-semibold">
                        <span>Max Branches:</span>
                        <span>{plan.max_branches || 1}</span>
                      </div>
                      <div className="flex justify-between text-blue-400 font-semibold">
                        <span>Max Devices / Branch:</span>
                        <span>{plan.max_devices_per_branch || 1}</span>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {Object.entries({
                          has_pos: 'POS & Sales',
                          has_inventory: 'Inventory',
                          has_transaction_history: 'Transaction History',
                          has_dues: 'Dues & Credit',
                          has_customer_management: 'Customers',
                          has_analytics: 'Analytics',
                          has_accounting: 'Accounting',
                          has_purchase_management: 'Purchases',
                          has_prescriptions: 'Prescriptions',
                          has_desktop_app: 'Desktop App',
                          has_api_access: 'API Access',
                          has_multi_branch: 'Multi-Branch'
                        }).map(([key, label]) => (
                           <div key={key} className={`flex items-center gap-2 text-sm ${plan.features_config?.[key] ? 'text-slate-300' : 'text-slate-600'}`}>
                             {plan.features_config?.[key] ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-600" />} {label}
                           </div>
                        ))}
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-700/80 flex justify-end gap-2">
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-2 rounded-lg font-semibold transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" /> Edit Plan
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)} 
                          className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-2 rounded-lg font-semibold transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Plan
                        </button>
                      </div>
                  </div>
                ))}
                {plans.length === 0 && <p className="text-slate-400 col-span-3">No subscription plans configured.</p>}
              </div>
            )}
          </div>
        )}

        {location.pathname === '/admin/logs' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Audit Logs</h2>
            <p className="text-slate-400">System-wide audit trail for security events.</p>
          </div>
        )}

        {location.pathname === '/admin/subscriptions' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Pending Approvals & Payments</h2>
            <p className="text-slate-400 mb-6">Review uploaded receipts and payment proofs to activate tenant subscriptions.</p>
            
            {loading ? <p className="text-slate-400">Loading submissions...</p> : (
              <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                {submissions.filter(s => s.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p>No pending payment submissions. All payments have been reviewed!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                        <tr>
                          <th className="p-4">Pharmacy / User</th>
                          <th className="p-4">Plan</th>
                          <th className="p-4">Amount Paid</th>
                          <th className="p-4">Submitted</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {submissions.filter(s => s.status === 'pending').map((sub) => {
                          const displayUser = getSubmissionUser(sub);
                          return (
                            <tr key={sub.id} className="hover:bg-slate-800/50 transition-colors">
                              <td className="p-4">
                                <div className="font-medium text-slate-200">{displayUser.username}</div>
                                <div className="text-xs text-slate-500">{displayUser.email}</div>
                              </td>
                              <td className="p-4 font-medium text-blue-400">{getSubmissionPlanLabel(sub)}</td>
                              <td className="p-4 text-emerald-400 font-bold">${sub.amount_paid || sub.amount || 'N/A'}</td>
                              <td className="p-4 text-slate-400 text-xs">{getSubmissionDateLabel(sub)}</td>
                              <td className="p-4">
                                <span className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full text-xs w-max font-semibold"><Clock className="w-3 h-3" /> Pending</span>
                              </td>
                              <td className="p-4">
                                <button 
                                  onClick={() => handleViewSubmission(sub)}
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
                                >
                                  View & Review
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Submission Review Modal */}
            {showSubmissionModal && selectedSubmission && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold">Payment Review</h3>
                      <p className="text-xs text-slate-500 mt-1">ID: {selectedSubmission.id}</p>
                    </div>
                    <button 
                      onClick={() => setShowSubmissionModal(false)}
                      className="text-slate-400 hover:text-white text-2xl leading-none hover:bg-slate-700 rounded p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {(() => {
                      const modalUser = getSubmissionUser(selectedSubmission);
                      const proofSrc = getSubmissionImageSrc(selectedSubmission);
                      return (
                        <>
                    {/* User & Pharmacy Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-400 mb-3">PHARMACY INFORMATION</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <div className="text-slate-500 text-xs">Username</div>
                            <div className="text-slate-200 font-medium">{modalUser.username}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">Email</div>
                            <div className="text-slate-200 font-medium">{modalUser.email}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">Pharmacy ID</div>
                            <div className="text-slate-200 font-medium font-mono">{modalUser.pharmacyId}</div>
                          </div>
                        </div>
                      </div>

                      {/* Plan & Payment Info */}
                      <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-400 mb-3">PAYMENT DETAILS</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <div className="text-slate-500 text-xs">Plan Requested</div>
                            <div className="text-blue-400 font-bold">{getSubmissionPlanLabel(selectedSubmission)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">Amount Paid</div>
                            <div className="text-emerald-400 font-bold text-lg">${selectedSubmission.amount_paid || selectedSubmission.amount || '0'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs">Submitted On</div>
                            <div className="text-slate-200 font-medium">{getSubmissionDateLabel(selectedSubmission)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Proof / Screenshot */}
                    <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-400 mb-3">PAYMENT PROOF</h4>
                      {proofSrc ? (
                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                          <div className="flex items-center justify-center">
                            <img 
                              src={proofSrc}
                              alt="Payment proof"
                              className="max-w-full h-auto rounded-lg border border-slate-600 max-h-[400px] object-contain"
                              onError={(e) => {
                                console.error('Image failed to load');
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2 text-center">Payment receipt uploaded</p>
                        </div>
                      ) : (
                        <div className="bg-slate-900 p-8 rounded-lg border border-slate-700 text-center">
                          <div className="text-slate-500 mb-2">📷</div>
                          <p className="text-slate-500 text-sm">No payment proof uploaded</p>
                          <p className="text-slate-600 text-xs mt-1">User did not attach a payment receipt</p>
                        </div>
                      )}
                    </div>

                    {/* Review Notes */}
                    {selectedSubmission.notes && (
                      <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">NOTES</h4>
                        <p className="text-slate-300">{selectedSubmission.notes}</p>
                      </div>
                    )}

                        </>
                      );
                    })()}

                    {/* Rejection Reason (only show if rejecting) */}
                    {rejectReason !== '' && (
                      <div className="bg-red-950/30 p-4 rounded-lg border border-red-900/50">
                        <h4 className="text-sm font-semibold text-red-400 mb-2">REJECTION REASON</h4>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why this payment is being rejected..."
                          className="w-full bg-slate-900 border border-red-900/50 rounded-lg p-3 text-slate-200 text-sm resize-none"
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-700">
                      {rejectReason === '' ? (
                        <>
                          <button
                            onClick={() => handleApprove(selectedSubmission.id)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" /> Approve Payment
                          </button>
                          <button
                            onClick={() => setRejectReason('Please provide a reason for rejection...')}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" /> Reject Payment
                          </button>
                          <button
                            onClick={() => setShowSubmissionModal(false)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors"
                          >
                            Close
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReject(selectedSubmission.id)}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => setRejectReason('')}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {location.pathname === '/admin/payment-accounts' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Payment Accounts</h2>
                <p className="text-slate-400">Manage payment collection accounts and QR codes for users to scan.</p>
              </div>
              <button onClick={() => { setSelectedPaymentAccount(null); setPaymentAccountForm({ account_title: '', bank_name: '', account_number: '', iban: '', instructions: '', qr_code: '' }); setShowPaymentAccountModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                + Add Payment Account
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Activity className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                <p>Loading payment accounts...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paymentAccounts.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-400">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p>No payment accounts configured yet.</p>
                    <p className="text-sm mt-1">Add one using the button above.</p>
                  </div>
                ) : (
                  paymentAccounts.map((account) => (
                    <div key={account.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white">{account.account_title}</h3>
                          <p className="text-sm text-slate-400">{account.bank_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditPaymentAccount(account)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeletePaymentAccount(account.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-4 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Account #</span>
                          <span className="font-mono text-slate-300">{account.account_number}</span>
                        </div>
                        {account.iban && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">IBAN</span>
                            <span className="font-mono text-slate-300">{account.iban}</span>
                          </div>
                        )}
                      </div>

                      {account.instructions && (
                        <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg mb-4 text-xs text-blue-300">
                          {account.instructions}
                        </div>
                      )}

                      {account.qr_code && (
                        <div className="text-center mb-4">
                          <img src={account.qr_code} alt="QR Code" className="w-full max-w-[150px] mx-auto rounded-lg border border-slate-700 bg-white p-2" />
                          <p className="text-xs text-slate-500 mt-2">QR Code Configured</p>
                        </div>
                      )}

                      <div className="text-xs text-slate-500">
                        ID: {account.id}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Payment Account Modal */}
            {showPaymentAccountModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl">
                  <div className="flex justify-between items-center p-6 border-b border-slate-700">
                    <h3 className="text-2xl font-bold">{selectedPaymentAccount ? 'Edit Payment Account' : 'Create Payment Account'}</h3>
                    <button onClick={() => setShowPaymentAccountModal(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                  </div>

                  <form onSubmit={handleSavePaymentAccount} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Account Title *</label>
                        <input
                          type="text"
                          required
                          value={paymentAccountForm.account_title}
                          onChange={(e) => setPaymentAccountForm({...paymentAccountForm, account_title: e.target.value})}
                          placeholder="e.g. Main Business Account"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Bank Name *</label>
                        <input
                          type="text"
                          required
                          value={paymentAccountForm.bank_name}
                          onChange={(e) => setPaymentAccountForm({...paymentAccountForm, bank_name: e.target.value})}
                          placeholder="e.g. State Bank of Pakistan"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Account Number *</label>
                        <input
                          type="text"
                          required
                          value={paymentAccountForm.account_number}
                          onChange={(e) => setPaymentAccountForm({...paymentAccountForm, account_number: e.target.value})}
                          placeholder="1234567890"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">IBAN (Optional)</label>
                        <input
                          type="text"
                          value={paymentAccountForm.iban}
                          onChange={(e) => setPaymentAccountForm({...paymentAccountForm, iban: e.target.value})}
                          placeholder="PK123456789"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Instructions (Optional)</label>
                        <textarea
                          value={paymentAccountForm.instructions}
                          onChange={(e) => setPaymentAccountForm({...paymentAccountForm, instructions: e.target.value})}
                          placeholder="Transfer instructions or additional details..."
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none resize-none"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">QR Code (Optional)</label>
                        <input ref={paymentAccountQrInputRef} type="file" accept="image/*" className="hidden" onChange={handlePaymentAccountQrChange} />
                        <button
                          type="button"
                          onClick={() => paymentAccountQrInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg py-8 text-center cursor-pointer transition-colors bg-slate-900/50"
                        >
                          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                          <p className="text-slate-300 font-medium">Click to upload QR code</p>
                          <p className="text-slate-500 text-xs mt-1">PNG, JPG — max 2MB</p>
                        </button>
                        {paymentAccountForm.qr_code && (
                          <div className="mt-4 text-center">
                            <img src={paymentAccountForm.qr_code} alt="QR Preview" className="w-32 h-32 mx-auto rounded-lg border border-slate-700 bg-white p-1" />
                            <p className="text-xs text-slate-400 mt-2">QR Code Preview</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-700">
                      <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        {selectedPaymentAccount ? 'Update Account' : 'Create Account'}
                      </button>
                      <button type="button" onClick={() => setShowPaymentAccountModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* User Edit Modal - Outside all path conditions for reliable rendering */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Professional Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 px-8 py-6 flex justify-between items-start">
              <div className="flex items-start gap-4 flex-1">
                <div className="bg-blue-500/30 p-3 rounded-lg backdrop-blur-sm">
                  <Edit className="w-6 h-6 text-blue-100" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white">Edit User Profile</h3>
                  <p className="text-sm text-blue-100 mt-1">Update user information, roles, and Super Admin privileges</p>
                </div>
              </div>
              <button 
                onClick={() => setShowUserModal(false)}
                className="text-blue-100 hover:text-white hover:bg-blue-500/30 p-2 rounded-lg transition-all duration-200"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-8">
              <form onSubmit={handleSaveUserChanges} className="space-y-6">
                {/* Current User Info */}
                <div className="bg-slate-700/40 border border-slate-600/50 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Current User</p>
                  <p className="text-lg font-semibold text-white">{selectedUser.username}</p>
                  <p className="text-sm text-slate-400 mt-1">{selectedUser.email}</p>
                </div>

                {/* Username Field */}
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Username
                  </label>
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({...userFormData, username: e.target.value})}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200 placeholder:text-slate-600"
                    placeholder="Enter username"
                    required
                  />
                </div>

                {/* Email Field */}
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-blue-500 focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200 placeholder:text-slate-600"
                    placeholder="Enter email address"
                    required
                  />
                </div>

                {/* Role Selection */}
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    User Role
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({...userFormData, role: e.target.value})}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-purple-500 focus:bg-slate-900 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all duration-200"
                  >
                    <option value="user">👤 Owner - Can manage pharmacy and staff</option>
                    <option value="staff">👨‍💼 Manager - Can operate pharmacy only</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-2">
                    {userFormData.role === 'user' ? '✓ Full pharmacy management rights' : '✓ Limited to daily operations'}
                  </p>
                </div>

                {/* Password Field */}
                <div className="group">
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    New Password
                    <span className="ml-auto text-xs font-normal text-slate-500 bg-slate-700/50 px-2 py-1 rounded">Optional</span>
                  </label>
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                    placeholder="Leave blank to keep current password"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-red-500 focus:bg-slate-900 focus:ring-2 focus:ring-red-500/20 outline-none transition-all duration-200 placeholder:text-slate-600"
                  />
                  <p className="text-xs text-slate-400 mt-2">Leave blank to keep the existing password</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {/* Divider */}
              <div className="border-t border-slate-700 my-8"></div>

              {/* Super Admin Management Section */}
              <div className="bg-slate-900/40 border border-emerald-500/30 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Super Admin Privileges</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Root OTP authorization required for changes</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">Select Root Security Email</label>
                  <select
                    value={securityEmailOption}
                    onChange={(e) => setSecurityEmailOption(e.target.value)}
                    disabled={otpSent}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                  >
                    <option value="ahmadafridi979@gmail.com">ahmadafridi979@gmail.com</option>
                    <option value="afridiahmad979@gmail.com">afridiahmad979@gmail.com</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-2">OTP verification will be delivered to this authorized Gmail account.</p>
                </div>

                {!otpSent ? (
                  <div className="flex gap-3">
                    {selectedUser.role !== 'admin' ? (
                      <button
                        type="button"
                        onClick={handleRequestPromotionOtp}
                        disabled={otpLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        {otpLoading ? 'Sending OTP...' : 'Promote to Super Admin (Send OTP)'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestDemotionOtp}
                        disabled={otpLoading}
                        className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        {otpLoading ? 'Sending OTP...' : 'Demote from Super Admin (Send OTP)'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-sm font-semibold text-emerald-400 mb-2">Enter 6-Digit OTP</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={promotionOtp}
                        onChange={(e) => setPromotionOtp(e.target.value)}
                        placeholder="••••••"
                        required
                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:border-emerald-500 outline-none font-mono"
                      />
                    </div>
                    {selectedUser.role !== 'admin' ? (
                      <button
                        type="button"
                        onClick={handleConfirmPromotion}
                        disabled={otpLoading}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-lg font-semibold transition-all shadow-lg"
                      >
                        {otpLoading ? 'Verifying...' : 'Confirm Super Admin Promotion'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmDemotion}
                        disabled={otpLoading}
                        className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white py-3 rounded-lg font-semibold transition-all shadow-lg"
                      >
                        {otpLoading ? 'Verifying...' : 'Confirm Super Admin Demotion'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
