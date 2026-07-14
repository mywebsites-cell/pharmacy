// ============================================================
// Preload Script — safe bridge between renderer and main process
// Only exposes specific IPC channels — no full node access
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

const validChannels = [
  // Auth & License
  'auth:login',
  'auth:logout',
  'license:get-status',
  'license:validate-online',
  'device:get-fingerprint',
  'app:get-lock-state',

  // Django local server
  'django:get-token',

  // Database
  'db:query',
  'db:run',
  
  // Medicines
  'medicines:get-all',
  'medicines:get-low-stock',
  'medicines:get-expiring',
  'medicines:create',
  'medicines:update',
  'medicines:delete',
  'medicines:bulk-import',
  
  // Sales (Core)
  'sales:get-all',
  'sales:get-enriched',
  'sales:get-by-id',
  'sales:create',
  'sales:daily-summary',
  'sales:monthly-summary',
  'sales:get-pending',
  'sales:record-payment',
  'sales:get-summary',
  'sales:get-by-date-range',
  'sales:get-by-customer',
  
  // Customers
  'customers:get-all',
  'customers:create',
  'customers:update',
  
  // Suppliers
  'suppliers:get-all',
  'suppliers:create',
  'suppliers:update',
  
  // Purchases
  'purchases:get-all',
  'purchases:create',
  'purchases:get-pending',
  'purchases:record-payment',
  'purchases:get-by-supplier',
  
  // Prescriptions
  'prescriptions:get-all',
  'prescriptions:create',
  'prescriptions:update-status',
  
  // Expenses
  'expenses:get-all',
  'expenses:create',
  'expenses:monthly-total',
  
  // Dues (Credit)
  'dues:get-all',
  'dues:create',
  'dues:record-payment',
  
  // Returns & Refunds
  'returns:get-all',
  'returns:create',
  'returns:process-refund',
  
  // Payments
  'payments:get-all',
  'payments:get-by-sale',
  'payments:get-by-customer',
  'payments:create',
  
  // Stock Management
  'stock:get-movements',
  'stock:get-all-movements',
  
  // Audit Log
  'audit:get-all',
  'audit:get-by-entity',
  'audit:get-by-user',
  
  // Analytics & Reporting
  'analytics:dashboard',
  'analytics:daily-sales',
  'analytics:inventory-valuation',
  'accounting:report',
  'accounting:summary',
  'reporting:daily-report',
  'reporting:monthly-report',
  'reporting:stock-analysis',
  'reporting:customer-analytics',
  'reporting:supplier-analytics',
  'reporting:sales-analytics',
  
  // Settings & Sync
  'settings:get',
  'settings:set',
  'sync:import-all',

  // Transactions
  'transactions:get-history',
  'transactions:get-stats',

  // Custom additions
  'auth:change-password',
  'app:open-url',
  'app:open-renewal-page',
  'app:open-forgot-password',

  // Auto-updater push events (main → renderer)
  'updater:update-available',
  'updater:download-progress',
  'updater:update-ready',

  // Clear local license/session on logout or 401
  'db:clear',
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data?: any) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
  isElectron: true,
  platform: process.platform,
});
