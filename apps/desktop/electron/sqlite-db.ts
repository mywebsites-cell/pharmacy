// ============================================================
// Local SQLite Database — ALL pharmacy business data stays here
// Nothing in this file ever goes to the cloud
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const DB_PATH = path.join(DATA_DIR, 'pharmacy.db');

let db: Database.Database;

// ---- Init & Migrations -----------------------------------------

export function initDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // ── Performance PRAGMAs ────────────────────────────────────────
  // WAL: readers don't block writers; writers don't block readers
  db.pragma('journal_mode = WAL');
  // 64 MB page cache (default is only 2 MB) – keeps hot pages in RAM
  db.pragma('cache_size = -65536');  // negative = kibibytes
  // Map the entire DB file into virtual memory – eliminates OS read() calls
  db.pragma('mmap_size = 268435456'); // 256 MB
  // Store temp tables/indexes in RAM, not on disk
  db.pragma('temp_store = MEMORY');
  // Relax fsync to once per WAL checkpoint – safe on power-loss with WAL
  db.pragma('synchronous = NORMAL');
  // Enforce referential integrity
  db.pragma('foreign_keys = ON');
  // ──────────────────────────────────────────────────────────────

  runMigrations();
  console.log('[SQLite] Database ready at:', DB_PATH);
}

function runMigrations(): void {
  db.exec(`
    -- medicines (Product Master)
    CREATE TABLE IF NOT EXISTS medicines (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL UNIQUE,
      barcode          TEXT UNIQUE,
      batch_no         TEXT,
      manufacturing_date TEXT,
      expiry_date      TEXT,
      quantity         INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      min_quantity     INTEGER DEFAULT 10,
      max_quantity     INTEGER DEFAULT 100,
      purchase_price   REAL NOT NULL DEFAULT 0 CHECK(purchase_price >= 0),
      selling_price    REAL NOT NULL DEFAULT 0 CHECK(selling_price >= 0),
      mrp              REAL,
      supplier         TEXT,
      category         TEXT NOT NULL DEFAULT 'General',
      subcategory      TEXT,
      dosage_form      TEXT,
      strength         TEXT,
      manufacturer     TEXT,
      registration_no  TEXT,
      status           TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'discontinued')),
      reorder_level    INTEGER DEFAULT 20,
      last_reorder_date TEXT,
      usage_count      INTEGER DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_by       TEXT,
      updated_by       TEXT
    );

    -- stock_movements (Track all stock changes)
    CREATE TABLE IF NOT EXISTS stock_movements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id      INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
      movement_type    TEXT NOT NULL CHECK(movement_type IN ('in', 'out', 'adjustment', 'damage', 'return')),
      quantity_change  INTEGER NOT NULL,
      reference_type   TEXT,
      reference_id     INTEGER,
      reason           TEXT,
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_by       TEXT
    );

    -- customers (Enhanced with credit limits and payment tracking)
    CREATE TABLE IF NOT EXISTS customers (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL,
      phone                TEXT UNIQUE,
      address              TEXT,
      email                TEXT UNIQUE,
      customer_type        TEXT NOT NULL DEFAULT 'retail' CHECK(customer_type IN ('retail', 'wholesale', 'institutional')),
      credit_limit         REAL DEFAULT 0 CHECK(credit_limit >= 0),
      credit_used          REAL DEFAULT 0 CHECK(credit_used >= 0),
      outstanding_balance  REAL DEFAULT 0 CHECK(outstanding_balance >= 0),
      total_purchased      REAL DEFAULT 0 CHECK(total_purchased >= 0),
      total_paid           REAL DEFAULT 0 CHECK(total_paid >= 0),
      status               TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'blacklisted')),
      last_purchase_date   TEXT,
      notes                TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
      created_by           TEXT,
      updated_by           TEXT
    );

    -- suppliers (Enhanced)
    CREATE TABLE IF NOT EXISTS suppliers (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL UNIQUE,
      phone             TEXT UNIQUE,
      address           TEXT,
      email             TEXT,
      contact_person    TEXT,
      payment_terms     TEXT,
      credit_limit      REAL DEFAULT 0,
      credit_used       REAL DEFAULT 0,
      outstanding_due   REAL DEFAULT 0 CHECK(outstanding_due >= 0),
      total_purchases   REAL DEFAULT 0 CHECK(total_purchases >= 0),
      average_lead_time INTEGER,
      status            TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'blocked')),
      tax_id            TEXT,
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      created_by        TEXT
    );

    -- sales (Enhanced with comprehensive tracking)
    CREATE TABLE IF NOT EXISTS sales (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no           TEXT UNIQUE NOT NULL,
      invoice_date         TEXT NOT NULL DEFAULT (date('now')),
      customer_id          INTEGER REFERENCES customers(id),
      customer_name        TEXT,
      customer_phone       TEXT,
      subtotal             REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
      discount_amount      REAL DEFAULT 0 CHECK(discount_amount >= 0),
      discount_percent     REAL DEFAULT 0 CHECK(discount_percent >= 0 AND discount_percent <= 100),
      tax_amount           REAL DEFAULT 0 CHECK(tax_amount >= 0),
      tax_percent          REAL DEFAULT 0 CHECK(tax_percent >= 0),
      total                REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
      amount_paid          REAL DEFAULT 0 CHECK(amount_paid >= 0),
      balance_due          REAL GENERATED ALWAYS AS (total - amount_paid) VIRTUAL,
      payment_method       TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'card', 'cheque', 'credit', 'upi')),
      payment_status       TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'partial', 'paid', 'overdue')),
      sale_type            TEXT NOT NULL DEFAULT 'retail' CHECK(sale_type IN ('retail', 'wholesale', 'return')),
      reference_invoice    INTEGER REFERENCES sales(id),
      notes                TEXT,
      status               TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('draft', 'completed', 'voided', 'returned')),
      void_reason          TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
      created_by           TEXT,
      updated_by           TEXT
    );

    -- sale_items (Line items with tracking)
    CREATE TABLE IF NOT EXISTS sale_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      medicine_id  INTEGER NOT NULL REFERENCES medicines(id),
      medicine_name TEXT NOT NULL,
      batch_no     TEXT,
      quantity     INTEGER NOT NULL CHECK(quantity > 0),
      unit_price   REAL NOT NULL CHECK(unit_price >= 0),
      discount     REAL DEFAULT 0 CHECK(discount >= 0),
      tax          REAL DEFAULT 0 CHECK(tax >= 0),
      total        REAL GENERATED ALWAYS AS (quantity * unit_price - discount + tax) VIRTUAL,
      expiry_date  TEXT,
      notes        TEXT
    );

    -- returns (Sales returns/refunds management)
    CREATE TABLE IF NOT EXISTS returns (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      original_sale_id    INTEGER NOT NULL REFERENCES sales(id),
      return_invoice_no   TEXT UNIQUE NOT NULL,
      return_date         TEXT NOT NULL DEFAULT (date('now')),
      return_reason       TEXT NOT NULL,
      items_returned      INTEGER NOT NULL CHECK(items_returned > 0),
      refund_amount       REAL NOT NULL CHECK(refund_amount > 0),
      refund_method       TEXT,
      refund_status       TEXT NOT NULL DEFAULT 'pending' CHECK(refund_status IN ('pending', 'processed', 'rejected')),
      refund_date         TEXT,
      notes               TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      created_by          TEXT
    );

    -- payments (Payment tracking)
    CREATE TABLE IF NOT EXISTS payments (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id           INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      purchase_id       INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
      customer_id       INTEGER REFERENCES customers(id),
      supplier_id       INTEGER REFERENCES suppliers(id),
      amount            REAL NOT NULL CHECK(amount > 0),
      payment_method    TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'cheque', 'bank_transfer', 'upi')),
      payment_date      TEXT NOT NULL DEFAULT (date('now')),
      reference_no      TEXT,
      status            TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'reversed')),
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      created_by        TEXT
    );

    -- purchases (Enhanced)
    CREATE TABLE IF NOT EXISTS purchases (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no       TEXT UNIQUE NOT NULL,
      invoice_date     TEXT NOT NULL DEFAULT (date('now')),
      supplier_id      INTEGER REFERENCES suppliers(id),
      supplier_name    TEXT,
      subtotal         REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
      discount_amount  REAL DEFAULT 0 CHECK(discount_amount >= 0),
      discount_percent REAL DEFAULT 0 CHECK(discount_percent >= 0),
      tax_amount       REAL DEFAULT 0 CHECK(tax_amount >= 0),
      tax_percent      REAL DEFAULT 0 CHECK(tax_percent >= 0),
      total            REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
      amount_paid      REAL DEFAULT 0 CHECK(amount_paid >= 0),
      balance_due      REAL GENERATED ALWAYS AS (total - amount_paid) VIRTUAL,
      payment_method   TEXT NOT NULL DEFAULT 'cash',
      payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'partial', 'paid')),
      status           TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('pending', 'received', 'partially_received', 'returned', 'voided')),
      expected_date    TEXT,
      received_date    TEXT,
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      created_by       TEXT
    );

    -- purchase_items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id   INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      medicine_id   INTEGER REFERENCES medicines(id),
      medicine_name TEXT NOT NULL,
      batch_no      TEXT,
      quantity      INTEGER NOT NULL CHECK(quantity > 0),
      unit_price    REAL NOT NULL CHECK(unit_price >= 0),
      discount      REAL DEFAULT 0 CHECK(discount >= 0),
      tax           REAL DEFAULT 0 CHECK(tax >= 0),
      total         REAL GENERATED ALWAYS AS (quantity * unit_price - discount + tax) VIRTUAL,
      expiry_date   TEXT,
      notes         TEXT
    );

    -- dues (Customer credit tracking)
    CREATE TABLE IF NOT EXISTS dues (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      sale_id        INTEGER REFERENCES sales(id),
      total_amount   REAL NOT NULL CHECK(total_amount > 0),
      amount_paid    REAL NOT NULL DEFAULT 0 CHECK(amount_paid >= 0),
      balance        REAL GENERATED ALWAYS AS (total_amount - amount_paid) VIRTUAL,
      due_date       TEXT,
      status         TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid', 'overdue', 'written_off')),
      overdue_days   INTEGER DEFAULT 0,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- prescriptions (Enhanced)
    CREATE TABLE IF NOT EXISTS prescriptions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_no TEXT UNIQUE,
      patient_name    TEXT NOT NULL,
      patient_phone   TEXT,
      patient_age     INTEGER,
      patient_gender  TEXT CHECK(patient_gender IN ('M', 'F', 'Other')),
      doctor_name     TEXT,
      doctor_phone    TEXT,
      doctor_license  TEXT,
      prescription_date TEXT NOT NULL DEFAULT (date('now')),
      status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fulfilled', 'partial', 'cancelled')),
      sale_id         INTEGER REFERENCES sales(id),
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      created_by      TEXT
    );

    -- prescription_items
    CREATE TABLE IF NOT EXISTS prescription_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id   INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      medicine_name     TEXT NOT NULL,
      dosage            TEXT,
      quantity_prescribed INTEGER,
      quantity_dispensed INTEGER DEFAULT 0,
      frequency         TEXT,
      duration          TEXT,
      instructions      TEXT,
      notes             TEXT
    );

    -- expenses (Enhanced accounting)
    CREATE TABLE IF NOT EXISTS expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT NOT NULL,
      subcategory   TEXT,
      description   TEXT NOT NULL,
      amount        REAL NOT NULL CHECK(amount > 0),
      date          TEXT NOT NULL DEFAULT (date('now')),
      payment_method TEXT,
      reference_no  TEXT,
      status        TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('draft', 'recorded', 'reconciled')),
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_by    TEXT
    );

    -- settings
    CREATE TABLE IF NOT EXISTS settings (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      key   TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- audit_log (Comprehensive audit trail)
    CREATE TABLE IF NOT EXISTS audit_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type   TEXT NOT NULL,
      entity_id     INTEGER,
      action        TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'view')),
      old_value     TEXT,
      new_value     TEXT,
      user          TEXT,
      ip_address    TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Professional Indexes for Performance
    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
    CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_medicines_status ON medicines(status);
    -- Compound index: covers filter-by-medicine AND sort-by-date in one B-Tree scan
    CREATE INDEX IF NOT EXISTS idx_stock_movements_med_date ON stock_movements(medicine_id, created_at DESC);
    -- Separate date index for date-range-only queries (no medicine filter)
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_customers_credit ON customers(credit_used);
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
    CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_medicine ON sale_items(medicine_id);
    CREATE INDEX IF NOT EXISTS idx_returns_original_sale ON returns(original_sale_id);
    CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date);
    CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_dues_customer ON dues(customer_id);
    CREATE INDEX IF NOT EXISTS idx_dues_status ON dues(status);
    CREATE INDEX IF NOT EXISTS idx_dues_date ON dues(created_at);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_phone);
    CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(prescription_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(created_at);
  `);

  // Existing installations may already have a DB file; CREATE TABLE IF NOT EXISTS
  // won't add newly introduced columns.
  ensureSchemaForExistingDb();
}

