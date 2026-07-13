// ============================================================
// Electron Main Process
// ============================================================

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, net as electronNet } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import {
  initDatabase, dbQuery, dbGet, dbRun, dbTransaction, medicinesDB, salesDB, customersDB, settingsDB,
  purchasesDB, prescriptionsDB, expensesDB, returnsDB, paymentsDB, stockMovementsDB, auditLogDB,
  reportingDB, suppliersDB, duesDB, transactionsDB
} from './sqlite-db';
import { getDeviceFingerprint } from './device-fingerprint';
import { loadLicense, saveLicense, calculateLockState, clearLicense, StoredLicense } from './license-manager';
import { startBackgroundService, stopBackgroundService } from './background-service';

const isDev = process.env.NODE_ENV === 'development';
const SERVER_URL = process.env.LICENSE_SERVER_URL || (isDev ? 'http://localhost:8000' : 'https://pharmacy-django-fj01.onrender.com');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ============================================================
// No Local Server Needed (Cloud-First Mode)
// ============================================================


const toOptionalText = (value: any) => {
  if (value == null) return undefined;
  const text = String(value).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return text ? text : undefined;
};

const toOptionalName = (value: any) => {
  const text = toOptionalText(value);
  return text ? text.replace(/\s+/g, ' ') : undefined;
};

const toOptionalBarcode = (value: any) => {
  const text = toOptionalText(value);
  return text ? text.replace(/\s+/g, '') : undefined;
};

const normalizeLookupText = (value: any) => toOptionalName(value)?.toLowerCase();

const toNumberOr = (value: any, fallback = 0) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMedicinePayload = (medicine: any) => ({
  name: toOptionalName(medicine?.name || medicine?.generic_name),
  barcode: toOptionalBarcode(medicine?.barcode),
  batch_no: toOptionalText(medicine?.batch_no),
  manufacturing_date: toOptionalText(medicine?.manufacturing_date),
  expiry_date: toOptionalText(medicine?.expiry_date),
  quantity: toNumberOr(medicine?.quantity ?? medicine?.quantity_on_hand, 0),
  min_quantity: medicine?.min_quantity === '' ? undefined : (medicine?.min_quantity == null ? undefined : toNumberOr(medicine?.min_quantity, 10)),
  max_quantity: medicine?.max_quantity === '' ? undefined : (medicine?.max_quantity == null ? undefined : toNumberOr(medicine?.max_quantity, 100)),
  purchase_price: toNumberOr(medicine?.purchase_price, 0),
  selling_price: toNumberOr(medicine?.selling_price, 0),
  mrp: medicine?.mrp === '' ? undefined : (medicine?.mrp == null ? undefined : toNumberOr(medicine?.mrp, 0)),
  supplier: toOptionalText(medicine?.supplier),
  category: toOptionalText(medicine?.category) || 'General',
  subcategory: toOptionalText(medicine?.subcategory),
  dosage_form: toOptionalText(medicine?.dosage_form),
  strength: toOptionalText(medicine?.strength),
  manufacturer: toOptionalText(medicine?.manufacturer),
  registration_no: toOptionalText(medicine?.registration_no),
  reorder_level: medicine?.reorder_level === '' ? undefined : (medicine?.reorder_level == null ? undefined : toNumberOr(medicine?.reorder_level, 20)),
  created_by: toOptionalText(medicine?.created_by),
});

const findExistingMedicineForImport = (payload: ReturnType<typeof normalizeMedicinePayload>) => {
  if (payload.barcode) {
    const existingByBarcode = medicinesDB.getByBarcode(payload.barcode);
    if (existingByBarcode && existingByBarcode.status !== 'discontinued') return existingByBarcode;

    const existingByNormalizedBarcode = medicinesDB.getAll().find(
      (medicine: any) => medicine.status !== 'discontinued' && toOptionalBarcode(medicine.barcode) === payload.barcode
    );
    if (existingByNormalizedBarcode) return existingByNormalizedBarcode;
  }

  const normalizedName = normalizeLookupText(payload.name);
  if (!normalizedName) return undefined;

  return medicinesDB.getAll().find(
    (medicine: any) => medicine.status !== 'discontinued' && normalizeLookupText(medicine.name) === normalizedName
  );
};

const findMedicineMatches = (payload: ReturnType<typeof normalizeMedicinePayload>) => {
  const barcodeMatch = payload.barcode
    ? (medicinesDB.getByBarcode(payload.barcode) || medicinesDB.getAll().find(
        (medicine: any) => toOptionalBarcode(medicine.barcode) === payload.barcode
      )) as any | undefined
    : undefined;

  // Only match active medicines — discontinued ones should be treated as non-existent
  // so that re-adding a deleted medicine creates a fresh record (not an increment).
  const activeBarcodeMatch = barcodeMatch?.status !== 'discontinued' ? barcodeMatch : undefined;

  const nameMatchRaw = payload.name
    ? medicinesDB.getByNormalizedName(payload.name) || medicinesDB.getAll().find(
        (medicine: any) => normalizeLookupText(medicine.name) === normalizeLookupText(payload.name)
      )
    : undefined;
  const nameMatch = (nameMatchRaw as any)?.status !== 'discontinued' ? nameMatchRaw : undefined;

  return { barcodeMatch: activeBarcodeMatch, nameMatch };
};

const resolveMedicineTarget = (
  payload: ReturnType<typeof normalizeMedicinePayload>
) => {
  const { barcodeMatch, nameMatch } = findMedicineMatches(payload);

  if (barcodeMatch && nameMatch && barcodeMatch.id !== nameMatch.id) {
    return {
      target: nameMatch,
      barcode: nameMatch.barcode ?? undefined,
      conflict: true,
      conflictReason: 'barcode-matched-different-medicine',
    };
  }

  if (nameMatch) {
    return {
      target: nameMatch,
      barcode: payload.barcode,
      conflict: false,
    };
  }

  if (barcodeMatch) {
    const sameName = normalizeLookupText(barcodeMatch.name) === normalizeLookupText(payload.name);
    if (!sameName) {
      return {
        target: undefined,
        barcode: undefined,
        conflict: true,
        conflictReason: 'barcode-belongs-to-different-medicine',
      };
    }

    return {
      target: barcodeMatch,
      barcode: payload.barcode,
      conflict: false,
    };
  }

  return {
    target: undefined,
    barcode: payload.barcode,
    conflict: false,
  };
};

