// ============================================================
// Shared Types — used by both server and desktop app
// ============================================================

// ---- License & Subscription --------------------------------

export type LicenseType = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'LIFETIME' | 'SUSPENDED';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';
export type DeviceStatus = 'active' | 'revoked' | 'pending';
export type UserRole = 'admin' | 'pharmacist' | 'staff';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  license_type: LicenseType;
  approved: boolean;
  status: UserStatus;
  created_at: string;
}

export interface Device {
  id: number;
  user_id: number;
  device_fingerprint: string;
  device_name: string;
  activated_at: string;
  last_seen: string;
  status: DeviceStatus;
}

export interface License {
  id: number;
  user_id: number;
  token: string;
  last_validation: string;
  expires_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan: LicenseType;
  expiry_date: string;
  status: SubscriptionStatus;
}

export interface ActivationRequest {
  id: number;
  user_id: number;
  device_fingerprint: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

// ---- Local License Token (stored encrypted on disk) --------

export interface LocalLicenseToken {
  user_id: number;
  device_id: number;
  email: string;
  name: string;
  role: UserRole;
  license_type: LicenseType;
  expires_at: string | null;        // null = lifetime
  issued_at: string;
  last_validation: string;
  signature: string;
}

// ---- Validation Result (from server) -----------------------

export interface ValidationResult {
  valid: boolean;
  license_type: LicenseType;
  expires_at: string | null;
  days_remaining: number | null;
  requires_renewal: boolean;
  message?: string;
}

// ---- App Lock State ----------------------------------------

export type LockReason =
  | 'device_mismatch'
  | 'license_expired'
  | 'subscription_expired'
  | 'validation_overdue'
  | 'suspended'
  | 'pending_approval';

export interface AppLockState {
  locked: boolean;
  reason?: LockReason;
  read_only?: boolean;          // true = can view/export but not edit
  warning?: string;
  days_remaining?: number;
}

// ---- IPC Channels (Electron Main ↔ Renderer) ---------------

export type IpcChannel =
  | 'license:get-status'
  | 'license:activate'
  | 'license:validate-online'
  | 'auth:login'
  | 'auth:logout'
  | 'db:query'
  | 'db:run'
  | 'update:check'
  | 'device:get-fingerprint'
  | 'app:get-lock-state';

// ---- API Request/Response shapes ---------------------------

export interface LoginRequest {
  email: string;
  password: string;
  device_fingerprint: string;
  device_name: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  license: LocalLicenseToken;
  validation: ValidationResult;
}

export interface ActivateDeviceRequest {
  device_fingerprint: string;
  device_name: string;
}

export interface ValidateLicenseResponse {
  valid: boolean;
  token: string;
  validation: ValidationResult;
}

// ---- SQLite local tables -----------------------------------

export interface Medicine {
  id?: number;
  name: string;
  barcode?: string;
  batch_no?: string;
  expiry_date?: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  supplier?: string;
  category?: string;
  dosage_form?: string;
  strength?: string;
  reorder_level?: number;
  created_at?: string;
}

export interface Sale {
  id?: number;
  invoice_no: string;
  customer_name?: string;
  total: number;
  discount?: number;
  tax?: number;
  payment_method: 'cash' | 'card' | 'credit';
  created_at?: string;
}

export interface SaleItem {
  id?: number;
  sale_id: number;
  medicine_id: number;
  quantity: number;
  unit_price: number;
  total?: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  outstanding_balance?: number;
  created_at?: string;
}

export interface Supplier {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  created_at?: string;
}