function ensureSchemaForExistingDb(): void {
  // medicines
  ensureColumn('medicines', 'manufacturing_date', 'TEXT');
  ensureColumn('medicines', 'status', 'TEXT');
  ensureColumn('medicines', 'min_quantity', 'INTEGER');
  ensureColumn('medicines', 'max_quantity', 'INTEGER');
  db.exec(`UPDATE medicines SET status = COALESCE(NULLIF(status, ''), 'active') WHERE status IS NULL OR status = ''`);
  db.exec(`UPDATE medicines SET barcode = NULL WHERE barcode IS NOT NULL AND TRIM(barcode) = ''`);

  // sales
  ensureColumn('sales', 'invoice_date', 'TEXT');
  ensureColumn('sales', 'status', 'TEXT');
  db.exec(`UPDATE sales SET invoice_date = COALESCE(NULLIF(invoice_date, ''), date('now')) WHERE invoice_date IS NULL OR invoice_date = ''`);
  db.exec(`UPDATE sales SET status = COALESCE(NULLIF(status, ''), 'completed') WHERE status IS NULL OR status = ''`);

  // purchases
  ensureColumn('purchases', 'invoice_date', 'TEXT');
  db.exec(`UPDATE purchases SET invoice_date = COALESCE(NULLIF(invoice_date, ''), date('now')) WHERE invoice_date IS NULL OR invoice_date = ''`);

  // returns
  ensureColumn('returns', 'return_date', 'TEXT');
  db.exec(`UPDATE returns SET return_date = COALESCE(NULLIF(return_date, ''), date('now')) WHERE return_date IS NULL OR return_date = ''`);
  ensureColumn('returns', 'items_json', 'TEXT');

  // ── Ensure new indexes exist on every startup for existing DB files ──
  // CREATE INDEX IF NOT EXISTS is a no-op when the index already exists,
  // so this is safe to run on every boot.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stock_movements_med_date
      ON stock_movements(medicine_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date
      ON stock_movements(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_date
      ON sales(invoice_date DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_date
      ON sales(customer_id, invoice_date DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_status_date
      ON sales(status, invoice_date DESC);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_med
      ON sale_items(sale_id, medicine_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_qty_status
      ON medicines(status, quantity);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry_status
      ON medicines(status, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date
      ON purchases(invoice_date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_date_desc
      ON expenses(date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_ym
      ON expenses(substr(date,1,7));
    CREATE INDEX IF NOT EXISTS idx_sales_ym
      ON sales(substr(invoice_date,1,7));
    CREATE INDEX IF NOT EXISTS idx_purchases_ym
      ON purchases(substr(invoice_date,1,7));
  `);
}

function ensureColumn(table: string, column: string, definitionSql: string): void {
  const existing = dbQuery<{ name: string }>(`PRAGMA table_info(${table})`).map((r) => r.name);
  if (existing.includes(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definitionSql}`);
}

// ---- Prepared statement cache ----------------------------------
// better-sqlite3 statements are cheap objects but compiling SQL on every
// call still costs ~0.1-0.5 ms per unique statement.  Caching them means
// each unique SQL string is compiled exactly once for the lifetime of the
// process, which can shave 10-50 ms off a page that runs 20+ queries.

const stmtCache = new Map<string, Database.Statement>();

function prepared(sql: string): Database.Statement {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

// ---- Generic query helpers -------------------------------------

export function dbQuery<T = any>(sql: string, params: any[] = []): T[] {
  return prepared(sql).all(...params) as T[];
}

export function dbGet<T = any>(sql: string, params: any[] = []): T | undefined {
  return prepared(sql).get(...params) as T | undefined;
}

export function dbRun(sql: string, params: any[] = []): Database.RunResult {
  return prepared(sql).run(...params);
}

export function dbTransaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

// ---- Medicines (Enhanced with comprehensive tracking) -----

export const medicinesDB = {
  getAll: () => dbQuery('SELECT * FROM medicines ORDER BY name'),
  getById: (id: number) => dbGet('SELECT * FROM medicines WHERE id = ?', [id]),
  getByBarcode: (barcode: string) => dbGet('SELECT * FROM medicines WHERE barcode = ?', [barcode]),
  getByNormalizedName: (name: string) => dbGet(`SELECT * FROM medicines WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`, [name]),
  getLowStock: () =>
    dbQuery(`SELECT * FROM medicines WHERE quantity <= min_quantity AND status = 'active' ORDER BY quantity`),
  getExpiringSoon: (days = 30) =>
    dbQuery(
      `SELECT * FROM medicines WHERE expiry_date IS NOT NULL
       AND date(expiry_date) <= date('now', '+${days} days')
       AND status = 'active'
       ORDER BY expiry_date`
    ),
  getByCategory: (category: string) =>
    dbQuery(`SELECT * FROM medicines WHERE category = ? AND status = 'active' ORDER BY name`, [category]),
  getBySupplier: (supplier: string) =>
    dbQuery(`SELECT * FROM medicines WHERE supplier = ? AND status = 'active' ORDER BY name`, [supplier]),
  getActive: () => dbQuery(`SELECT * FROM medicines WHERE status = 'active' ORDER BY name`),
  create: (m: {
    name: string;
    barcode?: string;
    batch_no?: string;
    manufacturing_date?: string;
    expiry_date?: string;
    quantity: number;
    min_quantity?: number;
    max_quantity?: number;
    purchase_price: number;
    selling_price: number;
    mrp?: number;
    supplier?: string;
    category: string;
    subcategory?: string;
    dosage_form?: string;
    strength?: string;
    manufacturer?: string;
    registration_no?: string;
    reorder_level?: number;
    created_by?: string;
  }) => {
    return dbRun(
      `INSERT INTO medicines (name, barcode, batch_no, manufacturing_date, expiry_date, quantity, min_quantity, max_quantity, purchase_price, selling_price, mrp, supplier, category, subcategory, dosage_form, strength, manufacturer, registration_no, reorder_level, created_by)
       VALUES (?, NULLIF(TRIM(?), ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.name, m.barcode, m.batch_no, m.manufacturing_date, m.expiry_date, m.quantity, m.min_quantity ?? 10, m.max_quantity ?? 100,
        m.purchase_price, m.selling_price, m.mrp, m.supplier, m.category, m.subcategory,
        m.dosage_form, m.strength, m.manufacturer, m.registration_no, m.reorder_level ?? 20, m.created_by
      ]
    );
  },
  update: (id: number, m: Partial<{
    name: string;
    barcode: string | null;
    batch_no: string;
    quantity: number;
    selling_price: number;
    purchase_price: number;
    manufacturing_date: string;
    expiry_date: string;
    reorder_level: number;
    min_quantity: number;
    max_quantity: number;
    status: string;
    manufacturer: string;
    category: string;
    dosage_form: string;
    strength: string;
  }>, updatedBy?: string) => {
    const entries = Object.entries(m).map(([key, value]) => [key, key === 'barcode' && typeof value === 'string' ? value.trim() : value] as const);
    const fields = entries.map(([key, value]) => key === 'barcode' ? `${key} = NULLIF(TRIM(?), '')` : `${key} = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    if (updatedBy) {
      return dbRun(
        `UPDATE medicines SET ${fields}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [...values, updatedBy, id]
      );
    }
    return dbRun(`UPDATE medicines SET ${fields} WHERE id = ?`, [...values, id]);
  },
  delete: (id: number) => {
    // Mark as discontinued and zero the quantity.
    // Zeroing prevents stale stock from accumulating if the medicine is later
    // re-created via bulk import (which uses increment mode).
    return dbRun(
      `UPDATE medicines SET status = ?, quantity = 0, updated_at = datetime('now') WHERE id = ?`,
      ['discontinued', id]
    );
  },
  adjustStock: (id: number, delta: number) =>
    dbRun('UPDATE medicines SET quantity = MAX(0, quantity + ?) WHERE id = ?', [delta, id]),
  incrementUsage: (id: number) =>
    dbRun('UPDATE medicines SET usage_count = usage_count + 1 WHERE id = ?', [id]),
};

// ---- Sales (Enhanced with payment tracking) -----

export const salesDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery('SELECT * FROM sales ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
  getById: (id: number) => dbGet('SELECT * FROM sales WHERE id = ?', [id]),
  getByInvoiceNo: (invoiceNo: string) => dbGet('SELECT * FROM sales WHERE invoice_no = ?', [invoiceNo]),
  getItems: (saleId: number) =>
    dbQuery(
      `SELECT si.* FROM sale_items si WHERE si.sale_id = ? ORDER BY si.id`,
      [saleId]
    ),
  getPending: () =>
    dbQuery(`SELECT * FROM sales WHERE payment_status IN ('pending', 'partial') ORDER BY created_at DESC`),
  getByCustomer: (customerId: number) =>
    dbQuery(`SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC`, [customerId]),
  getByDateRange: (startDate: string, endDate: string) =>
    // Raw comparison lets SQLite use idx_sales_date index (date() wrapper breaks it).
    // Caller should pass 'YYYY-MM-DD 00:00:00' and 'YYYY-MM-DD 23:59:59'.
    dbQuery(
      `SELECT * FROM sales WHERE invoice_date >= ? AND invoice_date <= ? ORDER BY invoice_date DESC`,
      [startDate, endDate]
    ),
  create: (
    sale: {
      invoice_no: string;
      invoice_date?: string;
      customer_id?: number;
      customer_name?: string;
      customer_phone?: string;
      subtotal: number;
      discount_amount?: number;
      discount_percent?: number;
      tax_amount?: number;
      tax_percent?: number;
      total: number;
      amount_paid?: number;
      payment_method: string;
      payment_status?: string;
      notes?: string;
      created_by?: string;
    },
    items: { medicine_id: number; quantity: number; unit_price: number; discount?: number; tax?: number }[]
  ) => {
    return dbTransaction(() => {
      const amountPaid = sale.amount_paid ?? 0;
      const computedStatus = sale.payment_status
        ? sale.payment_status
        : amountPaid >= sale.total
          ? 'paid'
          : amountPaid > 0
            ? 'partial'
            : 'pending';
      const invoiceDate = sale.invoice_date ?? new Date().toISOString().split('T')[0];

      const result = dbRun(
        `INSERT INTO sales (invoice_no, invoice_date, customer_id, customer_name, customer_phone, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, total, amount_paid, payment_method, payment_status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sale.invoice_no, invoiceDate, sale.customer_id, sale.customer_name, sale.customer_phone, sale.subtotal,
          sale.discount_amount ?? 0, sale.discount_percent ?? 0, sale.tax_amount ?? 0, sale.tax_percent ?? 0,
          sale.total, amountPaid, sale.payment_method, computedStatus, sale.notes, sale.created_by
        ]
      );
      const saleId = result.lastInsertRowid as number;

      // Add items
      for (const item of items) {
        dbRun(
          `INSERT INTO sale_items (sale_id, medicine_id, medicine_name, quantity, unit_price, discount, tax)
           SELECT ?, ?, name, ?, ?, ?, ? FROM medicines WHERE id = ?`,
          [saleId, item.medicine_id, item.quantity, item.unit_price, item.discount ?? 0, item.tax ?? 0, item.medicine_id]
        );
        // Deduct stock and track movement
        medicinesDB.adjustStock(item.medicine_id, -item.quantity);
        dbRun(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity_change, reference_type, reference_id, reason, created_by)
           VALUES (?, 'out', ?, 'sale', ?, 'Sale', ?)`,
          [item.medicine_id, -item.quantity, saleId, sale.created_by]
        );
      }
      // Update customer tracking
      if (sale.customer_id) {
        dbRun(
          `UPDATE customers SET total_purchased = total_purchased + ?, last_purchase_date = datetime('now') WHERE id = ?`,
          [sale.total, sale.customer_id]
        );
      }
      // Log in audit
      dbRun(
        `INSERT INTO audit_log (entity_type, entity_id, action, new_value, user) VALUES (?, ?, 'create', ?, ?)`,
        ['sale', saleId, JSON.stringify(sale), sale.created_by]
      );
      return saleId;
    });
  },
  update: (id: number, updates: Partial<{
    payment_status: string;
    payment_method: string;
    amount_paid: number;
    notes: string;
  }>, updatedBy?: string) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    if (updatedBy) {
      return dbRun(
        `UPDATE sales SET ${fields}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [...Object.values(updates), updatedBy, id]
      );
    }
    return dbRun(`UPDATE sales SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
  },
  recordPayment: (saleId: number, amount: number, method: string, referenceNo?: string, createdBy?: string) => {
    return dbTransaction(() => {
      const sale = salesDB.getById(saleId);
      if (!sale) throw new Error('Sale not found');
      const newAmountPaid = sale.amount_paid + amount;
      const newStatus = newAmountPaid >= sale.total ? 'paid' : newAmountPaid > 0 ? 'partial' : 'pending';
      dbRun(
        `UPDATE sales SET amount_paid = ?, payment_status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [newAmountPaid, newStatus, createdBy, saleId]
      );
      dbRun(
        `INSERT INTO payments (sale_id, amount, payment_method, reference_no, created_by) VALUES (?, ?, ?, ?, ?)`,
        [saleId, amount, method, referenceNo, createdBy]
      );
    });
  },
  getDailySummary: (date?: string) => {
    const d = date || new Date().toISOString().split('T')[0];
    // substr() comparison uses idx_sales_ym index; date() wrapper kills index usage
    return dbGet(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(discount_amount), 0) AS discounts
       FROM sales WHERE substr(invoice_date,1,10) = ? AND status != 'voided'`,
      [d]
    );
  },
  getMonthlySummary: (year: number, month: number) =>
    // substr(invoice_date,1,7)='YYYY-MM' uses idx_sales_ym covering index
    dbGet(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(discount_amount), 0) AS discounts
       FROM sales WHERE substr(invoice_date,1,7) = ? AND status != 'voided'`,
      [`${String(year)}-${String(month).padStart(2, '0')}`]
    ),
};

// ---- Customers (Enhanced) ------

export const customersDB = {
  getAll: () => dbQuery('SELECT * FROM customers ORDER BY name'),
  getById: (id: number) => dbGet('SELECT * FROM customers WHERE id = ?', [id]),
  getByPhone: (phone: string) => dbGet('SELECT * FROM customers WHERE phone = ?', [phone]),
  getHighCredit: () =>
    dbQuery('SELECT * FROM customers WHERE credit_used > 0 ORDER BY credit_used DESC'),
  create: (c: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    customer_type?: string;
    credit_limit?: number;
    created_by?: string;
  }) =>
    dbRun(
      `INSERT INTO customers (name, phone, address, email, customer_type, credit_limit, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.name, c.phone, c.address, c.email, c.customer_type ?? 'retail', c.credit_limit ?? 0, c.created_by]
    ),
  update: (id: number, c: Partial<{
    name: string;
    phone: string;
    address: string;
    email: string;
    credit_limit: number;
    status: string;
  }>, updatedBy?: string) => {
    const fields = Object.keys(c).map(k => `${k} = ?`).join(', ');
    if (updatedBy) {
      return dbRun(
        `UPDATE customers SET ${fields}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
        [...Object.values(c), updatedBy, id]
      );
    }
    return dbRun(`UPDATE customers SET ${fields} WHERE id = ?`, [...Object.values(c), id]);
  },
  delete: (id: number) => dbRun('DELETE FROM customers WHERE id = ?', [id]),
};

// ---- Returns & Refunds -----

export const returnsDB = {
  getAll: (limit = 50, offset = 0) =>
    dbQuery(`SELECT * FROM returns ORDER BY return_date DESC LIMIT ? OFFSET ?`, [limit, offset]),
  getByOriginalSale: (saleId: number) =>
    dbQuery(`SELECT * FROM returns WHERE original_sale_id = ?`, [saleId]),
  create: (r: {
    original_sale_id?: number;
    return_invoice_no: string;
    return_reason: string;
    items_returned: number;
    refund_amount: number;
    notes?: string;
    created_by?: string;
    items?: Array<{ medicine_id?: number; medicine_name?: string; quantity_returned: number; unit_price: number }>;
  }) => {
    return dbTransaction(() => {
      let originalSaleId = r.original_sale_id;

      if (!originalSaleId) {
        const placeholder = dbRun(
          `INSERT INTO sales (
             invoice_no, invoice_date, subtotal, total, amount_paid, payment_method,
             payment_status, sale_type, status, notes, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `RET-SRC-${Date.now()}`,
            new Date().toISOString().split('T')[0],
            r.refund_amount,
            r.refund_amount,
            r.refund_amount,
            'cash',
            'paid',
            'return',
            'returned',
            r.notes || 'Standalone refund source',
            r.created_by,
          ]
        );
        originalSaleId = placeholder.lastInsertRowid as number;
      }

      const itemsJson = r.items && r.items.length > 0 ? JSON.stringify(r.items) : null;
      const result = dbRun(
        `INSERT INTO returns (original_sale_id, return_invoice_no, return_reason, items_returned, refund_amount, notes, created_by, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [originalSaleId, r.return_invoice_no, r.return_reason, r.items_returned, r.refund_amount, r.notes, r.created_by, itemsJson]
      );
      // Create reversed sale entry
      const originalSale = originalSaleId ? salesDB.getById(originalSaleId) : undefined;
      if (originalSale && r.original_sale_id) {
        dbRun(
          `UPDATE sales SET total = total - ?, status = 'returned' WHERE id = ?`,
          [r.refund_amount, originalSaleId]
        );
      }
      return result.lastInsertRowid as number;
    });
  },
  processRefund: (returnId: number, refundMethod: string, createdBy?: string) => {
    dbRun(
      `UPDATE returns SET refund_status = 'processed', refund_date = date('now'), created_by = ? WHERE id = ?`,
      [createdBy, returnId]
    );
  },
};

// ---- Payments (Comprehensive tracking) -----

export const paymentsDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery(`SELECT * FROM payments ORDER BY payment_date DESC LIMIT ? OFFSET ?`, [limit, offset]),
  getBySale: (saleId: number) =>
    dbQuery(`SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date DESC`, [saleId]),
  getByCustomer: (customerId: number) =>
    dbQuery(`SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC`, [customerId]),
  getByDateRange: (startDate: string, endDate: string) =>
    // Raw comparison lets SQLite use idx_payments_date index.
    // Caller should pass 'YYYY-MM-DD 00:00:00' and 'YYYY-MM-DD 23:59:59'.
    dbQuery(
      `SELECT * FROM payments WHERE payment_date >= ? AND payment_date <= ? ORDER BY payment_date DESC`,
      [startDate, endDate]
    ),
  create: (p: {
    sale_id?: number;
    customer_id?: number;
    amount: number;
    payment_method: string;
    reference_no?: string;
    notes?: string;
    created_by?: string;
  }) =>
    dbRun(
      `INSERT INTO payments (sale_id, customer_id, amount, payment_method, reference_no, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.sale_id, p.customer_id, p.amount, p.payment_method, p.reference_no, p.notes, p.created_by]
    ),
};

// ---- Stock Movements -----

export const stockMovementsDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery(`SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]),
  getByMedicine: (medicineId: number, limit = 50) =>
    dbQuery(
      `SELECT * FROM stock_movements WHERE medicine_id = ? ORDER BY created_at DESC LIMIT ?`,
      [medicineId, limit]
    ),
  getByDateRange: (startDate: string, endDate: string) =>
    // Use raw timestamp comparison (not date() wrapper) so SQLite can use
    // idx_stock_movements_date index instead of doing a full table scan.
    // Caller should pass 'YYYY-MM-DD 00:00:00' and 'YYYY-MM-DD 23:59:59'.
    dbQuery(
      `SELECT * FROM stock_movements WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
      [startDate, endDate]
    ),
  create: (m: {
    medicine_id: number;
    movement_type: 'in' | 'out' | 'adjustment' | 'damage' | 'return';
    quantity_change: number;
    reference_type?: string;
    reference_id?: number;
    reason?: string;
    created_by?: string;
  }) =>
    dbRun(
      `INSERT INTO stock_movements (medicine_id, movement_type, quantity_change, reference_type, reference_id, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m.medicine_id, m.movement_type, m.quantity_change, m.reference_type, m.reference_id, m.reason, m.created_by]
    ),
};

// ---- Audit Log -----

export const auditLogDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]),
  getByEntity: (entityType: string, entityId?: number, limit = 50) => {
    if (entityId) {
      return dbQuery(
        `SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?`,
        [entityType, entityId, limit]
      );
    }
    return dbQuery(
      `SELECT * FROM audit_log WHERE entity_type = ? ORDER BY created_at DESC LIMIT ?`,
      [entityType, limit]
    );
  },
  getByUser: (user: string, limit = 50) =>
    dbQuery(
      `SELECT * FROM audit_log WHERE user = ? ORDER BY created_at DESC LIMIT ?`,
      [user, limit]
    ),
  log: (entry: {
    entity_type: string;
    entity_id?: number;
    action: 'create' | 'update' | 'delete' | 'view';
    old_value?: string;
    new_value?: string;
    user?: string;
    notes?: string;
  }) =>
    dbRun(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, user, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.entity_type, entry.entity_id, entry.action, entry.old_value, entry.new_value, entry.user, entry.notes]
    ),
};

