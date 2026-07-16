// ============================================================
// License Manager — manages local encrypted license token
// Handles 30-day validation window & lock state calculation
// ============================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

const LICENSE_FILE = path.join(app.getPath('userData'), 'license.dat');
const ENCRYPTION_KEY_SEED = 'PharmacyPro_License_Key_v1';
const VALIDATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const WARN_DAYS = 5;

export type LicenseType = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'LIFETIME' | 'SUSPENDED';
export type LockReason =
  | 'device_mismatch'
  | 'license_expired'
  | 'subscription_expired'
  | 'validation_overdue'
  | 'suspended'
  | 'pending_approval'
  | 'no_license';

export interface StoredLicense {
  user_id: number;
  device_id: number;
  email: string;
  name: string;
  role: string;
  license_type: LicenseType;
  expires_at: string | null;
  issued_at: string;
  last_validation: string;
  access_token: string;
  refresh_token: string;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  plan_name?: string;
  staff_permissions?: any;
  is_staff_member?: boolean;
}

export interface AppLockState {
  locked: boolean;
  read_only: boolean;
  reason?: LockReason;
  warning?: string;
  days_remaining?: number;
}

// ---- Encryption helpers ----------------------------------------

function deriveKey(): Buffer {
  return crypto.scryptSync(ENCRYPTION_KEY_SEED, 'PharmacySalt2026', 32);
}

function encrypt(text: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ---- Public API ------------------------------------------------

export function saveLicense(license: StoredLicense): void {
  const json = JSON.stringify(license);
  const encrypted = encrypt(json);
  fs.writeFileSync(LICENSE_FILE, encrypted, 'utf8');
}

export function loadLicense(): StoredLicense | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const encrypted = fs.readFileSync(LICENSE_FILE, 'utf8');
    const json = decrypt(encrypted);
    return JSON.parse(json) as StoredLicense;
  } catch {
    return null;
  }
}

export function clearLicense(): void {
  if (fs.existsSync(LICENSE_FILE)) {
    fs.unlinkSync(LICENSE_FILE);
  }
}

export function updateValidationTimestamp(): void {
  const license = loadLicense();
  if (license) {
    license.last_validation = new Date().toISOString();
    saveLicense(license);
  }
}

export function updateTokens(access_token: string, refresh_token: string): void {
  const license = loadLicense();
  if (license) {
    license.access_token = access_token;
    license.refresh_token = refresh_token;
    saveLicense(license);
  }
}

/**
 * Calculate the current lock state based on stored license data.
 * This runs fully offline — no network call needed.
 */
export function calculateLockState(
  license: StoredLicense | null,
  deviceFingerprint: string
): AppLockState {
  // No license file
  if (!license) {
    return { locked: true, read_only: false, reason: 'no_license' };
  }

  // Admin users are never locked
  if (license.role === 'admin') {
    return { locked: false, read_only: false };
  }

  const now = new Date();

  // 30-day validation check
  const lastValidation = new Date(license.last_validation);
  const daysSinceValidation = (now.getTime() - lastValidation.getTime()) / 86400000;
  if (daysSinceValidation > 30) {
    return {
      locked: true,
      read_only: false,
      reason: 'validation_overdue',
      warning: 'Online validation required. Please connect to the internet.',
    };
  }

  // Suspended
  if (license.license_type === 'SUSPENDED') {
    return { locked: true, read_only: true, reason: 'suspended', warning: 'Account suspended. Contact support.' };
  }

  // Check subscription expiry (non-lifetime)
  if (license.license_type !== 'LIFETIME' && license.expires_at) {
    const expiry = new Date(license.expires_at);
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

    if (expiry < now) {
      return {
        locked: false,
        read_only: false,
        reason: 'subscription_expired',
        warning: 'Subscription expired. Please renew.',
        days_remaining: daysRemaining,
      };
    }

    // Warning period
    if (daysRemaining <= WARN_DAYS) {
      return {
        locked: false,
        read_only: false,
        warning: `Subscription expires in ${daysRemaining} day(s). Please renew soon.`,
        days_remaining: daysRemaining,
      };
    }
  }

  return { locked: false, read_only: false };
}
