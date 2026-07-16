import axios from 'axios';

// ---- Detect if running in Electron (desktop app) ----
const IS_ELECTRON = !!(window as any).electronAPI;

// ---- Use local desktop backend (browser mode accessing local server) ----
const USE_DESKTOP_BACKEND = false; // false = use cloud backend, true = use local server

const resolveWebApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  // In this workspace, localhost:8000 is a different service that misses OTP auth routes.
  if (!envUrl || envUrl.includes(':8000')) {
    return 'https://pharmacy-django-fj01.onrender.com/api/v1';
  }
  return envUrl;
};

const API_URL = resolveWebApiUrl();

// ---- IPC helpers (desktop only) ----
const ipc = (channel: string, data?: any) =>
  (window as any).electronAPI?.invoke(channel, data);

// ---- Desktop IPC API (routes to SQLite via Electron IPC) ----
// Normalize medicine fields: SQLite uses `name`/`quantity`, pages use `generic_name`/`quantity_on_hand`
const normMed = (m: any) => m ? ({
  ...m,
  generic_name: m.generic_name || m.name || '',
  brand_name: m.brand_name || '',
  quantity_on_hand: m.quantity_on_hand ?? m.quantity ?? 0,
}) : m;

const normCustomer = (customer: any) => {
  if (!customer) return customer;

  const fullName = customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = customer.first_name || parts[0] || '';
  const lastName = customer.last_name || parts.slice(1).join(' ');

  return {
    ...customer,
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    loyalty_balance: customer.loyalty_balance ?? 0,
    outstanding_balance: customer.outstanding_balance ?? 0,
    is_vip: customer.is_vip ?? false,
  };
};

const getEmbeddedQueryParam = (url: string, key: string) => {
  const query = url.split('?')[1];
  if (!query) return undefined;
  return new URLSearchParams(query).get(key) ?? undefined;
};

const normalizeSearchValue = (value: any) => String(value || '').trim().toLowerCase();

const getTodayParts = () => {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
  };
};

const toNumber = (value: any) => Number(value) || 0;

const getEntityId = (value: any): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value.id ?? value.pk ?? value.value;
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : undefined;
};

const extractResults = (data: any) => {
  if (Array.isArray(data)) return data;
  return data?.results || [];
};

const getAllApiResults = async (url: string, config?: any) => {
  const results: any[] = [];
  let nextUrl: string | null = url;
  let firstRequest = true;

  while (nextUrl) {
    const response = await api.get(nextUrl, firstRequest ? config : undefined);
    const data = response?.data;

    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }

    if (!data || !Array.isArray(data.results)) {
      return extractResults(data);
    }

    results.push(...data.results);
    nextUrl = data.next || null;
    firstRequest = false;
  }

  return results;
};

const normalizeLowStockItem = (item: any) => ({
  ...item,
  generic_name: item.generic_name || item.medicine_name || item.name || '',
  brand_name: item.brand_name || item.medicine_name || item.brand || '',
  quantity_on_hand: item.quantity_on_hand ?? item.available_quantity ?? item.quantity ?? 0,
});

const normalizeExpiringItem = (item: any) => ({
  ...item,
  generic_name: item.generic_name || item.medicine_name || item.name || '',
  brand_name: item.brand_name || item.medicine_name || item.brand || '',
  days_left: item.days_left ?? item.days_to_expiry ?? 0,
  quantity_on_hand: item.quantity_on_hand ?? item.quantity_available ?? item.quantity ?? 0,
});

const buildDesktopInventoryRows = (medicines: any[]) =>
  medicines.map((medicine: any) => {
    const medicineId = getEntityId(medicine.id) ?? getEntityId(medicine);
    const quantity = toNumber(medicine.quantity_on_hand ?? medicine.quantity ?? 0);

    return {
      id: medicineId ?? medicine.barcode ?? medicine.name,
      medicine: medicineId ?? medicine.id,
      medicine_name: medicine.generic_name || medicine.name || '',
      total_quantity: quantity,
      available_quantity: quantity,
      branch_name: medicine.branch_name || 'Main Branch',
    };
  });

const buildRecentSalesTrend = (sales: any[]) => {
  const dailyTotals = new Map<string, number>();

  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - index);
    dailyTotals.set(day.toISOString().slice(0, 10), 0);
  }

  for (const sale of sales) {
    const createdAt = sale?.created_at || sale?.updated_at;
    if (!createdAt) continue;

    const key = new Date(createdAt).toISOString().slice(0, 10);
    if (!dailyTotals.has(key)) continue;
    dailyTotals.set(key, (dailyTotals.get(key) || 0) + toNumber(sale.total_amount));
  }

  return Array.from(dailyTotals.values());
};

const getSaleTimestamp = (sale: any) => {
  const value = sale?.created_at || sale?.updated_at || sale?.date;
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRangeStartForDays = (days: number) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(days - 1, 0));
  return start;
};

const getRangeStartForPeriod = (period: 'daily' | 'monthly' | 'annual') => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === 'annual') {
    start.setMonth(0, 1);
    return start;
  }

  if (period === 'monthly') {
    start.setDate(1);
    return start;
  }

  return start;
};

const filterSalesFromDate = (sales: any[], start: Date) =>
  sales.filter((sale) => {
    const timestamp = getSaleTimestamp(sale);
    return timestamp ? timestamp >= start : false;
  });

const buildMedicineLookup = (medicines: any[]) =>
  new Map(medicines.map((medicine) => [medicine.id, medicine]));

const buildInventoryLookup = (inventoryRows: any[]) =>
  new Map(inventoryRows.map((row) => [row.medicine, row]));