// ---- Settings --------------------------------------------------

export const settingsDB = {
  get: (key: string): string | undefined => dbGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value,
  set: (key: string, value: string) =>
    dbRun(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`, [key, value]),
  getAll: () => dbQuery<{ key: string; value: string }>('SELECT key, value FROM settings'),
};

// ---- Suppliers (Enhanced) ------

export const suppliersDB = {
  getAll: () => dbQuery('SELECT * FROM suppliers ORDER BY name'),
  getById: (id: number) => dbGet('SELECT * FROM suppliers WHERE id = ?', [id]),
  getByName: (name: string) => dbGet('SELECT * FROM suppliers WHERE name = ?', [name]),
  getActive: () => dbQuery(`SELECT * FROM suppliers WHERE status = 'active' ORDER BY name`),
  getByPaymentTerms: (terms: string) =>
    dbQuery('SELECT * FROM suppliers WHERE payment_terms = ? ORDER BY name', [terms]),
  create: (s: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    contact_person?: string;
    payment_terms?: string;
    credit_limit?: number;
    tax_id?: string;
    notes?: string;
    created_by?: string;
  }) =>
    dbRun(
      `INSERT INTO suppliers (name, phone, address, email, contact_person, payment_terms, credit_limit, tax_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.name, s.phone, s.address, s.email, s.contact_person, s.payment_terms, s.credit_limit ?? 0, s.tax_id, s.notes, s.created_by]
    ),
  update: (id: number, s: Partial<{
    name: string;
    phone: string;
    address: string;
    email: string;
    contact_person: string;
    payment_terms: string;
    credit_limit: number;
    status: string;
  }>, updatedBy?: string) => {
    const fields = Object.keys(s).map(k => `${k} = ?`).join(', ');
    if (updatedBy) {
      return dbRun(
        `UPDATE suppliers SET ${fields}, updated_at = datetime('now') WHERE id = ?`,
        [...Object.values(s), id]
      );
    }
    return dbRun(`UPDATE suppliers SET ${fields} WHERE id = ?`, [...Object.values(s), id]);
  },
  updateCreditUsed: (id: number, amount: number) =>
    dbRun('UPDATE suppliers SET credit_used = credit_used + ? WHERE id = ?', [amount, id]),
};

