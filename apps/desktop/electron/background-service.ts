// ============================================================
// Background Validation Service
// Runs in main process, checks license every 5 minutes when online
// ============================================================

import { net } from 'electron';
import {
  loadLicense,
  saveLicense,
  updateValidationTimestamp,
  updateTokens,
  StoredLicense,
} from './license-manager';
import { getDeviceFingerprint } from './device-fingerprint';

const SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:9000';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const VALIDATION_THRESHOLD_MS = 28 * 24 * 60 * 60 * 1000; // check if 28+ days since last (2-day buffer)

let intervalId: NodeJS.Timeout | null = null;
let lastAttempt: Date | null = null;

export function startBackgroundService(): void {
  console.log('[BG] Background validation service starting…');
  runValidation(); // Run immediately on startup
  intervalId = setInterval(runValidation, CHECK_INTERVAL_MS);
}

export function stopBackgroundService(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function runValidation(): Promise<void> {
  if (!net.isOnline()) {
    console.log('[BG] Offline — skipping validation');
    return;
  }

  const license = loadLicense();
  if (!license) {
    console.log('[BG] No license found — skipping');
    return;
  }

  const now = new Date();
  const lastValidation = new Date(license.last_validation);
  const msSinceLast = now.getTime() - lastValidation.getTime();

  if (msSinceLast < VALIDATION_THRESHOLD_MS) {
    console.log('[BG] Validation not yet due');
    return;
  }

  console.log('[BG] Validation due — contacting server…');
  lastAttempt = now;

  try {
    // Try token refresh first
    await tryRefreshToken(license);

    // Then validate license
    const freshLicense = loadLicense();
    if (!freshLicense) return;

    const { fingerprint } = await getDeviceFingerprint();

    const response = await fetch(`${SERVER_URL}/api/license/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${freshLicense.access_token}`,
      },
      body: JSON.stringify({ device_fingerprint: fingerprint }),
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const data = await response.json() as any;
      if (data.valid) {
        updateValidationTimestamp();
        console.log('[BG] License validated successfully');
      }
    } else if (response.status === 402 || response.status === 403) {
      // License/subscription issue — keep going but mark locally
      console.warn('[BG] License issue detected:', response.status);
    }
  } catch (err) {
    console.warn('[BG] Validation request failed (will retry later):', err);
  }
}

async function tryRefreshToken(license: StoredLicense): Promise<void> {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: license.refresh_token }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const { access_token, refresh_token } = await response.json() as any;
      updateTokens(access_token, refresh_token);
      console.log('[BG] Tokens refreshed');
    }
  } catch {
    // Silent fail — access token still valid for 15 min
  }
}

export function getLastAttempt(): Date | null {
  return lastAttempt;
}
