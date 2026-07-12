/**
 * Desktop API Service — uses IPC to SQLite instead of HTTP
 * Used exclusively by the Electron app for data persistence
 */

const api = (window as any).electronAPI;

export const desktopApi = {
  // ====== MEDICINES ======
  medicines: {
    getAll: async (params?: any) => {
      const result = await api?.invoke('medicines:get-all', params);
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Failed to fetch medicines');
    },
    search: async (query: string) => {
      const result = await api?.invoke('medicines:get-all', { search: query });
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Search failed');
    },
    getByBarcode: async (barcode: string) => {
      const result = await api?.invoke('medicines:get-all', { search: barcode });
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Barcode lookup failed');
    },
    create: async (data: any) => {
      const result = await api?.invoke('medicines:create', data);
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to create medicine');
    },
    update: async (id: number, data: any) => {
      const result = await api?.invoke('medicines:update', { id, ...data });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to update medicine');
    },
    delete: async (id: number) => {
      const result = await api?.invoke('medicines:delete', { id });
      if (result?.success) return { data: null };
      throw new Error(result?.error || 'Failed to delete medicine');
    },
    bulkImport: async (items: any[]) => {
      const result = await api?.invoke('medicines:bulk-import', { items });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Bulk import failed');
    },
  },

  // ====== SALES ======
  sales: {
    getAll: async (params?: any) => {
      const result = await api?.invoke('sales:get-all', params);
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Failed to fetch sales');
    },
    getById: async (id: number) => {
      const result = await api?.invoke('sales:get-by-id', { id });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to fetch sale');
    },
    create: async (data: any) => {
      const result = await api?.invoke('sales:create', data);
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to create sale');
    },
    getPending: async () => {
      const result = await api?.invoke('sales:get-pending', {});
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Failed to fetch pending sales');
    },
    recordPayment: async (saleId: number, amount: number, method: string, referenceNo?: string) => {
      const result = await api?.invoke('sales:record-payment', { saleId, amount, method, referenceNo });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to record payment');
    },
    getSummary: async (date?: string) => {
      const result = await api?.invoke('sales:get-summary', { date });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to get summary');
    },
  },

  // ====== CUSTOMERS ======
  customers: {
    getAll: async (params?: any) => {
      const result = await api?.invoke('customers:get-all', params);
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Failed to fetch customers');
    },
    create: async (data: any) => {
      const result = await api?.invoke('customers:create', data);
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to create customer');
    },
    update: async (id: number, data: any) => {
      const result = await api?.invoke('customers:update', { id, ...data });
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to update customer');
    },
  },

  // ====== PURCHASES ======
  purchases: {
    getAll: async (params?: any) => {
      const result = await api?.invoke('purchases:get-all', params);
      if (result?.success) return { data: { results: result.data } };
      throw new Error(result?.error || 'Failed to fetch purchases');
    },
    create: async (data: any) => {
      const result = await api?.invoke('purchases:create', data);
      if (result?.success) return { data: result.data };
      throw new Error(result?.error || 'Failed to create purchase');
    },
  },

  // ====== SYNC (Server → SQLite) ======
  sync: {
    // Fetch all data from server and populate local SQLite
    syncFromServer: async (serverApi: any) => {
      try {
        // Fetch all data from server
        const [medicines, sales, customers, purchases] = await Promise.all([
          serverApi.get('/inventory/medicines/').then((r: any) => r.data?.results || r.data || []),
          serverApi.get('/sales/sales/').then((r: any) => r.data?.results || r.data || []),
          serverApi.get('/customers/customers/').then((r: any) => r.data?.results || r.data || []),
          serverApi.get('/purchases/').then((r: any) => r.data?.results || r.data || []),
        ]).catch(() => [[], [], [], []]);

        // Import into SQLite
        const result = await api?.invoke('sync:import-all', {
          medicines,
          sales,
          customers,
          purchases,
        });

        if (result?.success) {
          return { success: true, counts: result.counts };
        }
        throw new Error(result?.error || 'Sync failed');
      } catch (err: any) {
        throw new Error(`Sync error: ${err.message}`);
      }
    },
  },
};
