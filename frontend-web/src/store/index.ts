import { create } from 'zustand';

export interface PlanFeatures {
  max_medicines: number | null;
  max_customers: number | null;
  has_pos: boolean;
  has_inventory: boolean;
  has_transaction_history: boolean;
  has_dues: boolean;
  has_customer_management: boolean;
  has_analytics: boolean;
  has_accounting: boolean;
  has_purchase_management: boolean;
  has_prescriptions: boolean;
  has_desktop_app: boolean;
  has_api_access: boolean;
  has_multi_branch: boolean;
}

export interface StaffPermissions {
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

export const ADMIN_FEATURES: PlanFeatures = {
  max_medicines: null, max_customers: null,
  has_pos: true, has_inventory: true, has_transaction_history: true,
  has_dues: true, has_customer_management: true, has_analytics: true,
  has_accounting: true, has_purchase_management: true, has_prescriptions: true,
  has_desktop_app: true, has_api_access: true, has_multi_branch: true,
};

interface AuthState {
  token: string | null;
  user: any | null;
  subscription: any | null;
  features: PlanFeatures | null;
  staffPermissions: StaffPermissions | null;
  login: (token: string, user: any) => void;
  logout: () => void;
  setSubscription: (sub: any) => void;
  setFeatures: (f: PlanFeatures | null) => void;
  setStaffPermissions: (p: StaffPermissions | null) => void;
}

const safeParseJSON = (key: string, fallback: any = null) => {
  try {
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined') return fallback;
    return JSON.parse(val);
  } catch { return fallback; }
};

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: safeParseJSON('user'),
  subscription: safeParseJSON('subscription'),
  features: safeParseJSON('features'),
  staffPermissions: safeParseJSON('staffPermissions'),
  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Persist staff permissions from login response if present
    if (user?.staff_permissions) {
      localStorage.setItem('staffPermissions', JSON.stringify(user.staff_permissions));
    } else {
      localStorage.removeItem('staffPermissions');
    }
    set({ token, user, staffPermissions: user?.staff_permissions ?? null });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('subscription');
    localStorage.removeItem('features');
    localStorage.removeItem('staffPermissions');
    set({ token: null, user: null, subscription: null, features: null, staffPermissions: null });
  },
  setSubscription: (sub) => {
    if (sub) localStorage.setItem('subscription', JSON.stringify(sub));
    else localStorage.removeItem('subscription');
    set({ subscription: sub });
  },
  setFeatures: (f) => {
    if (f) localStorage.setItem('features', JSON.stringify(f));
    else localStorage.removeItem('features');
    set({ features: f });
  },
  setStaffPermissions: (p) => {
    if (p) localStorage.setItem('staffPermissions', JSON.stringify(p));
    else localStorage.removeItem('staffPermissions');
    set({ staffPermissions: p });
  },
}));

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  viewingAsRole: 'pharmacist' | 'admin';
  setViewingAsRole: (role: 'pharmacist' | 'admin') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  viewingAsRole: (typeof window !== 'undefined' ? localStorage.getItem('viewingAsRole') : null) as any || 'pharmacist',
  setViewingAsRole: (role) => {
    if (typeof window !== 'undefined') localStorage.setItem('viewingAsRole', role);
    set({ viewingAsRole: role });
  },
}));