// ---- Purchases (Enhanced) ------

export const purchasesDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery('SELECT * FROM purchases ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
  getById: (id: number) => dbGet('SELECT * FROM purchases WHERE id = ?', [id]),
  getByInvoiceNo: (invoiceNo: string) => dbGet('SELECT * FROM purchases WHERE invoice_no = ?', [invoiceNo]),
  getItems: (purchaseId: number) =>
    dbQuery('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id', [purchaseId]),
  getPending: () =>
    dbQuery(`SELECT * FROM purchases WHERE payment_status IN ('pending', 'partial') ORDER BY created_at DESC`),
  getBySupplier: (supplierId: number) =>
    dbQuery('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY created_at DESC', [supplierId]),
  getByDateRange: (startDate: string, endDate: string) =>
    // Raw comparison lets SQLite use idx_purchases_date index.
    // Caller should pass 'YYYY-MM-DD 00:00:00' and 'YYYY-MM-DD 23:59:59'.
    dbQuery(
      `SELECT * FROM purchases WHERE invoice_date >= ? AND invoice_date <= ? ORDER BY invoice_date DESC`,
      [startDate, endDate]
    ),
  create: (
    purchase: {
      invoice_no: string;
      invoice_date?: string;
      supplier_id?: number;
      supplier_name?: string;
      subtotal: number;
      discount_amount?: number;
      discount_percent?: number;
      tax_amount?: number;
      tax_percent?: number;
      total: number;
      amount_paid?: number;
      payment_method: string;
      payment_status?: string;
      expected_date?: string;
      notes?: string;
      created_by?: string;
    },
    items: { medicine_id?: number; medicine_name: string; quantity: number; unit_price: number; expiry_date?: string }[]
  ) => {
    return dbTransaction(() => {
      const amountPaid = purchase.amount_paid ?? 0;
      const computedStatus = purchase.payment_status
        ? purchase.payment_status
        : amountPaid >= purchase.total
          ? 'paid'
          : amountPaid > 0
            ? 'partial'
            : 'pending';
      const invoiceDate = purchase.invoice_date ?? new Date().toISOString().split('T')[0];

      const result = dbRun(
        `INSERT INTO purchases (invoice_no, invoice_date, supplier_id, supplier_name, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, total, amount_paid, payment_method, payment_status, expected_date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase.invoice_no, invoiceDate, purchase.supplier_id, purchase.supplier_name, purchase.subtotal,
          purchase.discount_amount ?? 0, purchase.discount_percent ?? 0, purchase.tax_amount ?? 0,
          purchase.tax_percent ?? 0, purchase.total, amountPaid, purchase.payment_method,
          computedStatus, purchase.expected_date, purchase.notes, purchase.created_by
        ]
      );
      const purchaseId = result.lastInsertRowid as number;

      for (const item of items) {
        dbRun(
          `INSERT INTO purchase_items (purchase_id, medicine_id, medicine_name, quantity, unit_price, expiry_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseId, item.medicine_id ?? null, item.medicine_name, item.quantity, item.unit_price, item.expiry_date]
        );
        // Update stock (but skip for 'Inventory Addition' - stock was already set when medicine was created)
        if (item.medicine_id && purchase.supplier_name !== 'Inventory Addition') {
          medicinesDB.adjustStock(item.medicine_id, item.quantity);
          dbRun(
            `INSERT INTO stock_movements (medicine_id, movement_type, quantity_change, reference_type, reference_id, reason, created_by)
             VALUES (?, 'in', ?, 'purchase', ?, 'Purchase', ?)`,
            [item.medicine_id, item.quantity, purchaseId, purchase.created_by]
          );
        }
      }

      // Update supplier tracking
      if (purchase.supplier_id) {
        dbRun(
          `UPDATE suppliers SET total_purchases = total_purchases + ? WHERE id = ?`,
          [purchase.total, purchase.supplier_id]
        );
      }

      // Log audit
      dbRun(
        `INSERT INTO audit_log (entity_type, entity_id, action, new_value, user) VALUES (?, ?, 'create', ?, ?)`,
        ['purchase', purchaseId, JSON.stringify(purchase), purchase.created_by]
      );

      return purchaseId;
    });
  },
  recordPayment: (purchaseId: number, amount: number, method: string, referenceNo?: string, createdBy?: string) => {
    return dbTransaction(() => {
      const purchase = purchasesDB.getById(purchaseId);
      if (!purchase) throw new Error('Purchase not found');
      const newAmountPaid = purchase.amount_paid + amount;
      const newStatus = newAmountPaid >= purchase.total ? 'paid' : newAmountPaid > 0 ? 'partial' : 'pending';
      dbRun(
        `UPDATE purchases SET amount_paid = ?, payment_status = ? WHERE id = ?`,
        [newAmountPaid, newStatus, purchaseId]
      );
      dbRun(
        `INSERT INTO payments (purchase_id, amount, payment_method, reference_no, created_by) VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, amount, method, referenceNo, createdBy]
      );
    });
  },
};

// ---- Advanced Reporting & Analytics -----

export const reportingDB = {
  getDailyReport: (date?: string) => {
    const d = date || new Date().toISOString().split('T')[0];
    const sales = salesDB.getDailySummary(d);
    const expenses = expensesDB.getTotalByMonth(
      new Date(d).getFullYear(),
      new Date(d).getMonth() + 1
    );
    return {
      date: d,
      sales_count: sales?.count || 0,
      sales_revenue: sales?.revenue || 0,
      daily_expenses: expenses?.total || 0,
      net_profit: (sales?.revenue || 0) - (expenses?.total || 0),
    };
  },

  getMonthlyReport: (year: number, month: number) => {
    const ym = `${String(year)}-${String(month).padStart(2, '0')}`;
    const sales = salesDB.getMonthlySummary(year, month);
    // Use substr(col,1,7) which can use idx_purchases_ym covering index
    const purchases = dbGet<{ count: number; total: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM purchases
       WHERE substr(invoice_date,1,7) = ?`,
      [ym]
    );
    const expenses = expensesDB.getTotalByMonth(year, month);
    // Use substr covering index
    const discounts = dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(discount_amount), 0) as total FROM sales
       WHERE substr(invoice_date,1,7) = ?`,
      [ym]
    );
    return {
      year,
      month,
      sales_count: sales?.count || 0,
      sales_revenue: sales?.revenue || 0,
      purchases_count: purchases?.count || 0,
      purchases_total: purchases?.total || 0,
      total_discounts: discounts?.total || 0,
      total_expenses: expenses?.total || 0,
      net_profit: (sales?.revenue || 0) - (purchases?.total || 0) - (expenses?.total || 0),
    };
  },

  getStockAnalysis: () => {
    const lowStock = medicinesDB.getLowStock();
    const expiring = medicinesDB.getExpiringSoon(30);
    // Use COUNT(*) aggregate instead of fetching all rows and calling .length
    const totals = dbGet<{ count: number; value: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(quantity * selling_price), 0) as value
       FROM medicines WHERE status != 'discontinued'`
    );
    return {
      total_medicines: totals?.count || 0,
      low_stock_count: lowStock.length,
      expiring_soon: expiring.length,
      inventory_value: totals?.value || 0,
      low_stock_items: lowStock,
      expiring_items: expiring,
    };
  },

  getCustomerAnalytics: () => {
    const activeCustomers = dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM customers WHERE status = 'active'`
    );
    const totalOutstanding = dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(outstanding_balance), 0) as total FROM customers`
    );
    const topCustomers = dbQuery(
      `SELECT id, name, total_purchased, outstanding_balance FROM customers
       WHERE status = 'active' ORDER BY total_purchased DESC LIMIT 10`
    );
    return {
      active_customers: activeCustomers?.count || 0,
      total_outstanding: totalOutstanding?.total || 0,
      top_customers: topCustomers,
    };
  },

  getSupplierAnalytics: () => {
    const activeSuppliers = dbGet<{ count: number }>(
      `SELECT COUNT(*) as count FROM suppliers WHERE status = 'active'`
    );
    const totalOutstanding = dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(outstanding_due), 0) as total FROM suppliers`
    );
    const topSuppliers = dbQuery(
      `SELECT id, name, total_purchases, outstanding_due FROM suppliers
       WHERE status = 'active' ORDER BY total_purchases DESC LIMIT 10`
    );
    return {
      active_suppliers: activeSuppliers?.count || 0,
      total_outstanding_due: totalOutstanding?.total || 0,
      top_suppliers: topSuppliers,
    };
  },

  getSalesAnalytics: (days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    // Use full timestamps for raw >= / <= comparison so idx_sales_invoice_date is used
    const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
    const endStr   = new Date().toISOString().split('T')[0]  + ' 23:59:59';

    // Single query returns count, total, and avg in one pass — avoids 3 separate scans
    const summary = dbGet<{ count: number; total: number; avg: number }>(
      `SELECT COUNT(*) as count,
              COALESCE(SUM(total), 0) as total,
              COALESCE(AVG(total), 0) as avg
       FROM sales
       WHERE invoice_date >= ? AND invoice_date <= ? AND status != 'voided'`,
      [startStr, endStr]
    );
    const paymentMethods = dbQuery<{ method: string; count: number; total: number }>(
      `SELECT payment_method as method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM sales
       WHERE invoice_date >= ? AND invoice_date <= ? AND status != 'voided'
       GROUP BY payment_method`,
      [startStr, endStr]
    );
    return {
      period_days: days,
      total_transactions: summary?.count || 0,
      total_revenue: summary?.total || 0,
      avg_transaction: summary?.avg || 0,
      payment_methods: paymentMethods,
    };
  },

  // ── Accounting report (single period) ─────────────────────────
  // Replaces the JS-side buildDesktopAccountingReport() in api.ts
  getAccountingReport: (period: 'daily' | 'monthly' | 'annual') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yearStr  = String(now.getFullYear());
    const monthYm  = `${yearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let salesWhere: string;
    let salesParams: any[];
    let bucketExpr: string;
    let label: string;

    if (period === 'daily') {
      salesWhere  = `substr(s.invoice_date,1,10) = ? AND s.status != 'voided'`;
      salesParams = [todayStr];
      bucketExpr  = `substr(s.invoice_date,1,10)`;
      label       = 'Today';
    } else if (period === 'annual') {
      salesWhere  = `substr(s.invoice_date,1,4) = ? AND s.status != 'voided'`;
      salesParams = [yearStr];
      bucketExpr  = `substr(s.invoice_date,1,7)`;
      label       = 'This Year';
    } else {
      salesWhere  = `substr(s.invoice_date,1,7) = ? AND s.status != 'voided'`;
      salesParams = [monthYm];
      bucketExpr  = `substr(s.invoice_date,1,10)`;
      label       = 'This Month';
    }

    // One query: revenue + transaction count
    const summary = dbGet<{ transactions: number; revenue: number }>(
      `SELECT COUNT(*) as transactions, COALESCE(SUM(s.total), 0) as revenue
       FROM sales s WHERE ${salesWhere}`,
      salesParams
    ) || { transactions: 0, revenue: 0 };

    // COGS via JOIN — single pass
    const cogsRow = dbGet<{ cogs: number }>(
      `SELECT COALESCE(SUM(si.quantity * COALESCE(m.purchase_price, 0)), 0) as cogs
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN medicines m ON m.id = si.medicine_id
       WHERE ${salesWhere}`,
      salesParams
    ) || { cogs: 0 };

    // Expenses for the period
    let expWhere: string;
    let expParams: any[];
    if (period === 'daily') {
      expWhere  = `substr(date,1,10) = ?`;
      expParams = [todayStr];
    } else if (period === 'annual') {
      expWhere  = `substr(date,1,4) = ?`;
      expParams = [yearStr];
    } else {
      expWhere  = `substr(date,1,7) = ?`;
      expParams = [monthYm];
    }
    const expRow = dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${expWhere}`,
      expParams
    ) || { total: 0 };

    // Daily breakdown
    const breakdown = dbQuery<{ date: string; transactions: number; revenue: number; cogs: number }>(
      `SELECT ${bucketExpr} as date,
              COUNT(*) as transactions,
              COALESCE(SUM(s.total), 0) as revenue,
              COALESCE(SUM(si.quantity * COALESCE(m.purchase_price, 0)), 0) as cogs
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN medicines m ON m.id = si.medicine_id
       WHERE ${salesWhere}
       GROUP BY ${bucketExpr}
       ORDER BY ${bucketExpr}`,
      salesParams
    );

    const totalRevenue = summary.revenue;
    const totalCogs    = cogsRow.cogs;
    const totalExpenses = expRow.total;
    const grossProfit  = totalRevenue - totalCogs;
    const netProfit    = grossProfit - totalExpenses;

    return {
      label,
      total_revenue:         totalRevenue,
      total_transactions:    summary.transactions,
      total_cost_of_goods:   totalCogs,
      total_expenses:        totalExpenses,
      gross_profit:          grossProfit,
      gross_margin_percent:  totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      net_profit:            netProfit,
      daily_breakdown:       breakdown,
    };
  },

  // ── Accounting summary (all three periods at once) ─────────────
  getAccountingSummary: () => {
    const daily   = reportingDB.getAccountingReport('daily');
    const monthly = reportingDB.getAccountingReport('monthly');
    const annual  = reportingDB.getAccountingReport('annual');
    return {
      daily:   { revenue: daily.total_revenue,   profit: daily.net_profit,   transactions: daily.total_transactions },
      monthly: { revenue: monthly.total_revenue, profit: monthly.net_profit, transactions: monthly.total_transactions },
      annual:  { revenue: annual.total_revenue,  profit: annual.net_profit,  transactions: annual.total_transactions },
    };
  },

  // ── Daily sales trend (for analytics chart) ────────────────────
  getDailySalesTrend: (days: number = 30) => {
    const now = new Date();
    const endTs   = now.toISOString().split('T')[0] + ' 23:59:59';
    const start   = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    const startTs = start.toISOString().split('T')[0] + ' 00:00:00';

    const rows = dbQuery<{ date: string; revenue: number; transactions: number }>(
      `SELECT substr(invoice_date,1,10) as date,
              COALESCE(SUM(total), 0) as revenue,
              COUNT(*) as transactions
       FROM sales
       WHERE invoice_date >= ? AND invoice_date <= ? AND status != 'voided'
       GROUP BY substr(invoice_date,1,10)
       ORDER BY substr(invoice_date,1,10)`,
      [startTs, endTs]
    );
    return { results: rows, count: rows.length };
  },

  // ── Inventory valuation ────────────────────────────────────────
  getInventoryValuation: () => {
    const row = dbGet<{ total_items: number; total_value: number; low_stock_count: number }>(
      `SELECT
         COALESCE(SUM(quantity), 0)                              as total_items,
         COALESCE(SUM(quantity * selling_price), 0)             as total_value,
         COUNT(CASE WHEN quantity <= min_quantity THEN 1 END)   as low_stock_count
       FROM medicines WHERE status = 'active'`
    ) || { total_items: 0, total_value: 0, low_stock_count: 0 };
    return row;
  },
};

// ---- Prescriptions (Enhanced) ----------

export const prescriptionsDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery('SELECT * FROM prescriptions ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
  getById: (id: number) => dbGet('SELECT * FROM prescriptions WHERE id = ?', [id]),
  getItems: (prescriptionId: number) =>
    dbQuery('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescriptionId]),
  getPending: () =>
    dbQuery(`SELECT * FROM prescriptions WHERE status IN ('pending', 'partial') ORDER BY created_at DESC`),
  getByPatient: (patientPhone: string) =>
    dbQuery('SELECT * FROM prescriptions WHERE patient_phone = ? ORDER BY created_at DESC', [patientPhone]),
  getByDoctor: (doctorName: string) =>
    dbQuery('SELECT * FROM prescriptions WHERE doctor_name LIKE ? ORDER BY created_at DESC', [`%${doctorName}%`]),
  create: (
    rx: {
      prescription_no?: string;
      patient_name: string;
      patient_phone?: string;
      patient_age?: number;
      patient_gender?: string;
      doctor_name?: string;
      doctor_phone?: string;
      doctor_license?: string;
      notes?: string;
      created_by?: string;
    },
    items: { medicine_name: string; dosage?: string; quantity_prescribed?: number; frequency?: string; duration?: string; instructions?: string }[]
  ) => {
    return dbTransaction(() => {
      const result = dbRun(
        `INSERT INTO prescriptions (prescription_no, patient_name, patient_phone, patient_age, patient_gender, doctor_name, doctor_phone, doctor_license, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rx.prescription_no, rx.patient_name, rx.patient_phone, rx.patient_age, rx.patient_gender, rx.doctor_name, rx.doctor_phone, rx.doctor_license, rx.notes, rx.created_by]
      );
      const rxId = result.lastInsertRowid as number;
      for (const item of items) {
        dbRun(
          `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, quantity_prescribed, frequency, duration, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [rxId, item.medicine_name, item.dosage, item.quantity_prescribed, item.frequency, item.duration, item.instructions]
        );
      }
      auditLogDB.log({
        entity_type: 'prescription',
        entity_id: rxId,
        action: 'create',
        user: rx.created_by,
      });
      return rxId;
    });
  },
  updateStatus: (id: number, status: string, saleId?: number, updatedBy?: string) =>
    dbRun(
      `UPDATE prescriptions SET status = ?, sale_id = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, saleId ?? null, id]
    ),
};