const buildMedicineUpdatePayload = (
  existing: any,
  payload: ReturnType<typeof normalizeMedicinePayload>,
  quantityMode: 'replace' | 'increment'
) => ({
  name: payload.name ?? existing.name,
  barcode: payload.barcode ?? existing.barcode ?? null,
  batch_no: payload.batch_no ?? existing.batch_no,
  manufacturer: payload.manufacturer ?? existing.manufacturer,
  manufacturing_date: payload.manufacturing_date ?? existing.manufacturing_date,
  expiry_date: payload.expiry_date ?? existing.expiry_date,
  quantity: quantityMode === 'increment'
    ? toNumberOr(existing.quantity, 0) + payload.quantity
    : payload.quantity,
  purchase_price: payload.purchase_price || toNumberOr(existing.purchase_price, 0),
  selling_price: payload.selling_price || toNumberOr(existing.selling_price, 0),
  reorder_level: payload.reorder_level ?? existing.reorder_level ?? 20,
  min_quantity: payload.min_quantity ?? existing.min_quantity,
  max_quantity: payload.max_quantity ?? existing.max_quantity,
  category: payload.category ?? existing.category,
  dosage_form: payload.dosage_form ?? existing.dosage_form,
  strength: payload.strength ?? existing.strength,
  status: 'active',
});

const recoverMedicineConflict = (payload: ReturnType<typeof normalizeMedicinePayload>) => {
  if (payload.barcode) {
    const byBarcode = medicinesDB.getByBarcode(payload.barcode);
    if (byBarcode) return byBarcode;
  }

  if (payload.name) {
    const byNormalizedName = medicinesDB.getByNormalizedName(payload.name);
    if (byNormalizedName) return byNormalizedName;
  }

  return findExistingMedicineForImport(payload);
};

const upsertMedicine = (
  payload: ReturnType<typeof normalizeMedicinePayload>,
  quantityMode: 'replace' | 'increment'
) => {
  const name = payload.name;
  if (!name) {
    throw new Error('Medicine name is required');
  }

  const resolution = resolveMedicineTarget(payload);
  if (resolution.conflict) {
    console.warn('[IPC] medicine identity conflict resolved by dropping incoming barcode:', {
      reason: resolution.conflictReason,
      name: payload.name,
      barcode: payload.barcode,
    });
  }

  const effectivePayload = {
    ...payload,
    barcode: resolution.barcode,
  };

  const applyUpdate = (existing: any) => {
    medicinesDB.update(existing.id, buildMedicineUpdatePayload(existing, effectivePayload, quantityMode));
    return medicinesDB.getById(existing.id) || existing;
  };

  const existing = resolution.target;
  if (existing) {
    return { action: 'updated' as const, row: applyUpdate(existing) };
  }

  try {
    const result = medicinesDB.create({ ...effectivePayload, name });
    const id = Number(result.lastInsertRowid);
    return { action: 'created' as const, row: medicinesDB.getById(id) || { id, ...effectivePayload } };
  } catch (err: any) {
    if (!/UNIQUE constraint failed: medicines\.(name|barcode)/i.test(err?.message || '')) {
      throw err;
    }

    const recovered = recoverMedicineConflict(effectivePayload);
    if (!recovered) {
      throw err;
    }

    return { action: 'updated' as const, row: applyUpdate(recovered) };
  }
};

// ---- Prevent multiple instances --------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ---- Create Window ---------------------------------------------

function createWindow(): void {
  const iconPath = path.join(__dirname, '../public/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Medicly',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of closing
    if (tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

// ---- System Tray -----------------------------------------------

function createTray(): void {
  try {
    const iconPath = path.join(__dirname, '../public/icon-tray.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Medicly', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.quit(); } },
    ]);

    tray.setToolTip('Medicly');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow?.show());
  } catch (err) {
    console.warn('[Tray] Could not create system tray icon:', err);
  }
}

// ---- App Ready -------------------------------------------------

app.whenReady().then(async () => {
  try {
    initDatabase();
  } catch (err) {
    console.error('SQLite init failed:', err);
  }

  createWindow();
  createTray();
  startBackgroundService();

  // ── Silent background auto-updater (production only) ──────────────────────────
  if (!isDev) {
    // 1. Initialize SQLite completely locally (for offline POS storage)
    autoUpdater.autoDownload = true;
    // Install automatically the next time the user quits the app
    autoUpdater.autoInstallOnAppQuit = true;
    // Don't show a native system notification — we handle the UI ourselves
    autoUpdater.autoRunAppAfterInstall = true;

    // Push events to the renderer so the UI can show a subtle banner
    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      mainWindow?.webContents.send('updater:update-available', info);
    });

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('updater:download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded, will install on quit:', info.version);
      mainWindow?.webContents.send('updater:update-ready', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message);
    });

    // First check on startup (delayed so the main window is fully loaded)
    setTimeout(() => { 
      if (electronNet.isOnline()) {
        autoUpdater.checkForUpdates().catch(console.error); 
      }
    }, 8000);

    // Then re-check every 4 hours silently
    setInterval(() => { 
      if (electronNet.isOnline()) {
        autoUpdater.checkForUpdates().catch(console.error); 
      }
    }, 4 * 60 * 60 * 1000);
  }
})