const buildTopMedicines = (sales: any[], medicines: any[], inventoryRows: any[], limit = 6) => {
  const medicineLookup = buildMedicineLookup(medicines);
  const inventoryLookup = buildInventoryLookup(inventoryRows);
  const totals = new Map<string, { quantitySold: number; revenue: number }>();

  for (const sale of sales) {
    for (const item of sale?.items || []) {
      const medicineId = getEntityId(item?.medicine);
      if (!medicineId) continue;

      const lookupKey = String(medicineId);
      const current = totals.get(lookupKey) || { quantitySold: 0, revenue: 0 };
      current.quantitySold += toNumber(item.quantity);
      current.revenue += toNumber(item.total_amount || item.unit_price) * Math.max(toNumber(item.quantity), 1);
      totals.set(lookupKey, current);
    }
  }

  return Array.from(totals.entries())
    .map(([medicineId, totalsForMedicine]) => {
      const medicine = medicineLookup.get(medicineId) || {};
      const inventory = inventoryLookup.get(medicineId) || {};
      return {
        id: medicineId,
        generic_name: medicine.generic_name || medicine.brand_name || medicine.name || '',
        brand_name: medicine.brand_name || '',
        purchase_price: toNumber(medicine.purchase_price),
        quantity_on_hand: toNumber(inventory.available_quantity ?? inventory.total_quantity),
        quantity_sold: totalsForMedicine.quantitySold,
        revenue: totalsForMedicine.revenue,
      };
    })
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, limit);
};

// Fast path: asks the DB for an aggregated result instead of fetching all sales into JS
const buildDesktopDailySalesData = async (days: number = 30) => {
  if (IS_ELECTRON) {
    const result = await ipc('analytics:daily-sales', { days });
    return result?.data || { results: [], count: 0 };
  }
  // HTTP fallback (browser mode)
  const sales = await getAllApiResults('/sales/sales/');
  const start = getRangeStartForDays(days);
  const filteredSales = filterSalesFromDate(sales, start);
  const buckets = new Map<string, { date: string; revenue: number; transactions: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenue: 0, transactions: 0 });
  }
  for (const sale of filteredSales) {
    const timestamp = getSaleTimestamp(sale);
    if (!timestamp) continue;
    const key = timestamp.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.transactions += 1;
    bucket.revenue += toNumber(sale.total_amount);
  }
  const results = Array.from(buckets.values());
  return { results, count: results.length };
};

// Fast path: single aggregate SQL query instead of two full table scans
const buildDesktopInventoryValuation = async () => {
  if (IS_ELECTRON) {
    const result = await ipc('analytics:inventory-valuation');
    return result?.data || { total_items: 0, total_value: 0, low_stock_count: 0 };
  }
  // HTTP fallback
  const [inventoryRows, medicines, lowStockResponse] = await Promise.all([
    getAllApiResults('/inventory/inventory/'),
    getAllApiResults('/inventory/medicines/'),
    inventoryService.getLowStock(),
  ]);
  const medicineLookup = buildMedicineLookup(medicines);
  const lowStock = extractResults(lowStockResponse.data);
  const totals = inventoryRows.reduce(
    (acc, row) => {
      const medicine = medicineLookup.get(row.medicine) || {};
      const quantity = toNumber(row.available_quantity ?? row.total_quantity);
      const unitValue = toNumber(medicine.purchase_price ?? medicine.selling_price);
      acc.total_items += quantity;
      acc.total_value += quantity * unitValue;
      return acc;
    },
    { total_items: 0, total_value: 0 }
  );
  return { ...totals, low_stock_count: lowStock.length };
};

// Fast path: single IPC call → analytics:dashboard handler returns pre-computed data from SQLite
// Old path fetched ALL sales + ALL medicines + ALL customers + ALL inventory into JS memory.
const buildDashboardMetrics = async () => {
  if (IS_ELECTRON) {
    const result = await ipc('analytics:dashboard');
    return result?.data || {};
  }
  // HTTP fallback (browser / web mode)
  const [salesRes, customersRes, medicinesRes, inventoryRes] = await Promise.allSettled([
    api.get('/sales/sales/'),
    api.get('/customers/customers/'),
    api.get('/inventory/medicines/'),
    api.get('/inventory/inventory/'),
  ]);
  const sales = salesRes.status === 'fulfilled' ? extractResults(salesRes.value.data) : [];
  const customers = customersRes.status === 'fulfilled' ? extractResults(customersRes.value.data) : [];
  const medicines = medicinesRes.status === 'fulfilled' ? extractResults(medicinesRes.value.data) : [];
  const inventoryRows = inventoryRes.status === 'fulfilled' ? extractResults(inventoryRes.value.data) : [];
  const totalRevenue = sales.reduce((sum: number, sale: any) => sum + toNumber(sale.total_amount), 0);
  const totalCostOfGoods = sales.reduce((sum: number, sale: any) => {
    const itemsCost = (sale?.items || []).reduce((itemSum: number, item: any) => {
      const medicine = medicines.find((candidate: any) => candidate.id === item.medicine);
      return itemSum + (toNumber(item.quantity) * toNumber(medicine?.purchase_price));
    }, 0);
    return sum + itemsCost;
  }, 0);
  const grossProfit = totalRevenue - totalCostOfGoods;
  return {
    total_revenue: totalRevenue,
    total_sales: sales.length,
    total_customers: customers.length,
    gross_margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    sales_trend: buildRecentSalesTrend(sales),
    top_medicines: buildTopMedicines(sales, medicines, inventoryRows),
  };
};

// Fast path: single IPC call per period — the DB runs one JOIN query instead of
// JS fetching ALL sales + ALL medicines and iterating them in the renderer.
const buildDesktopAccountingReportFromApi = async (period: 'daily' | 'monthly' | 'annual') => {
  if (IS_ELECTRON) {
    const result = await ipc('accounting:report', { period });
    return result?.data || {};
  }
  // HTTP fallback
  const [sales, medicines] = await Promise.all([
    getAllApiResults('/sales/sales/'),
    getAllApiResults('/inventory/medicines/'),
  ]);
  const medicineLookup = buildMedicineLookup(medicines);
  const filteredSales = filterSalesFromDate(sales, getRangeStartForPeriod(period));
  const buckets = new Map<string, { date: string; transactions: number; revenue: number; cogs: number }>();
  const bucketKeyForSale = (sale: any) => {
    const timestamp = getSaleTimestamp(sale);
    if (!timestamp) return null;
    return period === 'annual' ? timestamp.toISOString().slice(0, 7) : timestamp.toISOString().slice(0, 10);
  };
  let totalRevenue = 0; let totalTransactions = 0; let totalCostOfGoods = 0;
  for (const sale of filteredSales) {
    const revenue = toNumber(sale.total_amount);
    const cogs = (sale?.items || []).reduce((sum: number, item: any) => {
      const medicine = medicineLookup.get(item.medicine) || {};
      return sum + (toNumber(item.quantity) * toNumber(medicine.purchase_price));
    }, 0);
    totalRevenue += revenue; totalTransactions += 1; totalCostOfGoods += cogs;
    const bucketKey = bucketKeyForSale(sale);
    if (!bucketKey) continue;
    const bucket = buckets.get(bucketKey) || { date: bucketKey, transactions: 0, revenue: 0, cogs: 0 };
    bucket.transactions += 1; bucket.revenue += revenue; bucket.cogs += cogs;
    buckets.set(bucketKey, bucket);
  }
  const grossProfit = totalRevenue - totalCostOfGoods;
  return {
    label: period === 'daily' ? 'Today' : period === 'annual' ? 'This Year' : 'This Month',
    total_revenue: totalRevenue, total_transactions: totalTransactions,
    total_cost_of_goods: totalCostOfGoods, gross_profit: grossProfit,
    gross_margin_percent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    net_profit: grossProfit,
    daily_breakdown: Array.from(buckets.values()).sort((l, r) => l.date.localeCompare(r.date)),
  };
};