// ---- Expenses / Accounting (Enhanced) ---

export const expensesDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery('SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
  getByCategory: (category: string, limit = 50) =>
    dbQuery('SELECT * FROM expenses WHERE category = ? ORDER BY date DESC LIMIT ?', [category, limit]),
  getByMonth: (year: number, month: number) =>
    // substr uses idx_expenses_ym covering index
    dbQuery(
      `SELECT * FROM expenses WHERE substr(date,1,7) = ? ORDER BY date DESC`,
      [`${String(year)}-${String(month).padStart(2, '0')}`]
    ),
  getByDateRange: (startDate: string, endDate: string) =>
    // Raw comparison uses idx_expenses_date_desc index
    dbQuery(
      `SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC`,
      [startDate, endDate]
    ),
  create: (e: {
    category: string;
    subcategory?: string;
    description: string;
    amount: number;
    date?: string;
    payment_method?: string;
    reference_no?: string;
    created_by?: string;
  }) =>
    dbRun(
      `INSERT INTO expenses (category, subcategory, description, amount, date, payment_method, reference_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.category,
        e.subcategory,
        e.description,
        e.amount,
        e.date ?? new Date().toISOString().slice(0, 10),
        e.payment_method,
        e.reference_no,
        e.created_by
      ]
    ),
  getTotalByMonth: (year: number, month: number) =>
    // substr(date,1,7) = 'YYYY-MM' can use idx_expenses_ym covering index
    dbGet<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE substr(date,1,7) = ?`,
      [`${String(year)}-${String(month).padStart(2, '0')}`]
    ),
  getCategoryBreakdown: (year: number, month: number) =>
    dbQuery<{ category: string; subcategory: string; total: number }>(
      `SELECT category, subcategory, COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE substr(date,1,7) = ?
       GROUP BY category, subcategory`,
      [`${String(year)}-${String(month).padStart(2, '0')}`]
    ),
};

