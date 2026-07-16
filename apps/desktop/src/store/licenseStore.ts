import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LicenseType = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'LIFETIME' | 'SUSPENDED';
export type LockReason = 'device_mismatch' | 'license_expired' | 'subscription_expired' | 'validation_overdue' | 'suspended' | 'pending_approval' | 'no_license';

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

export const ALL_FEATURES: PlanFeatures = {
  max_medicines: null, max_customers: null,
  has_pos: true, has_inventory: true, has_transaction_history: true,
  has_dues: true, has_customer_management: true, has_analytics: true,
  has_accounting: true, has_purchase_management: true, has_prescriptions: true,
  has_desktop_app: true, has_api_access: true, has_multi_branch: true,
};

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  license_type: LicenseType;
  features?: PlanFeatures;
  access_token?: string;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  plan_name?: string;
}

export interface LockState {
  locked: boolean;
  read_only: boolean;
  reason?: LockReason;
  warning?: string;
  days_remaining?: number;
}

interface LicenseState {
  user: AppUser | null;
  lockState: LockState;
  isLoading: boolean;
  isOnline: boolean;

  setUser: (user: AppUser | null) => void;
  setLockState: (lockState: LockState) => void;
  setLoading: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  logout: () => Promise<void>;
  refreshLockState: () => Promise<void>;
}

const api = (window as any).electronAPI;

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      user: null,
      lockState: { locked: false, read_only: false },
      isLoading: false,
      isOnline: navigator.onLine,

      setUser: (user) => set({ user }),
      setLockState: (lockState) => set({ lockState }),
      setLoading: (v) => set({ isLoading: v }),
      setOnline: (v) => set({ isOnline: v }),

      logout: async () => {
        await api?.invoke('auth:logout');
        set({ user: null, lockState: { locked: false, read_only: false } });
      },

      refreshLockState: async () => {
        if (!api) return;
        const result = await api.invoke('license:get-status');
        if (result?.lockState) {
          set({ lockState: result.lockState });
        }
        if (result?.license) {
          const lic = result.license;
          const existing = get().user;
          set({
            user: {
              id: lic.user_id,
              name: lic.name,
              email: lic.email,
              role: lic.role,
              license_type: lic.license_type,
              access_token: lic.access_token || '',
              // Preserve subscription fields stored in license file since v1.0.16
              subscription_status: lic.subscription_status ?? existing?.subscription_status,
              subscription_expires_at: lic.subscription_expires_at ?? existing?.subscription_expires_at,
              plan_name: lic.plan_name ?? existing?.plan_name ?? 'Premium',
              // Preserve features from the persisted user if not in license
              features: existing?.features,
              staff_permissions: lic.staff_permissions ?? null,
              is_staff_member: lic.is_staff_member ?? false,
            },
          });
        }
      },
    }),
    {
      name: 'pharmacy-license-store',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