// Fast path: one IPC call returns all three periods in a single round-trip
const buildDesktopAccountingSummaryFromApi = async () => {
  if (IS_ELECTRON) {
    const result = await ipc('accounting:summary');
    return result?.data || {};
  }
  // HTTP fallback
  const [daily, monthly, annual] = await Promise.all([
    buildDesktopAccountingReportFromApi('daily'),
    buildDesktopAccountingReportFromApi('monthly'),
    buildDesktopAccountingReportFromApi('annual'),
  ]);
  return {
    daily:   { revenue: daily.total_revenue,   profit: daily.net_profit,   transactions: daily.total_transactions },
    monthly: { revenue: monthly.total_revenue, profit: monthly.net_profit, transactions: monthly.total_transactions },
    annual:  { revenue: annual.total_revenue,  profit: annual.net_profit,  transactions: annual.total_transactions },
  };
};

const buildAccountingQueryConfig = (period: 'daily' | 'monthly' | 'annual') => {
  const { date, year, month } = getTodayParts();

  if (period === 'daily') {
    return {
      label: 'Today',
      salesWhere: `date(invoice_date) = ? AND status != 'voided'`,
      salesParams: [date],
      expensesWhere: `date(date) = ?`,
      expenseParams: [date],
      bucketExpr: `date(invoice_date)`,
      salesWhereForJoin: `date(s.invoice_date) = ? AND s.status != 'voided'`,
      bucketExprForJoin: `date(s.invoice_date)`,
    };
  }

  if (period === 'annual') {
    return {
      label: 'This Year',
      salesWhere: `strftime('%Y', invoice_date) = ? AND status != 'voided'`,
      salesParams: [year],
      expensesWhere: `strftime('%Y', date) = ?`,
      expenseParams: [year],
      bucketExpr: `strftime('%Y-%m', invoice_date)`,
      salesWhereForJoin: `strftime('%Y', s.invoice_date) = ? AND s.status != 'voided'`,
      bucketExprForJoin: `strftime('%Y-%m', s.invoice_date)`,
    };
  }

  return {
    label: 'This Month',
    salesWhere: `strftime('%Y', invoice_date) = ? AND strftime('%m', invoice_date) = ? AND status != 'voided'`,
    salesParams: [year, month],
    expensesWhere: `strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
    expenseParams: [year, month],
    bucketExpr: `date(invoice_date)`,
    salesWhereForJoin: `strftime('%Y', s.invoice_date) = ? AND strftime('%m', s.invoice_date) = ? AND s.status != 'voided'`,
    bucketExprForJoin: `date(s.invoice_date)`,
  };
};

const queryDesktopRows = async (sql: string, params: any[] = []) => {
  const result = await ipc('db:query', { sql, params });
  return result?.data || [];
};

const queryDesktopRow = async (sql: string, params: any[] = []) => {
  const rows = await queryDesktopRows(sql, params);
  return rows[0] || {};
};

const buildDesktopAccountingReport = async (period: 'daily' | 'monthly' | 'annual') => {
  const config = buildAccountingQueryConfig(period);

  const sales = await queryDesktopRow(
    `SELECT COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue FROM sales WHERE ${config.salesWhere}`,
    config.salesParams
  );

  const cogs = await queryDesktopRow(
    `SELECT COALESCE(SUM(si.quantity * COALESCE(m.purchase_price, 0)), 0) as cogs
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN medicines m ON m.id = si.medicine_id
     WHERE ${config.salesWhereForJoin}`,
    config.salesParams
  );

  const expenses = await queryDesktopRow(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${config.expensesWhere}`,
    config.expenseParams
  );

  const revenueByBucket = await queryDesktopRows(
    `SELECT ${config.bucketExpr} as bucket, COUNT(*) as transactions, COALESCE(SUM(total), 0) as revenue
     FROM sales
     WHERE ${config.salesWhere}
     GROUP BY ${config.bucketExpr}
     ORDER BY ${config.bucketExpr}`,
    config.salesParams
  );

  const cogsByBucket = await queryDesktopRows(
    `SELECT ${config.bucketExprForJoin} as bucket, COALESCE(SUM(si.quantity * COALESCE(m.purchase_price, 0)), 0) as cogs
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN medicines m ON m.id = si.medicine_id
     WHERE ${config.salesWhereForJoin}
     GROUP BY ${config.bucketExprForJoin}
     ORDER BY ${config.bucketExprForJoin}`,
    config.salesParams
  );

  const cogsMap = new Map(cogsByBucket.map((row: any) => [row.bucket, toNumber(row.cogs)]));
  const totalRevenue = toNumber(sales.revenue);
  const totalTransactions = toNumber(sales.transactions);
  const totalCostOfGoods = toNumber(cogs.cogs);
  const totalExpenses = toNumber(expenses.total);
  const grossProfit = totalRevenue - totalCostOfGoods;
  const netProfit = grossProfit - totalExpenses;

  return {
    label: config.label,
    total_revenue: totalRevenue,
    total_transactions: totalTransactions,
    total_cost_of_goods: totalCostOfGoods,
    gross_profit: grossProfit,
    gross_margin_percent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    net_profit: netProfit,
    daily_breakdown: revenueByBucket.map((row: any) => ({
      date: row.bucket,
      transactions: toNumber(row.transactions),
      revenue: toNumber(row.revenue),
      cogs: cogsMap.get(row.bucket) ?? 0,
    })),
  };
};

