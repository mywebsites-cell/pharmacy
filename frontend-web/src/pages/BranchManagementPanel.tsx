import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Users, Plus, Mail, UserCheck, UserX, Pencil, Trash2,
  ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, AlertCircle,
  ToggleLeft, ToggleRight, ShieldCheck, Eye, EyeOff,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store';
import BranchUsageMeter from '../components/BranchUsageMeter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Staff {
  id: string;
  invited_name: string;
  invited_email: string;
  status: 'pending' | 'active' | 'revoked';
  user_last_login: string | null;
  can_access_pos: boolean;
  can_access_inventory: boolean;
  can_access_transaction_history: boolean;
  can_access_dues: boolean;
  can_access_customers: boolean;
  can_access_analytics: boolean;
  can_access_accounting: boolean;
  can_access_purchases: boolean;
  can_access_prescriptions: boolean;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  branch_type: string;
  is_active: boolean;
  staff_count: number;
  phone_number: string;
  email: string;
  address_line_1: string;
}

const MODULE_PERMISSIONS = [
  { key: 'can_access_pos', label: 'POS / Sales' },
  { key: 'can_access_inventory', label: 'Inventory' },
  { key: 'can_access_transaction_history', label: 'Transactions' },
  { key: 'can_access_dues', label: 'Dues & Credit' },
  { key: 'can_access_customers', label: 'Customers' },
  { key: 'can_access_analytics', label: 'Analytics' },
  { key: 'can_access_accounting', label: 'Accounting' },
  { key: 'can_access_purchases', label: 'Purchases' },
  { key: 'can_access_prescriptions', label: 'Prescriptions' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: Staff['status'] }) {
  const cfg = {
    active:  { icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    pending: { icon: AlertCircle,  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    revoked: { icon: XCircle,      color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      <Icon size={11} /> {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ branchId, branchName, onClose }: { branchId: string; branchName: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const invite = useMutation({
    mutationFn: () => api.post('/pharmacy/branch-staff/invite/', { branch_id: branchId, invited_name: name, invited_email: email }),
    onSuccess: (res: any) => {
      setSent(true);
      if (res?.data?.otp_code) {
        setOtpCode(res.data.otp_code);
      }
      qc.invalidateQueries({ queryKey: ['branch-staff', branchId] });
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      const msg = typeof data === 'string'
        ? data
        : data?.error || data?.detail || (Array.isArray(data?.invited_email) ? data.invited_email[0] : null) || (Array.isArray(data?.branch_id) ? data.branch_id[0] : null) || 'Failed to create staff invitation. Please try again.';
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Invitation Created!</h3>
            <p className="text-slate-400 text-sm mb-4">
              An invitation code was sent to <strong className="text-white">{email}</strong>.
            </p>

            {otpCode && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-5 text-center">
                <p className="text-xs text-amber-300 font-medium mb-1">Staff Activation Code (OTP):</p>
                <div className="text-2xl font-bold font-mono tracking-widest text-amber-400 select-all">{otpCode}</div>
                <p className="text-[11px] text-slate-400 mt-1">Use this code to activate the staff member right now.</p>
              </div>
            )}

            <p className="text-slate-400 text-xs mb-5">
              Click <strong className="text-white font-semibold">"Activate"</strong> next to <span className="text-white font-semibold">{name}</span>'s card in the staff list to set up their account.
            </p>

            <button onClick={onClose} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition text-sm font-medium">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-white mb-1">Invite Staff to {branchName}</h3>
            <p className="text-slate-400 text-sm mb-5">An OTP code will be emailed. Staff must accept it to activate their account.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ali Hassan" className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition">Cancel</button>
                <button
                  onClick={() => invite.mutate()}
                  disabled={!name || !email || invite.isPending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/20"
                >
                  {invite.isPending ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Owner Activate Staff Modal ───────────────────────────────────────────────

function ActivateStaffModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const activate = useMutation({
    mutationFn: () =>
      api.post('/pharmacy/branch-staff/owner_activate/', {
        staff_id: staff.id,
        otp,
        username,
        password,
        confirm_password: confirmPassword,
      }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ['branch-staff'] });
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Activation failed. Please try again.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={24} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Account Activated!</h3>
            <p className="text-slate-400 text-sm mb-1">
              <strong className="text-white">{staff.invited_name}</strong>'s account is now active.
            </p>
            <p className="text-slate-500 text-xs mb-5">Share the username with them so they can log in.</p>
            <div className="bg-slate-800 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-slate-500 mb-1">Username</p>
              <p className="text-white font-mono font-semibold">{username}</p>
            </div>
            <button onClick={onClose} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition text-sm font-medium">Done</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-white mb-1">Activate {staff.invited_name}</h3>
            <p className="text-slate-400 text-sm mb-5">
              Ask <strong className="text-white">{staff.invited_email}</strong> for the 6-digit code they received, then set up their account credentials.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">OTP Code (from staff's email)</label>
                <input
                  value={otp} onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-amber-500/30 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-amber-400/60 font-mono tracking-widest text-center text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Staff Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ali_hassan_pos" className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 chars, start with capital, _ or @"
                    className="w-full px-4 py-2.5 pr-10 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-blue-500/50"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition">Cancel</button>
                <button
                  onClick={() => activate.mutate()}
                  disabled={!otp || !username || !password || !confirmPassword || activate.isPending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-emerald-500/20"
                >
                  {activate.isPending ? 'Activating…' : 'Activate Account'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// ─── Edit Branch Modal ────────────────────────────────────────────────────────

function EditBranchModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [form, setForm] = useState({ name: branch.name, city: branch.city, phone_number: branch.phone_number, email: branch.email, address_line_1: branch.address_line_1, branch_type: branch.branch_type });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: () => api.patch(`/pharmacy/branches/${branch.id}/`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || 'Update failed.'),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-5">Edit Branch</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Branch Name', key: 'name' },
            { label: 'City', key: 'city' },
            { label: 'Phone', key: 'phone_number' },
            { label: 'Email', key: 'email' },
            { label: 'Address', key: 'address_line_1' },
          ].map(({ label, key }) => (
            <div key={key} className={key === 'address_line_1' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
              <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch Type</label>
            <select value={form.branch_type} onChange={e => set('branch_type', e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-blue-500/50">
              <option value="main">Main Branch</option>
              <option value="satellite">Satellite</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition">Cancel</button>
          <button onClick={() => update.mutate()} disabled={update.isPending} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Row ────────────────────────────────────────────────────────────────

function StaffRow({ staff, branchPharmacy }: { staff: Staff; branchPharmacy: string }) {
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState(staff);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [activating, setActivating] = useState(false);
  const qc = useQueryClient();

  const revoke = useMutation({
    mutationFn: () => api.post(`/pharmacy/branch-staff/${staff.id}/revoke/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branch-staff'] }),
  });

  const savePerms = useMutation({
    mutationFn: () => api.patch(`/pharmacy/branch-staff/${staff.id}/permissions/`, MODULE_PERMISSIONS.reduce((acc, m) => ({ ...acc, [m.key]: (perms as any)[m.key] }), {})),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branch-staff'] }),
  });

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
      {activating && <ActivateStaffModal staff={staff} onClose={() => setActivating(false)} />}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {staff.invited_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{staff.invited_name}</span>
            <StatusBadge status={staff.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500 truncate">{staff.invited_email}</span>
            {staff.status === 'active' && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} /> {timeAgo(staff.user_last_login)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Pending: show Activate button */}
          {staff.status === 'pending' && (
            <button
              onClick={() => setActivating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-500/20"
              title="Activate this staff member"
            >
              <ShieldCheck size={13} /> Activate
            </button>
          )}
          {staff.status !== 'revoked' && (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Edit permissions"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {confirmRevoke ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Confirm?</span>
                  <button onClick={() => revoke.mutate()} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition">Yes</button>
                  <button onClick={() => setConfirmRevoke(false)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmRevoke(true)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition" title="Revoke access">
                  <UserX size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && staff.status !== 'revoked' && (
        <div className="border-t border-slate-700/40 px-4 py-3 bg-slate-900/30">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Module Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {MODULE_PERMISSIONS.map(({ key, label }) => {
              const val = (perms as any)[key];
              return (
                <button
                  key={key}
                  onClick={() => setPerms(p => ({ ...p, [key]: !val }))}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    val
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800/50 border-slate-700/40 text-slate-500'
                  }`}
                >
                  {label}
                  {val ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => savePerms.mutate()}
            disabled={savePerms.isPending}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
          >
            {savePerms.isPending ? 'Saving…' : 'Save Permissions'}
          </button>
          {savePerms.isSuccess && <span className="ml-3 text-xs text-emerald-400">Saved ✓</span>}
        </div>
      )}
    </div>
  );
}

// ─── Branch Card ──────────────────────────────────────────────────────────────

function BranchCard({ branch, maxStaff }: { branch: Branch; maxStaff: number }) {
  const [expanded, setExpanded] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ['branch-staff', branch.id],
    queryFn: () => api.get(`/pharmacy/branch-staff/?branch=${branch.id}`).then(r => r.data.results ?? r.data),
    enabled: expanded,
  });

  const toggleActive = useMutation({
    mutationFn: () => api.post(`/pharmacy/branches/${branch.id}/toggle_active/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });

  const deleteBranch = useMutation({
    mutationFn: () => api.delete(`/pharmacy/branches/${branch.id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setConfirmDelete(false); },
  });

  const activeStaff = staffList?.filter(s => s.status === 'active').length ?? branch.staff_count;
  const usedSlots = staffList?.filter(s => s.status !== 'revoked').length ?? branch.staff_count;
  const slotPct = maxStaff > 0 ? (usedSlots / maxStaff) * 100 : 0;

  const typeColors: Record<string, string> = {
    main: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    satellite: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    warehouse: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <>
      {inviting && <InviteModal branchId={branch.id} branchName={branch.name} onClose={() => setInviting(false)} />}
      {editing && <EditBranchModal branch={branch} onClose={() => setEditing(false)} />}

      <div className={`bg-slate-800/50 backdrop-blur border rounded-2xl overflow-hidden transition-all duration-300 ${branch.is_active ? 'border-slate-700/50' : 'border-slate-700/30 opacity-60'}`}>
        {/* Card Header */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${branch.is_active ? 'bg-gradient-to-br from-blue-600 to-cyan-600' : 'bg-slate-700'}`}>
              <Building2 size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-white">{branch.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-slate-500 font-mono">{branch.code}</span>
                    {branch.city && <span className="text-xs text-slate-500">· {branch.city}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColors[branch.branch_type] ?? typeColors.satellite}`}>
                      {branch.branch_type.charAt(0).toUpperCase() + branch.branch_type.slice(1)}
                    </span>
                    {!branch.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive.mutate()}
                    title={branch.is_active ? 'Deactivate branch' : 'Activate branch'}
                    className={`p-1.5 rounded-lg transition border text-xs ${branch.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-700/50 text-slate-500 border-slate-600/40 hover:bg-slate-700'}`}
                  >
                    {branch.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  {/* Edit */}
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-600/40">
                    <Pencil size={14} />
                  </button>
                  {/* Delete */}
                  {confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button onClick={() => deleteBranch.mutate()} className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold">Yes</button>
                      <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Staff slot progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users size={12} />
                    <span>Staff Slots</span>
                  </div>
                  <span className={`text-xs font-semibold ${slotPct >= 90 ? 'text-red-400' : 'text-slate-300'}`}>
                    {usedSlots} / {maxStaff}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r transition-all ${slotPct >= 90 ? 'from-red-500 to-rose-500' : 'from-blue-500 to-cyan-500'}`}
                    style={{ width: `${Math.min(slotPct, 100)}%` }}
                  />
                </div>
                {activeStaff > 0 && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {activeStaff} active staff member{activeStaff !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="border-t border-slate-700/40 px-5 py-2 flex items-center justify-between">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition"
          >
            <Users size={13} />
            {expanded ? 'Hide Staff' : 'Manage Staff'}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {branch.is_active && usedSlots < maxStaff && (
            <button
              onClick={() => setInviting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-blue-500/20"
            >
              <Plus size={13} /> Invite Staff
            </button>
          )}
          {usedSlots >= maxStaff && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle size={12} /> Limit reached
            </span>
          )}
        </div>

        {/* Staff list */}
        {expanded && (
          <div className="border-t border-slate-700/40 p-4 bg-slate-900/20 space-y-2">
            {!staffList ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Users size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No staff members yet.</p>
                <p className="text-xs mt-1">Click "Invite Staff" to add the first member.</p>
              </div>
            ) : (
              staffList.map(s => <StaffRow key={s.id} staff={s} branchPharmacy={branch.id} />)
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Add Branch Modal ─────────────────────────────────────────────────────────

function AddBranchModal({ pharmacyId, onClose }: { pharmacyId: string; onClose: () => void }) {
  const [form, setForm] = useState({ pharmacy: pharmacyId, name: '', code: '', city: '', branch_type: 'satellite', username: '', password: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => api.post('/pharmacy/branches/', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || JSON.stringify(e?.response?.data) || 'Failed to create branch.'),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-5">Add New Branch</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Branch Name', key: 'name', placeholder: 'Downtown Branch' },
            { label: 'Branch Code', key: 'code', placeholder: 'DT-01' },
            { label: 'City', key: 'city', placeholder: 'Karachi' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
              <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch Type</label>
            <select value={form.branch_type} onChange={e => set('branch_type', e.target.value)} className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-blue-500/50">
              <option value="main">Main Branch</option>
              <option value="satellite">Satellite</option>
              <option value="warehouse">Warehouse</option>
            </select>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          <p className="text-xs text-slate-500 mb-3">Branch Manager Account (login credentials for this branch)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Manager Username</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="branch_manager_dt" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Manager Password</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition">Cancel</button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.name || !form.code || !form.username || !form.password}
            className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/20"
          >
            {create.isPending ? 'Creating…' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function BranchManagementPanel() {
  const [addingBranch, setAddingBranch] = useState(false);
  const subscription = useAuthStore(s => s.subscription);
  const user = useAuthStore(s => s.user);

  // pharmacyId comes from auth store; if missing, derive it from the first loaded branch
  const [resolvedPharmacyId, setResolvedPharmacyId] = useState<string | undefined>(user?.pharmacy_id);
  const plan = subscription?.plan_details ?? subscription?.plan ?? null;
  const maxBranches = plan?.max_branches ?? 1;
  const maxStaff = plan?.max_devices_per_branch ?? 1;

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/pharmacy/branches/').then(r => r.data.results ?? r.data),
    onSuccess: (data: Branch[]) => {
      // Derive pharmacyId from first branch if not already known
      if (!resolvedPharmacyId && data.length > 0) {
        const b = data[0] as any;
        if (b.pharmacy) setResolvedPharmacyId(String(b.pharmacy));
      }
    },
  } as any);

  // Keep resolvedPharmacyId in sync when user store updates
  useEffect(() => {
    if (user?.pharmacy_id) setResolvedPharmacyId(user.pharmacy_id);
  }, [user?.pharmacy_id]);

  const staffCounts = (branches ?? []).reduce((acc, b) => ({ ...acc, [b.id]: b.staff_count ?? 0 }), {});

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {addingBranch && <AddBranchModal pharmacyId={resolvedPharmacyId ?? ''} onClose={() => setAddingBranch(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 size={26} className="text-blue-400" />
            Branch Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage branches, invite staff, and control access permissions</p>
        </div>
        <button
          onClick={() => setAddingBranch(true)}
          disabled={!!branches && branches.length >= maxBranches}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} /> New Branch
        </button>
      </div>

      {/* Usage meter */}
      <BranchUsageMeter
        branchCount={branches?.length ?? 0}
        maxBranches={maxBranches}
        staffCounts={staffCounts}
        maxStaff={maxStaff}
      />

      {/* Branch list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading branches…</p>
          </div>
        </div>
      ) : !branches || branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-5">
            <Building2 size={36} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No Branches Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mb-6">
            Create your first branch to start inviting staff and managing access.
          </p>
          <button
            onClick={() => setAddingBranch(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} /> Create First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {branches.map(b => (
            <BranchCard key={b.id} branch={b} maxStaff={maxStaff} />
          ))}
        </div>
      )}

      {/* How it works hint */}
      <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
        <p className="text-xs text-blue-300/70 text-center">
          💡 <strong>How it works:</strong> Invite staff → They receive an OTP code via email → They <span className="text-amber-300 font-medium">verbally share the OTP with you</span> → Click <strong>"Activate"</strong> on their card and set their username &amp; password → They log in. Staff can reset their own password anytime via "Forgot Password".
        </p>
      </div>
    </div>
  );
}