app.on('before-quit', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackgroundService();
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

// ============================================================
// IPC Handlers
// ============================================================

// ---- Auth: Login (Cloud-First Mode) -----------
ipcMain.handle('auth:login', async (_event, { email, password }) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
      signal: AbortSignal.timeout(15000),
    });
    
    const data = await response.json() as any;
    if (!response.ok) {
      return { success: false, error: data.detail || data.non_field_errors?.[0] || 'Invalid credentials or subscription expired.' };
    }

    const userPayload = data.user || {};
    const features = data?.subscription_details?.plan_details?.features_config || data?.features || null;
    const subStatus = data.subscription_status || userPayload.subscription_status || 'active';
    const expiresAt = data.subscription_expires_at || userPayload.subscription_expires_at || null;

    const isActive = subStatus === 'active' && (!expiresAt || new Date(expiresAt) > new Date());
    if (!isActive) {
      return { success: false, code: 'SUBSCRIPTION_EXPIRED', error: 'Subscription is not active.' };
    }

    // Save minimal cloud license info locally so the app remembers who is logged in
    const localLicense: StoredLicense = {
      user_id: Number(userPayload.id) || 1,
      device_id: 0,
      email: userPayload.email || email,
      name: userPayload.first_name || userPayload.username || email,
      role: data.role || userPayload.role || 'pharmacist',
      license_type: subStatus === 'active' ? 'MONTHLY' : 'SUSPENDED',
      expires_at: expiresAt,
      issued_at: new Date().toISOString(),
      access_token: data.access,
      refresh_token: data.refresh || '',
      last_validation: new Date().toISOString(),
      staff_permissions: userPayload.staff_permissions ?? null,
      is_staff_member: userPayload.is_staff_member ?? false,
    };
    saveLicense(localLicense);

    return { 
      success: true, 
      access: data.access,
      refresh: data.refresh,
      cloudRole: data.role || userPayload.role || 'pharmacist',
      pharmacyId: data.pharmacy_id || userPayload.pharmacy_id,
      branchId: data.branch_id || userPayload.branch_id,
      subStatus,
      subscriptionExpiresAt: expiresAt,
      features,
      firstName: userPayload.first_name || userPayload.username || email,
      userId: userPayload.id,
      userEmail: userPayload.email,
      staffPermissions: userPayload.staff_permissions ?? null,
      isStaffMember: userPayload.is_staff_member ?? false,
    };
  } catch (err: any) {
    console.error('Login failed:', err);
    return { success: false, error: `Cannot reach Server (${SERVER_URL}). Please check your internet connection.` };
  }
});

// ---- Auth: Logout ---------------------------------------------
ipcMain.handle('auth:logout', async () => {
  clearLicense();
  return { success: true };
});

// ---- Auth: Change Password (Cloud Mode) -------------
ipcMain.handle('auth:change-password', async (_event, { current_password, new_password }) => {
  const license = loadLicense();
  if (!license) return { success: false, error: 'No license' };
  
  try {
    const cloudResponse = await fetch(`${SERVER_URL}/api/v1/auth/change-password/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${license.access_token}`
      },
      body: JSON.stringify({ current_password, new_password }),
      signal: AbortSignal.timeout(8000),
    });
    
    if (cloudResponse.ok) {
      return { success: true };
    } else {
      const cloudData = await cloudResponse.json() as any;
      return { success: false, error: cloudData.detail || cloudData.error || 'Password update failed.' };
    }
  } catch (err: any) {
    return { success: false, error: 'Server unreachable. Internet connection is required to change password.' };
  }
});

// ---- License: Get Status --------------------------------------
ipcMain.handle('license:get-status', async () => {
  const license = loadLicense();
  const { fingerprint } = await getDeviceFingerprint();

  // Admin always unlocked
  if (license?.role === 'admin') {
    return {
      license,
      lockState: { locked: false, read_only: false },
    };
  }

  const lockState = calculateLockState(license, fingerprint);
  return { license, lockState };
});

// ---- License: Validate Online (Online check with cloud) --------
ipcMain.handle('license:validate-online', async () => {
  const license = loadLicense();
  if (!license) return { success: false, error: 'No license' };

  try {
    const response = await fetch(`${SERVER_URL}/api/v1/subscriptions/my-subscription/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${license.access_token}`
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const sub = await response.json() as any;
      const updated: StoredLicense = {
        ...license,
        license_type: sub.status === 'active' ? 'MONTHLY' : 'SUSPENDED',
        expires_at: sub.expires_at || null,
        last_validation: new Date().toISOString(),
      };
      saveLicense(updated);
      return { success: true, validation: { valid: true } };
    } else if (response.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    } else {
      return { success: false, error: 'Failed to validate subscription with server.' };
    }
  } catch (err) {
    // Offline fallback if within 30 days
    const lastValidation = new Date(license.last_validation);
    const daysSinceValidation = (Date.now() - lastValidation.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceValidation <= 30) {
      const updated: StoredLicense = {
        ...license,
        last_validation: new Date().toISOString(),
      };
      saveLicense(updated);
      return { success: true, offlineFallback: true };
    }
    return { success: false, error: 'Connection failed and 30-day validation window has expired.' };
  }
});

// ---- App URLs Redirects ---------------------------------------
const getWebPortalUrl = () => {
  if (SERVER_URL.includes('localhost:8000') || SERVER_URL.includes('127.0.0.1:8000')) {
    return 'http://localhost:3000';
  }
  return SERVER_URL;
};

ipcMain.handle('app:open-url', async (_event, url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL scheme' };
});

ipcMain.handle('app:open-forgot-password', async () => {
  const webUrl = getWebPortalUrl();
  await shell.openExternal(`${webUrl}/login?mode=forgot`);
  return { success: true };
});

ipcMain.handle('app:open-renewal-page', async () => {
  const webUrl = getWebPortalUrl();
  await shell.openExternal(`${webUrl}/subscribe`);
  return { success: true };
});

// ---- Device: Get Fingerprint ----------------------------------
ipcMain.handle('device:get-fingerprint', async () => {
  return getDeviceFingerprint();
});

// ---- App: Get Lock State --------------------------------------
ipcMain.handle('app:get-lock-state', async () => {
  const license = loadLicense();
  const { fingerprint } = await getDeviceFingerprint();
  return calculateLockState(license, fingerprint);
});