const buildDesktopAccountingSummary = async () => {
  const [daily, monthly, annual] = await Promise.all([
    buildDesktopAccountingReport('daily'),
    buildDesktopAccountingReport('monthly'),
    buildDesktopAccountingReport('annual'),
  ]);

  return {
    daily: {
      revenue: daily.total_revenue,
      profit: daily.net_profit,
      transactions: daily.total_transactions,
    },
    monthly: {
      revenue: monthly.total_revenue,
      profit: monthly.net_profit,
      transactions: monthly.total_transactions,
    },
    annual: {
      revenue: annual.total_revenue,
      profit: annual.net_profit,
      transactions: annual.total_transactions,
    },
  };
};

const createHttpApi = () => {
  const instance = axios.create({
    baseURL: 'https://pharmacy-django-fj01.onrender.com/api/v1',
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config: any) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return instance;
};

const getAllHttpResults = async (httpApi: any, url: string, config?: any) => {
  const results: any[] = [];
  let nextUrl: string | null = url;
  let firstRequest = true;

  while (nextUrl) {
    const response = await httpApi.get(nextUrl, firstRequest ? config : undefined);
    const data = response?.data;

    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }

    if (!data || !Array.isArray(data.results)) {
      return extractResults(data);
    }

    results.push(...data.results);
    nextUrl = data.next || null;
    firstRequest = false;
  }

  return results;
};

const normalizeSaleItemRecord = (item: any) => ({
  ...item,
  quantity_sold: item.quantity_sold ?? item.quantity ?? 0,
  medicine_name: item.medicine_name || item.medicine?.generic_name || item.medicine?.name || '',
});

const normalizeSaleRecord = (sale: any) => ({
  ...sale,
  date: sale.date || sale.created_at || sale.updated_at,
  invoice_no: sale.invoice_no || sale.bill_number,
  sale_type: sale.sale_type || 'sale',
  items: (sale.items || []).map(normalizeSaleItemRecord),
});

const normalizeRefundRecord = (refund: any) => ({
  ...refund,
  date: refund.date || refund.created_at,
  total_amount: refund.total_amount ?? refund.refund_amount ?? 0,
  sale_id: refund.sale_id || refund.sale || refund.original_sale_id,
});

const inferSalePaidAmount = (sale: any) => {
  const payments = sale?.payments || [];
  const paymentTotal = payments.reduce((sum: number, payment: any) => sum + toNumber(payment.amount_paid ?? payment.amount), 0);
  if (paymentTotal > 0) return paymentTotal;

  const paymentMethod = String(sale?.payment_method || '').toUpperCase();
  const paymentStatus = String(sale?.payment_status || '').toUpperCase();
  if (paymentMethod !== 'CREDIT' && paymentStatus !== 'PENDING') {
    return toNumber(sale?.total_amount);
  }

  return 0;
};

const toApiPaymentMethod = (method: any) => {
  const normalized = String(method || 'cash').trim().toUpperCase();
  const mapping: Record<string, string> = {
    CASH: 'CASH',
    CARD: 'CARD',
    UPI: 'MOBILE_PAYMENT',
    CHEQUE: 'CARD',
    CREDIT: 'CREDIT',
  };

  return mapping[normalized] || normalized;
};

const buildBrowserDueRecords = async (httpApi: any, params?: any) => {
  const [sales, customers] = await Promise.all([
    getAllHttpResults(httpApi, '/sales/sales/'),
    getAllHttpResults(httpApi, '/customers/customers/'),
  ]);

  const customerLookup = new Map(customers.map((customer: any) => [customer.id, customer]));

  let dues = sales
    .map(normalizeSaleRecord)
    .map((sale: any) => {
      const customer = customerLookup.get(sale.customer) || {};
      const payments = (sale.payments || []).map((payment: any) => ({
        id: payment.id,
        date: payment.created_at || payment.date,
        amount: toNumber(payment.amount_paid ?? payment.amount),
        method: String(payment.payment_method || payment.method || '').toLowerCase(),
        note: payment.reference_number || payment.note || '',
      }));
      const amountPaid = inferSalePaidAmount({ ...sale, payments });
      const balance = Math.max(toNumber(sale.total_amount) - amountPaid, 0);
      const status = balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

      return {
        id: sale.id,
        sale_id: sale.id,
        customer_name: sale.customer_name || customer.name || 'Walk-in Customer',
        customer_phone: customer.phone || '',
        date: sale.date,
        total_amount: toNumber(sale.total_amount),
        amount_paid: amountPaid,
        balance,
        status,
        notes: sale.notes || '',
        payments,
      };
    });

  if (params?.status) {
    dues = dues.filter((due: any) => due.status === params.status);
  }

  const totalOutstanding = dues
    .filter((due: any) => due.status !== 'paid')
    .reduce((sum: number, due: any) => sum + toNumber(due.balance), 0);

  return {
    results: dues,
    count: dues.length,
    total_outstanding: totalOutstanding,
  };
};