// ---- Dues / Credit ----

export const duesDB = {
  getAll: (limit = 100, offset = 0) =>
    dbQuery('SELECT * FROM dues ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
  getById: (id: number) => dbGet('SELECT * FROM dues WHERE id = ?', [id]),
  getByCustomer: (customerId: number) =>
    dbQuery('SELECT * FROM dues WHERE customer_id = ? ORDER BY created_at DESC', [customerId]),
  getUnpaid: () =>
    dbQuery(`SELECT * FROM dues WHERE status IN ('unpaid', 'partial', 'overdue') ORDER BY created_at DESC`),
  create: (d: {
    customer_id: number;
    sale_id?: number;
    total_amount: number;
    amount_paid?: number;
    due_date?: string;
    notes?: string;
  }) => {
    const amountPaid = d.amount_paid ?? 0;
    const status = amountPaid >= d.total_amount ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';
    return dbRun(
      `INSERT INTO dues (customer_id, sale_id, total_amount, amount_paid, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.customer_id, d.sale_id ?? null, d.total_amount, amountPaid, d.due_date ?? null, status, d.notes ?? null]
    );
  },
  recordPayment: (id: number, amount: number) => {
    return dbTransaction(() => {
      const due = dbGet<any>('SELECT * FROM dues WHERE id = ?', [id]);
      if (!due) throw new Error('Due not found');
      const newPaid = due.amount_paid + amount;
      const newStatus = newPaid >= due.total_amount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
      return dbRun(
        `UPDATE dues SET amount_paid = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [newPaid, newStatus, id]
      );
    });
  },
};