// ---- DB: Query (read) -----------------------------------------
ipcMain.handle('db:query', async (_event, { sql, params }) => {
  try {
    return { success: true, data: dbQuery(sql, params || []) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- DB: Run (write) ------------------------------------------
ipcMain.handle('db:run', async (_event, { sql, params }) => {
  try {
    const result = dbRun(sql, params || []);
    return { success: true, lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Specific DB Helpers via IPC ------------------------------

ipcMain.handle('medicines:get-all', () => ({ success: true, data: medicinesDB.getActive() }));
ipcMain.handle('medicines:get-low-stock', () => ({ success: true, data: medicinesDB.getLowStock() }));
ipcMain.handle('medicines:create', (_e, m) => {
  try {
    const payload = normalizeMedicinePayload(m);
    const result = upsertMedicine(payload, 'replace');
    return { success: true, id: result.row.id, data: result.row };
  } catch (err: any) {
    console.error('[IPC] medicines:create error:', err.message);
    return { success: false, error: err.message };
  }
});
ipcMain.handle('medicines:update', (_e, { id, ...m }) => {
  try {
    const payload = normalizeMedicinePayload(m);
    const name = payload.name;
    if (!name) {
      throw new Error('Medicine name is required');
    }

    const current = medicinesDB.getById(Number(id));
    if (!current) {
      throw new Error('Medicine not found');
    }

    const { barcodeMatch, nameMatch } = findMedicineMatches(payload);
    const conflictingBarcode = barcodeMatch && barcodeMatch.id !== Number(id);
    const conflictingName = nameMatch && nameMatch.id !== Number(id);
    const safeBarcode = conflictingBarcode ? (current.barcode ?? null) : (payload.barcode ?? null);

    if (conflictingBarcode) {
      console.warn('[IPC] medicines:update ignored conflicting barcode for medicine:', {
        id,
        name,
        barcode: payload.barcode,
      });
    }
    if (conflictingName) {
      throw new Error('Another medicine with this name already exists');
    }

    const nextStatus = toOptionalText(m?.status) || current.status || 'active';

    medicinesDB.update(id, {
      name,
      barcode: safeBarcode,
      batch_no: payload.batch_no,
      manufacturer: payload.manufacturer,
      manufacturing_date: payload.manufacturing_date,
      expiry_date: payload.expiry_date,
      quantity: payload.quantity,
      purchase_price: payload.purchase_price,
      selling_price: payload.selling_price,
      reorder_level: payload.reorder_level,
      min_quantity: payload.min_quantity,
      max_quantity: payload.max_quantity,
      category: payload.category,
      dosage_form: payload.dosage_form,
      strength: payload.strength,
      status: nextStatus,
    });
    return { success: true };
  } catch (err: any) {
    console.error('[IPC] medicines:update error:', err.message);
    return { success: false, error: err.message };
  }
});
ipcMain.handle('medicines:delete', (_e, id) => {
  const medId = typeof id === 'number' ? id : id?.id;
  medicinesDB.delete(medId);
  return { success: true };
});

ipcMain.handle('sales:get-all', (_e, { limit, offset } = {}) => {
  try {
    const sales = salesDB.getAll(limit, offset) as any[];
    const saleIds = sales.map((s) => s.id).filter(Boolean);

    const itemsBySaleId = new Map<number, any[]>();
    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(',');
      const rows = dbQuery<any>(
      `SELECT
         si.id as item_id,
         si.sale_id as sale_id,
         si.medicine_id as medicine_id,
         si.medicine_name as medicine_name,
         si.quantity as quantity,
         si.unit_price as unit_price,
         si.discount as discount,
         si.tax as tax,
         m.name as m_name,
         m.quantity as m_quantity,
         m.selling_price as m_selling_price,
         m.purchase_price as m_purchase_price,
         m.category as m_category,
         m.dosage_form as m_dosage_form,
         m.strength as m_strength,
         m.manufacturer as m_manufacturer
       FROM sale_items si
       LEFT JOIN medicines m ON m.id = si.medicine_id
       WHERE si.sale_id IN (${placeholders})
       ORDER BY si.sale_id, si.id`,
      saleIds
    );

    for (const r of rows) {
      const list = itemsBySaleId.get(r.sale_id) || [];
      const medicine = r.medicine_id
        ? {
            id: r.medicine_id,
            generic_name: r.m_name || r.medicine_name || '',
            brand_name: '',
            category: r.m_category,
            dosage_form: r.m_dosage_form,
            strength: r.m_strength,
            manufacturer: r.m_manufacturer,
            quantity_on_hand: r.m_quantity ?? 0,
            selling_price: r.m_selling_price ?? r.unit_price ?? 0,
            purchase_price: r.m_purchase_price ?? 0,
          }
        : {
            id: null,
            generic_name: r.medicine_name || '',
            brand_name: '',
            quantity_on_hand: 0,
          };

      list.push({
        id: r.item_id,
        medicine,
        quantity_sold: r.quantity,
        unit_price: r.unit_price,
      });
      itemsBySaleId.set(r.sale_id, list);
    }
  }

  const shaped = sales.map((s) => ({
      ...s,
      date: s.created_at || s.invoice_date,
      total_amount: s.total,
      items: itemsBySaleId.get(s.id) || [],
      customer: s.customer_name ? { name: s.customer_name, phone: s.customer_phone } : undefined,
    }));

    return { success: true, data: shaped };
  } catch (err: any) {
    console.error('[IPC] sales:get-all error:', err.message);
    return { success: true, data: [] };
  }
});
ipcMain.handle('sales:create', (_e, { sale, items }) => {
  try {
    const id = salesDB.create(sale, items);
    return { success: true, id };
  } catch (err: any) {
    console.error('[IPC] sales:create error:', err.message);
    return { success: false, error: err.message };
  }
});
ipcMain.handle('sales:daily-summary', (_e, date) => ({
  success: true, data: salesDB.getDailySummary(date),
}));

ipcMain.handle('customers:get-all', () => ({ success: true, data: customersDB.getAll() }));
ipcMain.handle('customers:create', (_e, c) => {
  const r = customersDB.create(c);
  return { success: true, id: r.lastInsertRowid };
});
ipcMain.handle('customers:update', (_e, { id, data }) => {
  customersDB.update(id, data);
  return { success: true };
});

// ---- Purchases ------------------------------------------------
ipcMain.handle('purchases:get-all', (_e, { limit, offset } = {}) => {
  try {
    const purchases = purchasesDB.getAll(limit, offset) as any[];
    const purchaseIds = purchases.map((p) => p.id).filter(Boolean);
    const itemsByPurchaseId = new Map<number, any[]>();

    if (purchaseIds.length > 0) {
      const placeholders = purchaseIds.map(() => '?').join(',');
      const rows = dbQuery<any>(
        `SELECT
           pi.id as item_id,
           pi.purchase_id as purchase_id,
           pi.medicine_id as medicine_id,
           pi.medicine_name as medicine_name,
           pi.quantity as quantity,
           pi.unit_price as unit_price,
           m.name as m_name,
           m.quantity as m_quantity,
           m.selling_price as m_selling_price,
           m.purchase_price as m_purchase_price,
           m.category as m_category,
           m.dosage_form as m_dosage_form,
           m.strength as m_strength,
           m.manufacturer as m_manufacturer
         FROM purchase_items pi
         LEFT JOIN medicines m ON m.id = pi.medicine_id
         WHERE pi.purchase_id IN (${placeholders})
         ORDER BY pi.purchase_id, pi.id`,
        purchaseIds
      );

      for (const r of rows) {
        const list = itemsByPurchaseId.get(r.purchase_id) || [];
        const medicine = r.medicine_id
          ? {
              id: r.medicine_id,
              generic_name: r.m_name || r.medicine_name || '',
              brand_name: '',
              category: r.m_category,
              dosage_form: r.m_dosage_form,
              strength: r.m_strength,
              manufacturer: r.m_manufacturer,
              quantity_on_hand: r.m_quantity ?? 0,
              selling_price: r.m_selling_price ?? 0,
              purchase_price: r.m_purchase_price ?? r.unit_price ?? 0,
            }
          : {
              id: null,
              generic_name: r.medicine_name || '',
              brand_name: '',
              quantity_on_hand: 0,
            };

        list.push({
          id: r.item_id,
          medicine,
          quantity: r.quantity,
          unit_price: r.unit_price,
        });
        itemsByPurchaseId.set(r.purchase_id, list);
      }
    }

    return { success: true, data: purchases.map((p) => ({
      ...p,
      date: p.created_at || p.invoice_date,
      total_cost: p.total,
      items: itemsByPurchaseId.get(p.id) || [],
    })) };
  } catch (err: any) {
    console.error('[IPC] purchases:get-all error:', err.message);
    return { success: true, data: [] };
  }
});
ipcMain.handle('purchases:create', (_e, { purchase, items }) => {
  const id = purchasesDB.create(purchase, items);
  return { success: true, id };
});

// ---- Prescriptions --------------------------------------------
ipcMain.handle('prescriptions:get-all', (_e, { limit, offset } = {}) => ({
  success: true, data: prescriptionsDB.getAll(limit, offset)
}));
ipcMain.handle('prescriptions:create', (_e, { prescription, items }) => {
  const id = prescriptionsDB.create(prescription, items);
  return { success: true, id };
});
ipcMain.handle('prescriptions:update-status', (_e, { id, status, saleId }) => {
  prescriptionsDB.updateStatus(id, status, saleId);
  return { success: true };
});

// ---- Expenses -------------------------------------------------
// ---- Dues / Credit ------------------------------------------
ipcMain.handle('dues:get-all', (_e, { limit, offset } = {}) => ({
  success: true, data: duesDB.getAll(limit, offset)
}));
ipcMain.handle('dues:get-unpaid', () => ({
  success: true, data: duesDB.getUnpaid()
}));
ipcMain.handle('dues:get-by-customer', (_e, { customerId }) => ({
  success: true, data: duesDB.getByCustomer(customerId)
}));
ipcMain.handle('dues:create', (_e, data) => {
  try {
    const r = duesDB.create(data);
    return { success: true, id: r.lastInsertRowid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('dues:record-payment', (_e, { id, amount }) => {
  try {
    duesDB.recordPayment(id, amount);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Expenses -------------------------------------------------
ipcMain.handle('expenses:get-all', (_e, { limit, offset } = {}) => ({
  success: true, data: expensesDB.getAll(limit, offset)
}));
ipcMain.handle('expenses:create', (_e, expense) => {
  const r = expensesDB.create(expense);
  return { success: true, id: r.lastInsertRowid };
});
ipcMain.handle('expenses:monthly-total', (_e, { year, month }) => ({
  success: true, total: expensesDB.getTotalByMonth(year, month)?.total ?? 0
}));

// ---- Analytics ------------------------------------------------
ipcMain.handle('analytics:dashboard', (_e, { days } = {}) => {
  const periodDays = Math.max(1, Math.min(365, Number(days) || 30));
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const endDateStr = now.toISOString().split('T')[0];
  const start = new Date(now);
  start.setDate(start.getDate() - (periodDays - 1));
  const startDateStr = start.toISOString().split('T')[0];

  const dailySummary = salesDB.getDailySummary();
  const monthlySummary = salesDB.getMonthlySummary(year, month);
  const monthExpenses = expensesDB.getTotalByMonth(year, month)?.total ?? 0;

  const stock = reportingDB.getStockAnalysis();
  const salesAgg = reportingDB.getSalesAnalytics(periodDays);
  const customerAgg = reportingDB.getCustomerAnalytics();

  // Raw timestamp comparisons use the idx_sales_invoice_date index — date() wrapper kills index usage
  const startTs = startDateStr + ' 00:00:00';
  const endTs   = endDateStr   + ' 23:59:59';

  const dailySales = dbQuery<{ date: string; transactions: number; revenue: number }>(
    `SELECT substr(invoice_date,1,10) as date,
            COUNT(*) as transactions,
            COALESCE(SUM(total), 0) as revenue
     FROM sales
     WHERE invoice_date >= ? AND invoice_date <= ? AND status != 'voided'
     GROUP BY substr(invoice_date,1,10)
     ORDER BY substr(invoice_date,1,10)`,
    [startTs, endTs]
  );

  const cogsRow = dbGet<{ cogs: number }>(
    `SELECT COALESCE(SUM(si.quantity * COALESCE(m.purchase_price, 0)), 0) as cogs
     FROM sale_items si
     LEFT JOIN medicines m ON m.id = si.medicine_id
     LEFT JOIN sales s ON s.id = si.sale_id
     WHERE s.invoice_date >= ? AND s.invoice_date <= ? AND s.status != 'voided'`,
    [startTs, endTs]
  );
  const cogs = cogsRow?.cogs ?? 0;
  const grossMargin = salesAgg.total_revenue > 0 ? ((salesAgg.total_revenue - cogs) / salesAgg.total_revenue) * 100 : 0;

  const trend = dailySales.slice(-7).map((d) => d.revenue || 0);
  const salesTrend = trend.length >= 7 ? trend : Array.from({ length: 7 - trend.length }, () => 0).concat(trend);

  return {
    success: true,
    data: {
      // Legacy keys (used by older renderer code)
      today_sales: dailySummary?.count ?? 0,
      today_revenue: dailySummary?.revenue ?? 0,
      monthly_revenue: monthlySummary?.revenue ?? 0,
      monthly_sales: monthlySummary?.count ?? 0,
      monthly_expenses: monthExpenses,

      // Web KPI keys
      total_revenue: salesAgg.total_revenue ?? 0,
      total_sales: salesAgg.total_transactions ?? 0,
      total_customers: customerAgg.active_customers ?? 0,
      gross_margin: grossMargin,
      monthly_profit: (monthlySummary?.revenue ?? 0) - monthExpenses,

      // Inventory
      total_medicines: stock.total_medicines ?? 0,
      inventory_value: stock.inventory_value ?? 0,
      low_stock_count: stock.low_stock_count ?? 0,
      expiring_soon_count: stock.expiring_soon ?? 0,
      low_stock_items: stock.low_stock_items ?? [],
      expiring_items: stock.expiring_items ?? [],

      // Trend
      sales_trend: salesTrend,
      daily_sales: dailySales,
    }
  };
});

// ---- Transactions ---------------------------------------------
ipcMain.handle('transactions:get-history', (_e, { limit, offset, search, typeFilter, dateFrom, dateTo, sortOrder } = {}) => {
  try {
    console.log('[TX-DEBUG] RAW params:', JSON.stringify({ limit, offset, search, typeFilter, dateFrom, dateTo, sortOrder }));
    console.log('[TX-DEBUG] typeof limit:', typeof limit, '| typeof offset:', typeof offset);
    const data = transactionsDB.getHistory(limit, offset, search, typeFilter, dateFrom, dateTo, sortOrder);
    console.log('[TX-DEBUG] Returned rows:', data?.length, '| First row type:', data?.[0]?.type);
    return { success: true, data };
  } catch (error: any) {
    console.error('transactions:get-history error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transactions:get-stats', (_e, { search, typeFilter, dateFrom, dateTo } = {}) => {
  try {
    const data = transactionsDB.getHistoryStats(search, typeFilter, dateFrom, dateTo);
    return { success: true, data };
  } catch (error: any) {
    console.error('transactions:get-stats error:', error);
    return { success: false, error: error.message };
  }
});

// ---- Accounting: Report (per period) --------------------------
ipcMain.handle('accounting:report', (_e, { period } = {}) => {
  try {
    const p = (period || 'monthly') as 'daily' | 'monthly' | 'annual';
    return { success: true, data: reportingDB.getAccountingReport(p) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Accounting: Summary (daily + monthly + annual) -----------
ipcMain.handle('accounting:summary', () => {
  try {
    return { success: true, data: reportingDB.getAccountingSummary() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Analytics: Daily Sales Trend ----------------------------
ipcMain.handle('analytics:daily-sales', (_e, { days } = {}) => {
  try {
    const d = Math.max(1, Math.min(365, Number(days) || 30));
    return { success: true, data: reportingDB.getDailySalesTrend(d) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Analytics: Inventory Valuation --------------------------
ipcMain.handle('analytics:inventory-valuation', () => {
  try {
    return { success: true, data: reportingDB.getInventoryValuation() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Bulk Import ------------------------------------------------
ipcMain.handle('medicines:bulk-import', (_e, { items }: { items: any[] }) => {
  try {
    const startTime = Date.now();
    const isLarge = items.length >= 1000;
    if (isLarge) console.log(`[Desktop Bulk Import] Processing ${items.length} items...`);
    
    let created = 0, updated = 0, failed = 0;
    const results: any[] = [];
    
    // CRITICAL OPTIMIZATION: Single transaction for all operations
    // This reduces disk I/O and provides 10-100x speedup for large imports
    dbTransaction(() => {
      items.forEach((item: any, index: number) => {
        try {
          const payload = normalizeMedicinePayload(item);
          if (!payload.name) {
            failed++;
            return;
          }
          
          const result = upsertMedicine(payload, 'increment');
          if (result.action === 'created') created++;
          else updated++;
          
          // Only keep first 1000 results in memory to avoid bloat
          if (results.length < 1000) results.push(result.row);
          
          // Progress logging for large imports
          if (isLarge && (index + 1) % 1000 === 0) {
            console.log(`  Desktop processed ${index + 1}/${items.length} items...`);
          }
        } catch (err: any) {
          console.error(`  Item ${index} failed:`, err.message);
          failed++;
        }
      });
    });
    
    if (isLarge) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Desktop Bulk Import] Complete: ${created} created, ${updated} updated, ${failed} failed in ${elapsed}s`);
    }
    
    return {
      success: true,
      data: { created, updated, failed, total: items.length, results },
    };
  } catch (err: any) {
    console.error('[Desktop Bulk Import] Transaction failed:', err.message);
    return { success: false, error: err.message };
  }
});

// ---- Sync: Import All (Server → SQLite) -----------------------
ipcMain.handle('sync:import-all', (_e, { medicines, sales, customers, purchases }: any) => {
  try {
    // Clear existing data and import from server
    // NOTE: In a real app, you'd merge/upsert. For now, just clear and replace.
    dbRun('DELETE FROM sale_items');
    dbRun('DELETE FROM sales');
    dbRun('DELETE FROM medicines');
    dbRun('DELETE FROM customers');
    dbRun('DELETE FROM purchases');

    let medCount = 0, saleCount = 0, custCount = 0, purchaseCount = 0;

    if (medicines && Array.isArray(medicines)) {
      medicines.forEach((m: any) => {
        try {
          medicinesDB.create({
            name: m.generic_name || m.name,
            barcode: m.barcode,
            batch_no: m.batch_no,
            manufacturing_date: m.manufacturing_date,
            expiry_date: m.expiry_date,
            quantity: parseInt(m.quantity_on_hand) || 0,
            purchase_price: parseFloat(m.purchase_price) || 0,
            selling_price: parseFloat(m.selling_price) || 0,
            supplier: m.supplier,
            category: m.category,
            dosage_form: m.dosage_form,
            strength: m.strength,
            reorder_level: parseInt(m.reorder_level) || 20,
          });
          medCount++;
        } catch { /* skip bad records */ }
      });
    }

    if (customers && Array.isArray(customers)) {
      customers.forEach((c: any) => {
        try {
          customersDB.create({
            name: c.name,
            phone: c.phone,
            address: c.address,
            email: c.email,
          });
          custCount++;
        } catch { /* skip bad records */ }
      });
    }

    if (sales && Array.isArray(sales)) {
      sales.forEach((s: any) => {
        try {
          const subtotal = s.total_amount || s.total || 0;
          const discountAmount = s.discount_amount || 0;
          const taxAmount = s.tax_amount || 0;
          const total = subtotal - discountAmount + taxAmount;
          const r = salesDB.create(
            {
              invoice_no: s.invoice_no || `INV-${s.id}`,
              customer_id: s.customer_id,
              customer_name: s.customer_name,
              customer_phone: s.customer_phone,
              subtotal,
              discount_amount: discountAmount,
              discount_percent: 0,
              tax_amount: taxAmount,
              tax_percent: 0,
              total,
              amount_paid: s.amount_paid || 0,
              payment_method: s.payment_method || 'cash',
              payment_status: s.payment_status || 'completed',
              notes: s.notes,
            },
            s.items || []
          );
          saleCount++;
        } catch { /* skip bad records */ }
      });
    }

    if (purchases && Array.isArray(purchases)) {
      purchases.forEach((p: any) => {
        try {
          const subtotal = p.total_cost || p.total || 0;
          const discountAmount = p.discount_amount || 0;
          const taxAmount = p.tax_amount || 0;
          const total = subtotal - discountAmount + taxAmount;
          purchasesDB.create(
            {
              invoice_no: p.invoice_no || `PUR-${p.id}`,
              supplier_id: p.supplier_id,
              supplier_name: p.supplier_name,
              subtotal,
              discount_amount: discountAmount,
              discount_percent: 0,
              tax_amount: taxAmount,
              tax_percent: 0,
              total,
              amount_paid: p.amount_paid || 0,
              payment_method: p.payment_method || 'bank',
              notes: p.notes,
            },
            p.items || []
          );
          purchaseCount++;
        } catch { /* skip bad records */ }
      });
    }

    return {
      success: true,
      counts: { medicines: medCount, sales: saleCount, customers: custCount, purchases: purchaseCount },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Medicines extra ------------------------------------------
ipcMain.handle('medicines:get-expiring', (_e, { days } = { days: 30 }) => ({
  success: true, data: medicinesDB.getExpiringSoon(days)
}));

// ---- Sales extra ----------------------------------------------
ipcMain.handle('sales:get-by-id', (_e, id) => ({
  success: true,
  data: salesDB.getById(id),
  items: salesDB.getItems(id),
}));
ipcMain.handle('sales:monthly-summary', (_e, { year, month }) => ({
  success: true, data: salesDB.getMonthlySummary(year, month)
}));

// ---- Settings -------------------------------------------------
ipcMain.handle('settings:get', (_e, key) => ({ success: true, value: settingsDB.get(key) }));
ipcMain.handle('settings:set', (_e, { key, value }) => {
  settingsDB.set(key, value);
  return { success: true };
});

// ====== ENHANCED SALES HANDLERS (Payment Tracking, Returns, etc.) ======

// ---- Sales: Get Pending (unpaid) ------------------------------
ipcMain.handle('sales:get-pending', () => ({
  success: true, data: salesDB.getPending()
}));

// ---- Sales: Record Payment ------------------------------------
ipcMain.handle('sales:record-payment', (_e, { saleId, amount, method, referenceNo, createdBy }) => {
  try {
    salesDB.recordPayment(saleId, amount, method, referenceNo, createdBy);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Sales: Get Summary (daily/monthly) -----------------------
ipcMain.handle('sales:get-summary', (_e, { date }) => ({
  success: true, data: salesDB.getDailySummary(date)
}));

// ---- Sales: Get by Date Range --------------------------------
ipcMain.handle('sales:get-by-date-range', (_e, { startDate, endDate }) => {
  // Normalize to full timestamps so index-compatible >= / <= works correctly.
  const start = startDate?.length === 10 ? `${startDate} 00:00:00` : startDate;
  const end   = endDate?.length   === 10 ? `${endDate} 23:59:59`   : endDate;
  return { success: true, data: salesDB.getByDateRange(start, end) };
});

// ---- Sales: Get by Customer -----------------------------------
ipcMain.handle('sales:get-by-customer', (_e, { customerId }) => ({
  success: true, data: salesDB.getByCustomer(customerId)
}));

// ====== RETURNS & REFUNDS ======

// ---- Returns: Get All ------------------------------------------
ipcMain.handle('returns:get-all', (_e, { limit, offset } = {}) => {
  try {
    const rows = returnsDB.getAll(limit, offset) as any[];

    // Collect all medicine IDs needed across all return items in one pass
    const neededMedIds = new Set<number>();
    const parsedItemsMap = new Map<number, any[]>();
    for (const r of rows) {
      if (r.items_json) {
        try {
          const parsed: any[] = JSON.parse(r.items_json);
          parsedItemsMap.set(r.id, parsed);
          for (const it of parsed) {
            if (it.medicine_id && !it.medicine_name) neededMedIds.add(Number(it.medicine_id));
          }
        } catch { /* ignore */ }
      }
    }

    // Single batch query to fetch all needed medicine names
    const medNameMap = new Map<number, string>();
    if (neededMedIds.size > 0) {
      const ids = Array.from(neededMedIds);
      const placeholders = ids.map(() => '?').join(',');
      const meds = dbQuery<any>(`SELECT id, name FROM medicines WHERE id IN (${placeholders})`, ids);
      for (const m of meds) medNameMap.set(m.id, m.name);
    }

    const enriched = rows.map((r: any) => {
      let items: any[] = [];
      const parsed = parsedItemsMap.get(r.id);
      if (parsed) {
        items = parsed.map((it: any) => ({
          medicine: {
            id: it.medicine_id || null,
            generic_name: it.medicine_name || medNameMap.get(Number(it.medicine_id)) || '',
            brand_name: '',
          },
          quantity_sold: it.quantity_returned || 0,
          quantity_returned: it.quantity_returned || 0,
          unit_price: it.unit_price || 0,
        }));
      }
      if (items.length === 0 && r.items_returned > 0) {
        items = Array.from({ length: r.items_returned }, () => ({
          medicine: { id: null, generic_name: '', brand_name: '' },
          quantity_sold: 1, quantity_returned: 1, unit_price: 0,
        }));
      }
      return {
        ...r,
        date: r.return_date || r.created_at,
        total_amount: r.refund_amount || 0,
        sale_id: r.original_sale_id,
        reason: r.return_reason,
        invoice_no: r.return_invoice_no,
        items,
      };
    });
    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[IPC] returns:get-all error:', err.message);
    return { success: true, data: [] };
  }
});

// ---- Returns: Create ------------------------------------------
ipcMain.handle('returns:create', (_e, returnData) => {
  try {
    const id = returnsDB.create(returnData);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Returns: Process Refund ----------------------------------
ipcMain.handle('returns:process-refund', (_e, { returnId, refundMethod, createdBy }) => {
  try {
    returnsDB.processRefund(returnId, refundMethod, createdBy);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ====== PAYMENTS ======

// ---- Payments: Get All ----------------------------------------
ipcMain.handle('payments:get-all', (_e, { limit, offset } = {}) => ({
  success: true, data: paymentsDB.getAll(limit, offset)
}));

// ---- Payments: Get by Sale ------------------------------------
ipcMain.handle('payments:get-by-sale', (_e, { saleId }) => ({
  success: true, data: paymentsDB.getBySale(saleId)
}));

// ---- Payments: Get by Customer --------------------------------
ipcMain.handle('payments:get-by-customer', (_e, { customerId }) => ({
  success: true, data: paymentsDB.getByCustomer(customerId)
}));

// ---- Payments: Create -----------------------------------------
ipcMain.handle('payments:create', (_e, paymentData) => {
  try {
    const r = paymentsDB.create(paymentData);
    return { success: true, id: r.lastInsertRowid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ====== STOCK MOVEMENTS ======

// ---- Stock: Get Movements by Medicine -------------------------
ipcMain.handle('stock:get-movements', (_e, { medicineId, limit } = {}) => ({
  success: true, data: stockMovementsDB.getByMedicine(medicineId, limit)
}));

// ---- Stock: Get All Movements --------------------------------
ipcMain.handle('stock:get-all-movements', (_e, { limit, offset } = {}) => ({
  success: true, data: stockMovementsDB.getAll(limit, offset)
}));

// ====== AUDIT LOG ======

// ---- Audit: Get All -------------------------------------------
ipcMain.handle('audit:get-all', (_e, { limit, offset } = {}) => ({
  success: true, data: auditLogDB.getAll(limit, offset)
}));

// ---- Audit: Get by Entity ------------------------------------
ipcMain.handle('audit:get-by-entity', (_e, { entityType, entityId, limit } = {}) => ({
  success: true, data: auditLogDB.getByEntity(entityType, entityId, limit)
}));

// ---- Audit: Get by User ---------------------------------------
ipcMain.handle('audit:get-by-user', (_e, { user, limit } = {}) => ({
  success: true, data: auditLogDB.getByUser(user, limit)
}));

// ====== SUPPLIERS ======

// ---- Suppliers: Get All ----------------------------------------
ipcMain.handle('suppliers:get-all', () => ({
  success: true, data: suppliersDB.getAll()
}));

// ---- Suppliers: Create ----------------------------------------
ipcMain.handle('suppliers:create', (_e, supplierData) => {
  try {
    const r = suppliersDB.create(supplierData);
    return { success: true, id: r.lastInsertRowid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Suppliers: Update ----------------------------------------
ipcMain.handle('suppliers:update', (_e, { id, ...data }) => {
  try {
    suppliersDB.update(id, data);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ====== PURCHASES (Enhanced) ======

// ---- Purchases: Get Pending -----------------------------------
ipcMain.handle('purchases:get-pending', () => ({
  success: true, data: purchasesDB.getPending()
}));

// ---- Purchases: Record Payment --------------------------------
ipcMain.handle('purchases:record-payment', (_e, { purchaseId, amount, method, referenceNo, createdBy }) => {
  try {
    purchasesDB.recordPayment(purchaseId, amount, method, referenceNo, createdBy);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ---- Purchases: Get by Supplier -------,-----
ipcMain.handle('purchases:get-by-supplier', (_e, { supplierId }) => ({
  success: true, data: purchasesDB.getBySupplier(supplierId)
}));

// ====== ADVANCED ANALYTICS & REPORTING ======

// ---- Reporting: Daily Report ----------------------------------
ipcMain.handle('reporting:daily-report', (_e, { date } = {}) => ({
  success: true, data: reportingDB.getDailyReport(date)
}));

// ---- Reporting: Monthly Report --------------------------------
ipcMain.handle('reporting:monthly-report', (_e, { year, month }) => ({
  success: true, data: reportingDB.getMonthlyReport(year, month)
}));

// ---- Reporting: Stock Analysis --------------------------------
ipcMain.handle('reporting:stock-analysis', () => ({
  success: true, data: reportingDB.getStockAnalysis()
}));

// ---- Reporting: Customer Analytics ----------------------------
ipcMain.handle('reporting:customer-analytics', () => ({
  success: true, data: reportingDB.getCustomerAnalytics()
}));

// ---- Reporting: Supplier Analytics ----------------------------
ipcMain.handle('reporting:supplier-analytics', () => ({
  success: true, data: reportingDB.getSupplierAnalytics()
}));

// ---- Reporting: Sales Analytics (last N days) ----------------
ipcMain.handle('reporting:sales-analytics', (_e, { days } = { days: 30 }) => ({
  success: true, data: reportingDB.getSalesAnalytics(days)
}));