const createBrowserDesktopApi = (httpApi: any) => ({
  get: async (url: string, config?: any) => {
    if (url.includes('sales/sales')) {
      const response = await httpApi.get(url, config);
      const results = extractResults(response.data).map(normalizeSaleRecord);
      return {
        ...response,
        data: Array.isArray(response.data)
          ? results
          : { ...response.data, results },
      };
    }

    if (url.includes('refunds')) {
      const response = await httpApi.get('/sales/refunds/', config);
      const results = extractResults(response.data).map(normalizeRefundRecord);
      return {
        ...response,
        data: Array.isArray(response.data)
          ? results
          : { ...response.data, results },
      };
    }

    if (url.includes('dues')) {
      return { data: await buildBrowserDueRecords(httpApi, config?.params) };
    }

    if (url.includes('purchases')) {
      return { data: { results: [], count: 0 } };
    }

    return httpApi.get(url, config);
  },

  post: async (url: string, data?: any) => {
    if (url.includes('/dues/') && url.includes('/pay')) {
      const saleId = url.match(/\/dues\/([^/]+)\//)?.[1];
      if (!saleId) return { data: { success: false } };

      await httpApi.post('/sales/payments/', {
        sale: saleId,
        payment_method: toApiPaymentMethod(data?.method),
        amount_paid: toNumber(data?.amount),
        reference_number: data?.note || '',
      });

      const saleResponse = await httpApi.get(`/sales/sales/${saleId}/`);
      const sale = normalizeSaleRecord(saleResponse.data);
      const fullyPaid = inferSalePaidAmount(sale) >= toNumber(sale.total_amount);

      if (fullyPaid) {
        try {
          await httpApi.patch(`/sales/sales/${saleId}/`, { payment_status: 'COMPLETED' });
        } catch {
          // A fresh payment record is enough for the dues projection even if the sale status patch fails.
        }
      }

      return {
        data: {
          success: true,
          deleted: fullyPaid,
          customer_name: sale.customer_name,
        },
      };
    }

    if (url.includes('/dues')) {
      return { data: { id: data?.sale_id || Date.now(), ...(data || {}) } };
    }

    if (url.includes('refunds')) {
      const response = await httpApi.post('/sales/refunds/', {
        sale: data?.sale_id,
        refund_amount: toNumber(data?.total_amount),
        reason: data?.reason || 'Customer return',
        refund_method: 'CASH',
        status: 'COMPLETED',
      });
      return { ...response, data: normalizeRefundRecord(response.data) };
    }

    if (url.includes('purchases')) {
      return { data: { id: Date.now(), ...(data || {}) } };
    }

    return httpApi.post(url, data);
  },

  put: (url: string, data?: any) => httpApi.put(url, data),
  delete: (url: string) => httpApi.delete(url),
  interceptors: httpApi.interceptors,
});

export const rankMedicineResults = (items: any[], query: string) => {
  const q = normalizeSearchValue(query);
  if (!q) return items;

  const getPrimaryName = (item: any) => item?.generic_name || item?.name || '';
  const getBrandName = (item: any) => item?.brand_name || '';
  const getBarcode = (item: any) => item?.barcode || '';
  const getCategory = (item: any) => item?.category || '';
  const getDosageForm = (item: any) => item?.dosage_form || '';

  const getRank = (item: any) => {
    const primary = normalizeSearchValue(getPrimaryName(item));
    const brand = normalizeSearchValue(getBrandName(item));
    const barcode = normalizeSearchValue(getBarcode(item));
    const category = normalizeSearchValue(getCategory(item));
    const dosageForm = normalizeSearchValue(getDosageForm(item));

    if (primary.startsWith(q)) return 0;
    if (brand.startsWith(q)) return 1;
    if (barcode.startsWith(q)) return 2;
    if (primary.includes(q)) return 3;
    if (brand.includes(q)) return 4;
    if (barcode.includes(q) || category.includes(q) || dosageForm.includes(q)) return 5;
    return 6;
  };

  return [...items].sort((left: any, right: any) => {
    const rankDiff = getRank(left) - getRank(right);
    if (rankDiff !== 0) return rankDiff;

    const primaryDiff = getPrimaryName(left).localeCompare(getPrimaryName(right), undefined, { sensitivity: 'base' });
    if (primaryDiff !== 0) return primaryDiff;

    return getBrandName(left).localeCompare(getBrandName(right), undefined, { sensitivity: 'base' });
  });
};

const desktopApi = {
  get: async (url: string, config?: any) => {
    console.log('[desktopApi.get]', url);
    
    // Medicines
    if (url.includes('inventory/low-stock') || url.includes('low-stock')) {
      try {
        const result = await ipc('medicines:get-low-stock');
        const items = (result?.data || []).map(normMed);
        return { data: { results: items, count: items.length } };
      } catch (err) {
        console.error('[desktopApi] medicines:get-low-stock failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    if (url.includes('inventory/batches/expiring_soon') || url.includes('expiring')) {
      try {
        const result = await ipc('analytics:dashboard', config?.params || {});
        const items = (result?.data?.expiring_items || []).map(normalizeExpiringItem);
        return { data: { results: items, count: items.length } };
      } catch (err) {
        console.error('[desktopApi] expiring items failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    if (url.includes('inventory/medicines')) {
      try {
        const result = await ipc('medicines:get-all', config?.params || {});
        const meds = (result?.data || []).map(normMed);
        const search = config?.params?.search || getEmbeddedQueryParam(url, 'search');
        const filtered = search
          ? meds.filter((m: any) => {
              const q = String(search).toLowerCase();
              return [m.generic_name, m.brand_name, m.name, m.barcode, m.category, m.dosage_form]
                .filter(Boolean)
                .some((value: any) => String(value).toLowerCase().includes(q));
            })
          : meds;
        const ranked = search ? rankMedicineResults(filtered, String(search)) : filtered;
        return { data: { results: ranked, count: ranked.length } };
      } catch (err) {
        console.error('[desktopApi] medicines:get-all failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    if (url.includes('inventory/inventory')) {
      try {
        const result = await ipc('medicines:get-all', config?.params || {});
        const meds = (result?.data || []).map(normMed);
        const rows = buildDesktopInventoryRows(meds);
        return { data: { results: rows, count: rows.length } };
      } catch (err) {
        console.error('[desktopApi] inventory rows failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    // Analytics — all analytics endpoints map to one IPC call
    if (url.includes('analytics') || url.includes('kpis') || url.includes('daily-sales') || url.includes('inventory-valuation')) {
      try {
        const result = await ipc('analytics:dashboard', config?.params || {});
        const d = result?.data || {};
        // analytics/kpis
        if (url.includes('kpis')) {
          return { data: {
            total_revenue: d.total_revenue ?? 0,
            total_sales: d.total_sales ?? 0,
            total_customers: d.total_customers ?? 0,
            gross_margin: d.gross_margin ?? 0,
            monthly_profit: d.monthly_profit ?? 0,
            low_stock_count: d.low_stock_count ?? 0,
            expiring_soon_count: d.expiring_soon_count ?? 0,
          }};
        }
        // analytics/inventory-valuation
        if (url.includes('inventory-valuation')) {
          return { data: {
            total_value: d.inventory_value ?? 0,
            total_medicines: d.total_medicines ?? 0,
          }};
        }
        // analytics/daily-sales
        if (url.includes('daily-sales')) {
          const rows = d.daily_sales || [];
          return { data: { results: rows, count: rows.length } };
        }
        // analytics/dashboard
        return { data: d };
      } catch (err) {
        console.error('[desktopApi] analytics failed:', err);
        return { data: { results: [], count: 0, total_revenue: 0, total_sales: 0, total_customers: 0 } };
      }
    }
    // Sales
    if (url.includes('sales/sales')) {
      try {
        const result = await ipc('sales:get-all', config?.params || {});
        return { data: { results: result?.data || [], count: result?.data?.length || 0 } };
      } catch (err) {
        console.error('[desktopApi] sales:get-all failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    // Customers
    if (url.includes('customers')) {
      try {
        const result = await ipc('customers:get-all', config?.params || {});
        const customers = (result?.data || []).map(normCustomer);
        const search = config?.params?.search || getEmbeddedQueryParam(url, 'search');
        const filtered = search
          ? customers.filter((customer: any) => {
              const q = String(search).toLowerCase();
              return [customer.name, customer.first_name, customer.last_name, customer.phone, customer.email]
                .filter(Boolean)
                .some((value: any) => String(value).toLowerCase().includes(q));
            })
          : customers;
        return { data: { results: filtered, count: filtered.length } };
      } catch (err) {
        console.error('[desktopApi] customers:get-all failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    // Dues — join with customers so DuesPage gets customer_name/phone; normalize status
    if (url.includes('dues')) {
      try {
        const [duesResult, custResult] = await Promise.all([
          ipc('dues:get-all'),
          ipc('customers:get-all'),
        ]);
        const custMap = new Map((custResult?.data || []).map((c: any) => [c.id, normCustomer(c)]));
        const items = (duesResult?.data || []).map((d: any) => {
          const c: any = custMap.get(d.customer_id) || {};
          return {
            ...d,
            customer_name: c.name || `Customer #${d.customer_id}`,
            customer_phone: c.phone || '',
            date: d.created_at || d.due_date,
            // SQLite uses 'unpaid'; DuesPage expects 'pending'
            status: d.status === 'unpaid' ? 'pending' : d.status,
            balance: d.balance ?? Math.max(0, (d.total_amount || 0) - (d.amount_paid || 0)),
            payments: [],
          };
        });
        const totalOutstanding = items
          .filter((d: any) => d.status !== 'paid')
          .reduce((sum: number, d: any) => sum + (Number(d.balance) || 0), 0);
        return { data: { results: items, count: items.length, total_outstanding: totalOutstanding } };
      } catch (err) {
        console.error('[desktopApi] dues:get-all failed:', err);
        return { data: { results: [], count: 0, total_outstanding: 0 } };
      }
    }
    // Refunds / Returns
    if (url.includes('refunds') || url.includes('returns')) {
      try {
        const result = await ipc('returns:get-all');
        const items = (result?.data || []).map((r: any) => ({
          ...r,
          date: r.date || r.return_date || r.created_at,
          total_amount: r.total_amount || r.refund_amount || 0,
          sale_id: r.sale_id || r.original_sale_id,
          reason: r.reason || r.return_reason,
          items: r.items || [],
        }));
        return { data: { results: items, count: items.length } };
      } catch (err) {
        console.error('[desktopApi] returns:get-all failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    // Transactions — history and stats
    if (url.includes('transactions/history')) {
      try {
        const p = config?.params || {};
        const result = await ipc('transactions:get-history', {
          limit: p.limit ?? 200, offset: p.offset ?? 0,
          search: p.search ?? '', typeFilter: p.typeFilter ?? 'all',
          dateFrom: p.dateFrom ?? '', dateTo: p.dateTo ?? '',
          sortOrder: p.sortOrder ?? 'desc',
        });
        const rows = result?.data || [];
        return { data: { results: rows, count: rows.length } };
      } catch (err) {
        console.error('[desktopApi] transactions:get-history failed:', err);
        return { data: { results: [], count: 0 } };
      }
    }
    if (url.includes('transactions/stats')) {
      try {
        const p = config?.params || {};
        const result = await ipc('transactions:get-stats', {
          search: p.search ?? '', typeFilter: p.typeFilter ?? 'all',
          dateFrom: p.dateFrom ?? '', dateTo: p.dateTo ?? '',
        });
        const d = result?.data || {};
        return { data: { totalSales: d.totalSales ?? 0, totalPurchases: d.totalPurchases ?? 0, totalRefunds: d.totalRefunds ?? 0, totalAmount: d.totalAmount ?? 0 } };
      } catch (err) {
        console.error('[desktopApi] transactions:get-stats failed:', err);
        return { data: { totalSales: 0, totalPurchases: 0, totalRefunds: 0, totalAmount: 0 } };
      }
    }
    // Accounting P&L and Summary
    if (url.includes('accounting/profit-loss') || url.includes('accounting/report')) {
      try {
        const period = config?.params?.period ?? 'monthly';
        const result = await ipc('accounting:report', { period });
        return { data: result?.data || {} };
      } catch (err) {
        console.error('[desktopApi] accounting:report failed:', err);
        return { data: {} };
      }
    }
    if (url.includes('accounting/summary')) {
      try {
        const result = await ipc('accounting:summary');
        return { data: result?.data || {} };
      } catch (err) {
        console.error('[desktopApi] accounting:summary failed:', err);
        return { data: {} };
      }
    }
    console.warn('[desktop api] unhandled GET:', url);
    return { data: { results: [], count: 0 } };
  },

  post: async (url: string, data?: any) => {
    console.log('[desktopApi.post]', url);
    
    try {
      if (url.includes('auth/login')) {
        // auth is handled via IPC separately in AppShell
        return { data: {} };
      }
      if (url.includes('inventory/medicines/bulk')) {
        const result = await ipc('medicines:bulk-import', { items: data?.items || [] });
        if (!result?.success) throw new Error(result?.error || 'Bulk import failed');
        const payload = result?.data || {};
        return {
          data: {
            ...payload,
            results: (payload.results || []).map(normMed),
          },
        };
      }
      if (url.includes('inventory/medicines')) {
        const result = await ipc('medicines:create', data || {});
        if (!result?.success) throw new Error(result?.error || 'Failed to create medicine');
        return { data: result?.data || { id: result?.id, ...data, name: data?.name || data?.generic_name } };
      }
      // Customers
      if (url.includes('customers')) {
        const fullName = data?.name || [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
        const result = await ipc('customers:create', {
          name: fullName || data?.first_name || 'Unknown',
          phone: data?.phone,
          email: data?.email,
          address: data?.address,
          customer_type: data?.customer_type || 'retail',
          credit_limit: data?.credit_limit ?? 0,
          created_by: 'admin',
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to create customer');
        const id = result?.lastInsertRowid ?? result?.id;
        return { data: normCustomer({ id, ...data, name: fullName }) };
      }
      if (url.includes('sales/sales')) {
        // Sales creation logic...
        const invoiceNo = `INV-${Date.now()}`;
        const subtotal = data?.total_amount ?? data?.subtotal ?? 0;
        const pmRaw: string = data?.payment_method ?? 'cash';
        const paymentMethod = pmRaw === 'due' ? 'cash' : pmRaw.toLowerCase();
        const salePayload = {
          invoice_no: invoiceNo,
          invoice_date: new Date().toISOString().split('T')[0],
          customer_id: data?.customer_id || undefined,
          customer_name: data?.customer_name || undefined,
          customer_phone: data?.customer_phone || undefined,
          subtotal,
          discount_amount: data?.discount_amount ?? 0,
          discount_percent: data?.discount_percent ?? 0,
          tax_amount: data?.tax_amount ?? 0,
          total: data?.total_amount ?? data?.total ?? subtotal,
          amount_paid: data?.is_due ? (parseFloat(data?.amount_paid_now) || 0) : subtotal,
          payment_method: paymentMethod,
          payment_status: data?.is_due ? 'pending' : 'paid',
          notes: data?.notes || undefined,
          created_by: 'admin',
        };
        const itemsPayload = (data?.items || []).map((item: any) => ({
          medicine_id: item.medicine ?? item.medicine_id ?? item.id,
          quantity: item.quantity_sold ?? item.quantity ?? 1,
          unit_price: item.unit_price ?? item.selling_price ?? 0,
          discount: item.discount ?? 0,
          tax: item.tax ?? 0,
        }));
        const result = await ipc('sales:create', { sale: salePayload, items: itemsPayload });
        if (!result?.success) throw new Error(result?.error || 'Failed to create sale');
        return { data: result?.data || { id: result?.id } };
      }

      // Dues payment
      if (url.includes('/dues/') && url.includes('/pay')) {
        const dueId = url.match(/\/dues\/([^/]+)\//)?.[1];
        if (!dueId) return { data: { success: false } };
        const result = await ipc('dues:record-payment', { id: parseInt(dueId), amount: parseFloat(data?.amount || '0') });
        if (!result?.success) throw new Error(result?.error || 'Payment recording failed');
        return { data: { success: true, deleted: false, customer_name: data?.customer_name || '' } };
      }
      // Dues — create a new due record (credit sale from POS)
      if (url.includes('/dues')) {
        const result = await ipc('dues:create', {
          customer_id: data?.customer_id,
          sale_id: data?.sale_id,
          total_amount: data?.total_amount,
          amount_paid: data?.amount_paid ?? 0,
          due_date: data?.due_date,
          notes: data?.notes,
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to create due record');
        return { data: result?.data || { id: result?.id, ...data } };
      }
      // Purchases — record a stock purchase (from Inventory or Purchases page)
      if (url.includes('purchases')) {
        const invoiceNo = `PO-${Date.now()}`;
        const total = data?.total_cost ?? data?.total ?? 0;
        const purchasePayload = {
          invoice_no: invoiceNo,
          invoice_date: new Date().toISOString().split('T')[0],
          supplier_name: data?.supplier_name || 'Unknown Supplier',
          subtotal: total,
          total,
          amount_paid: data?.amount_paid ?? total,
          payment_method: data?.payment_method || 'cash',
          notes: data?.notes || undefined,
          created_by: 'admin',
        };
        const itemsPayload = (data?.items || []).map((item: any) => ({
          medicine_id: item.medicine ?? item.medicine_id ?? item.id,
          medicine_name: item.medicine_name || '',
          quantity: item.quantity_purchased ?? item.quantity ?? 1,
          unit_price: item.cost_per_unit ?? item.unit_price ?? 0,
        }));
        const result = await ipc('purchases:create', { purchase: purchasePayload, items: itemsPayload });
        if (!result?.success) throw new Error(result?.error || 'Failed to record purchase');
        return { data: { id: result?.id, ...data } };
      }
      // Refunds / Returns
      if (url.includes('refunds') || url.includes('returns')) {
        const refundedItems = (data?.items || []).filter((item: any) => (item.quantity_returned ?? item.quantity ?? 0) > 0);
        const returnPayload = {
          original_sale_id: data?.sale_id,
          return_invoice_no: `RET-${Date.now()}`,
          return_reason: data?.reason || 'Customer return',
          items_returned: refundedItems.reduce((sum: number, item: any) => sum + (item.quantity_returned ?? item.quantity ?? 0), 0),
          refund_amount: data?.total_amount || 0,
          notes: data?.notes || '',
          created_by: 'admin',
          items: refundedItems.map((item: any) => ({
            medicine_id: typeof item.medicine === 'number' ? item.medicine : item.medicine?.id ?? item.medicine_id ?? null,
            medicine_name: item.medicine?.generic_name || item.medicine?.name || item.medicine_name || item.generic_name || item.name || '',
            quantity_returned: item.quantity_returned ?? item.quantity ?? 0,
            unit_price: item.unit_price ?? 0,
          })),
        };
        const result = await ipc('returns:create', returnPayload);
        if (!result?.success) throw new Error(result?.error || 'Failed to create refund');
        return { data: { id: result?.id, ...data } };
      }
      console.warn('[desktopApi.post] unhandled:', url);
      return { data: { id: Date.now(), ...(data || {}) } };
    } catch (err) {
      console.error('[desktopApi.post] error:', url, err instanceof Error ? err.message : String(err));
      throw err;
    }
  },

  put: (url: string, data?: any) => {
    try {
      const urlId = url.match(/\/(\d+)\/?$/)?.[1];
      if (url.includes('inventory/medicines')) {
        const id = getEntityId(data?.id) ?? (urlId ? parseInt(urlId) : undefined);
        return ipc('medicines:update', { id, ...data }).then((r: any) => {
          if (!r?.success) throw new Error(r?.error || 'Failed to update medicine');
          return { data: r?.data || { id, ...data } };
        });
      }
      if (url.includes('customers') && urlId) {
        return ipc('customers:update', { id: parseInt(urlId), data }).then((r: any) => ({ data: r?.data || data }));
      }
      console.warn('[desktop api] unhandled PUT:', url);
      return Promise.resolve({ data: data || {} });
    } catch (err) {
      console.error('[desktopApi.put] error:', url, err);
      return Promise.reject(err);
    }
  },

  delete: async (url: string) => {
    try {
      const id = url.match(/\/(\d+)\/?$/)?.[1];
      if (url.includes('inventory/medicines') && id) {
        const r = await ipc('medicines:delete', parseInt(id));
        if (!r?.success) throw new Error(r?.error || 'Failed to delete medicine');
        return { data: null };
      }
      console.warn('[desktop api] unhandled DELETE:', url);
      return { data: null };
    } catch (err) {
      console.error('[desktopApi.delete] error:', url, err);
      throw err;
    }
  },

  interceptors: { request: { use: () => {} } },
};

const cloudAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://pharmacy-django-fj01.onrender.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

cloudAxios.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

cloudAxios.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (IS_ELECTRON && (window as any).electronAPI) {
        (window as any).electronAPI.invoke('db:clear');
      }
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

let baseApi: any;
if (IS_ELECTRON) {
  baseApi = desktopApi;
} else if (USE_DESKTOP_BACKEND) {
  baseApi = createBrowserDesktopApi(createHttpApi());
} else {
  baseApi = cloudAxios;
}

// Proxy to route /admin/ requests straight to cloud backend, bypassing desktop sqlite interceptor
const api: any = {
  get: (url: string, config?: any) => url.startsWith('/admin/') || url.startsWith('/auth/') ? cloudAxios.get(url, config) : baseApi.get(url, config),
  post: (url: string, data?: any, config?: any) => url.startsWith('/admin/') || url.startsWith('/auth/') ? cloudAxios.post(url, data, config) : baseApi.post(url, data, config),
  put: (url: string, data?: any, config?: any) => url.startsWith('/admin/') || url.startsWith('/auth/') ? cloudAxios.put(url, data, config) : baseApi.put(url, data, config),
  delete: (url: string, config?: any) => url.startsWith('/admin/') || url.startsWith('/auth/') ? cloudAxios.delete(url, config) : baseApi.delete(url, config),
  patch: (url: string, data?: any, config?: any) => url.startsWith('/admin/') || url.startsWith('/auth/') ? cloudAxios.patch(url, data, config) : baseApi.patch(url, data, config),
  interceptors: baseApi.interceptors || cloudAxios.interceptors,
};

export const authService = {
  login: (identifier: string, password: string) =>
    api.post('/auth/login/', { username: identifier, password }),
  register: (data: { username: string; email: string; password: string; first_name?: string; last_name?: string }) =>
    api.post('/auth/register/', data),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

export const medicineService = {
  getAll: (params?: any) => api.get('/inventory/medicines/', { params }),
  search: (query: string) => api.get('/inventory/medicines/', { params: { search: query } }),
  getByBarcode: (barcode: string) => api.get('/inventory/medicines/', { params: { search: barcode } }),
  create: (data: any) => api.post('/inventory/medicines/', data),
  update: (id: number, data: any) => api.put(`/inventory/medicines/${id}/`, data),
  delete: (id: number) => api.delete(`/inventory/medicines/${id}/`),
};

export const inventoryService = {
  getBranchInventory: () => api.get('/inventory/medicines/'),
  getLowStock: async () => {
    const response = await api.get('/inventory/medicines/low_stock/');
    const results = extractResults(response.data).map(normalizeLowStockItem);
    return { ...response, data: { results } };
  },
  getExpiringSoon: async (days: number = 30) => {
    const response = await api.get('/inventory/batches/expiring_soon/', { params: { days } });
    const results = extractResults(response.data).map(normalizeExpiringItem);
    return { ...response, data: { results } };
  },
};

export const salesService = {
  createSale: (data: any) => api.post('/sales/sales/', data),
  getSales: (params?: any) => api.get('/sales/sales/', { params }),
  processPayment: (saleId: string, data: any) =>
    api.post(`/sales/sales/${saleId}/process_payment/`, data),
  getDailySummary: () => api.get('/sales/sales/'),
};

export const customerService = {
  getAll: (params?: any) => api.get('/customers/customers/', { params }),
  create: (data: any) => api.post('/customers/customers/', data),
  addLoyaltyPoints: (id: number, points: number) =>
    api.post(`/customers/customers/${id}/add_loyalty_points/`, { points, description: 'Manual addition' }),
};

export const analyticsService = {
  // In Electron: calls analytics:dashboard IPC (pre-computed SQL aggregates)
  // In browser: calls buildDashboardMetrics which fetches from HTTP server
  getDashboard: async () => ({ data: await buildDashboardMetrics() }),
  getKPIs: () =>
    IS_ELECTRON
      ? ipc('analytics:dashboard').then((r: any) => ({ data: r?.data || {} }))
      : api.get('/analytics/kpis/'),
  getDailySales: async (days: number = 30) =>
    USE_DESKTOP_BACKEND
      ? { data: await buildDesktopDailySalesData(days) }
      : api.get('/analytics/daily-sales/', { params: { days } }),
  getInventoryValuation: async () =>
    USE_DESKTOP_BACKEND
      ? { data: await buildDesktopInventoryValuation() }
      : api.get('/analytics/inventory-valuation/'),
};

export const accountingService = {
  // In Electron: calls accounting:report IPC (one SQL JOIN, no JS iteration)
  // In browser: calls buildDesktopAccountingReportFromApi which fetches from HTTP server
  getProfitLoss: async (period: 'daily' | 'monthly' | 'annual' = 'monthly') =>
    USE_DESKTOP_BACKEND
      ? { data: await buildDesktopAccountingReportFromApi(period) }
      : api.get('/accounting/profit-loss/', { params: { period } }),
  getSummary: async () =>
    USE_DESKTOP_BACKEND
      ? { data: await buildDesktopAccountingSummaryFromApi() }
      : api.get('/accounting/summary/'),
};

// ---- Desktop initialization: just run initial sync ----
export async function initializeDesktopAPI(_serverApi: any) {
  if (!IS_ELECTRON) return;
  // Do NOT call sync:import-all — that wipes the local database.
  // Local SQLite data is persistent; no server sync needed on login.
  console.log('[api] Desktop IPC API ready (local SQLite)');
}

export default api;