// ── Analytics dashboard TTL cache ─────────────────────────────────────────
// Avoids re-running 7 sequential queries on every tab switch.
// Cache is invalidated whenever a sale, purchase, or medicine is written.
let _dashboardCache: { data: any; ts: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 30_000; // 30 seconds

export function getDashboardCached(buildFn: () => any): any {
  const now = Date.now();
  if (_dashboardCache && now - _dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) {
    return _dashboardCache.data;
  }
  const data = buildFn();
  _dashboardCache = { data, ts: now };
  return data;
}

export function invalidateDashboardCache(): void {
  _dashboardCache = null;
}

export const transactionsDB = {
  getHistoryStats: (search = '', typeFilter = 'all', dateFrom = '', dateTo = '') => {
    // Shared filtering logic
    let sWhere = "s.sale_type != 'return' AND s.invoice_no NOT LIKE 'RET-SRC-%'";
    let pWhere = "1=1";
    let rWhere = "1=1";
    const params: any[] = [];
    const pParams: any[] = [];
    const rParams: any[] = [];

    if (dateFrom) {
      const from = dateFrom + ' 00:00:00';
      sWhere += ` AND s.created_at >= ?`; params.push(from);
      pWhere += ` AND p.created_at >= ?`; pParams.push(from);
      rWhere += ` AND r.created_at >= ?`; rParams.push(from);
    }
    if (dateTo) {
      const to = dateTo + ' 23:59:59.999';
      sWhere += ` AND s.created_at <= ?`; params.push(to);
      pWhere += ` AND p.created_at <= ?`; pParams.push(to);
      rWhere += ` AND r.created_at <= ?`; rParams.push(to);
    }
    if (search) {
      const q = `%${search}%`;
      // For sales: search invoice_no, or items
      sWhere += ` AND (s.invoice_no LIKE ? OR EXISTS (SELECT 1 FROM sale_items si LEFT JOIN medicines m ON si.medicine_id = m.id WHERE si.sale_id = s.id AND (m.name LIKE ? OR m.manufacturer LIKE ?)))`;
      params.push(q, q, q);
      // For purchases: search invoice_no, supplier, or items
      pWhere += ` AND (p.invoice_no LIKE ? OR p.supplier_name LIKE ? OR EXISTS (SELECT 1 FROM purchase_items pi LEFT JOIN medicines m ON pi.medicine_id = m.id WHERE pi.purchase_id = p.id AND (m.name LIKE ? OR m.manufacturer LIKE ?)))`;
      pParams.push(q, q, q, q);
      // For returns: search invoice_no, reason
      rWhere += ` AND (r.return_invoice_no LIKE ? OR r.return_reason LIKE ?)`;
      rParams.push(q, q);
    }

    let totalSales = 0;
    let totalPurchases = 0;
    let totalRefunds = 0;
    let totalAmountSales = 0;
    let totalAmountPurchases = 0;
    let totalAmountRefunds = 0;

    if (typeFilter === 'all' || typeFilter === 'sale') {
      const row: any = dbGet(`SELECT COUNT(*) as c, SUM(total) as s FROM sales s WHERE ${sWhere}`, params);
      totalSales = row?.c || 0;
      totalAmountSales = row?.s || 0;
    }
    if (typeFilter === 'all' || typeFilter === 'purchase') {
      const row: any = dbGet(`SELECT COUNT(*) as c, SUM(total) as s FROM purchases p WHERE ${pWhere}`, pParams);
      totalPurchases = row?.c || 0;
      totalAmountPurchases = row?.s || 0;
    }
    if (typeFilter === 'all' || typeFilter === 'refund') {
      const row: any = dbGet(`SELECT COUNT(*) as c, SUM(refund_amount) as s FROM returns r WHERE ${rWhere}`, rParams);
      totalRefunds = row?.c || 0;
      totalAmountRefunds = row?.s || 0;
    }

    return {
      totalSales,
      totalPurchases,
      totalRefunds,
      totalAmount: totalAmountSales + totalAmountPurchases + totalAmountRefunds
    };
  },

  getHistory: (limit_raw = 200, offset_raw = 0, search = '', typeFilter = 'all', dateFrom = '', dateTo = '', sortOrder = 'desc') => {
    // CRITICAL: IPC params arrive as strings — coerce to integers so SQLite LIMIT/OFFSET work
    const limit = Number(limit_raw) || 200;
    const offset = Number(offset_raw) || 0;

    let sWhere = "s.sale_type != 'return' AND s.invoice_no NOT LIKE 'RET-SRC-%'";
    let pWhere = "1=1";
    let rWhere = "1=1";
    const params: any[] = [];
    const pParams: any[] = [];
    const rParams: any[] = [];

    if (dateFrom) {
      const from = dateFrom + ' 00:00:00';
      sWhere += ` AND s.created_at >= ?`; params.push(from);
      pWhere += ` AND p.created_at >= ?`; pParams.push(from);
      rWhere += ` AND r.created_at >= ?`; rParams.push(from);
    }
    if (dateTo) {
      const to = dateTo + ' 23:59:59.999';
      sWhere += ` AND s.created_at <= ?`; params.push(to);
      pWhere += ` AND p.created_at <= ?`; pParams.push(to);
      rWhere += ` AND r.created_at <= ?`; rParams.push(to);
    }
    if (search) {
      const q = `%${search}%`;
      sWhere += ` AND (s.invoice_no LIKE ? OR EXISTS (SELECT 1 FROM sale_items si LEFT JOIN medicines m ON si.medicine_id = m.id WHERE si.sale_id = s.id AND (m.name LIKE ? OR m.manufacturer LIKE ?)))`;
      params.push(q, q, q);
      pWhere += ` AND (p.invoice_no LIKE ? OR p.supplier_name LIKE ? OR EXISTS (SELECT 1 FROM purchase_items pi LEFT JOIN medicines m ON pi.medicine_id = m.id WHERE pi.purchase_id = p.id AND (m.name LIKE ? OR m.manufacturer LIKE ?)))`;
      pParams.push(q, q, q, q);
      rWhere += ` AND (r.return_invoice_no LIKE ? OR r.return_reason LIKE ?)`;
      rParams.push(q, q);
    }

    const queries: string[] = [];
    const unionParams: any[] = [];
    
    const orderClause = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const subLimit = limit + offset;

    if (typeFilter === 'all' || typeFilter === 'sale') {
      queries.push(`SELECT * FROM (SELECT s.id, 'sale' as type, s.created_at as date, s.total as amount, s.invoice_no, s.payment_method, s.customer_id, s.customer_name, NULL as supplier_name, NULL as reason, NULL as original_sale_id FROM sales s WHERE ${sWhere} ORDER BY s.created_at ${orderClause} LIMIT ${subLimit})`);
      unionParams.push(...params);
    }
    if (typeFilter === 'all' || typeFilter === 'purchase') {
      queries.push(`SELECT * FROM (SELECT p.id, 'purchase' as type, p.created_at as date, p.total as amount, p.invoice_no, p.payment_method, NULL as customer_id, NULL as customer_name, p.supplier_name, NULL as reason, NULL as original_sale_id FROM purchases p WHERE ${pWhere} ORDER BY p.created_at ${orderClause} LIMIT ${subLimit})`);
      unionParams.push(...pParams);
    }
    if (typeFilter === 'all' || typeFilter === 'refund') {
      queries.push(`SELECT * FROM (SELECT r.id, 'refund' as type, r.created_at as date, r.refund_amount as amount, r.return_invoice_no as invoice_no, NULL as payment_method, NULL as customer_id, NULL as customer_name, NULL as supplier_name, r.return_reason as reason, r.original_sale_id FROM returns r WHERE ${rWhere} ORDER BY r.created_at ${orderClause} LIMIT ${subLimit})`);
      unionParams.push(...rParams);
    }

    if (queries.length === 0) return [];

    // Inline LIMIT/OFFSET as integers directly into SQL to avoid string-param issues
    const finalQuery = `SELECT * FROM (${queries.join(' UNION ALL ')}) ORDER BY date ${orderClause} LIMIT ${limit} OFFSET ${offset}`;

    const rows = dbQuery(finalQuery, unionParams) as any[];

    // ---- Batch-fetch items in 3 queries instead of 200+ N+1 queries ----
    const saleIds = rows.filter(r => r.type === 'sale').map(r => r.id);
    const purchaseIds = rows.filter(r => r.type === 'purchase').map(r => r.id);
    const refundIds = rows.filter(r => r.type === 'refund').map(r => r.id);

    // Sale items — single batch query
    // ---- Fetch items (full fetch, no arbitrary caps) ----
    const saleItemsMap = new Map<number, any[]>();
    if (saleIds.length > 0) {
      const ph = saleIds.map(() => '?').join(',');
      const saleItems = dbQuery(
        `SELECT si.sale_id, si.medicine_id, si.medicine_name, m.name as m_name, m.manufacturer as brand_name, si.quantity as quantity_sold, si.unit_price 
         FROM sale_items si LEFT JOIN medicines m ON si.medicine_id = m.id 
         WHERE si.sale_id IN (${ph})`, saleIds
      ) as any[];
      for (const item of saleItems) {
        const arr = saleItemsMap.get(item.sale_id) || [];
        arr.push({
          medicine_id: item.medicine_id,
          medicine: { generic_name: item.m_name || item.medicine_name, brand_name: item.brand_name },
          quantity_sold: item.quantity_sold,
          unit_price: item.unit_price
        });
        saleItemsMap.set(item.sale_id, arr);
      }
    }

    const purchaseItemsMap = new Map<number, any[]>();
    if (purchaseIds.length > 0) {
      const ph = purchaseIds.map(() => '?').join(',');
      const purchaseItems = dbQuery(
        `SELECT pi.purchase_id, pi.medicine_id, pi.medicine_name, m.name as m_name, m.manufacturer as brand_name, pi.quantity as quantity_purchased, pi.unit_price as cost_per_unit 
         FROM purchase_items pi LEFT JOIN medicines m ON pi.medicine_id = m.id 
         WHERE pi.purchase_id IN (${ph})`, purchaseIds
      ) as any[];
      for (const item of purchaseItems) {
        const arr = purchaseItemsMap.get(item.purchase_id) || [];
        arr.push({
          medicine_id: item.medicine_id,
          medicine: { generic_name: item.m_name || item.medicine_name, brand_name: item.brand_name },
          quantity_purchased: item.quantity_purchased,
          cost_per_unit: item.cost_per_unit
        });
        purchaseItemsMap.set(item.purchase_id, arr);
      }
    }

    // Refund items — usually small, fetch all
    const refundItemsMap = new Map<number, any[]>();
    if (refundIds.length > 0) {
      const placeholders = refundIds.map(() => '?').join(',');
      const refundRows = dbQuery(
        `SELECT id, items_json FROM returns WHERE id IN (${placeholders})`, refundIds
      ) as any[];
      for (const rRow of refundRows) {
        try {
          refundItemsMap.set(rRow.id, rRow.items_json ? JSON.parse(rRow.items_json) : []);
        } catch {
          refundItemsMap.set(rRow.id, []);
        }
      }
    }

    // Attach items to rows
    for (const row of rows) {
      if (row.type === 'sale') {
        row.items = saleItemsMap.get(row.id) || [];
      } else if (row.type === 'purchase') {
        row.items = purchaseItemsMap.get(row.id) || [];
      } else if (row.type === 'refund') {
        row.items = refundItemsMap.get(row.id) || [];
      }
    }

    return rows;
  }
};
