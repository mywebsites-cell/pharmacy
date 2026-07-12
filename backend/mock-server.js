// Quick mock backend API for pharmacy app
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;
const SECRET_KEY = 'super-secret-key-12345';

// CORS configuration
const corsOptions = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// ============ Per-user data store ============
// Each user gets their own isolated data. Users list is shared (for auth only).
const mockData = {
  users: [
    { id: 1, username: 'admin', password: 'admin123', email: 'admin@pharmacy.com', role: 'admin', first_name: 'Admin', last_name: 'User' },
    { id: 2, username: 'ahmad', password: 'Ahmad@123', email: 'ahmadafridi979@gmail.com', role: 'staff', first_name: 'Ahmad', last_name: 'Afridi' }
  ]
};

// Temporary OTP stores for mock auth flows
const pendingRegistrationOtps = {};
const passwordResetOtps = {};

const normalize = (value) => String(value || '').trim().toLowerCase();
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const userExistsByUsername = (username) => {
  const usernameNorm = normalize(username);
  return mockData.users.some((u) => normalize(u.username) === usernameNorm);
};

const userExistsByEmail = (email) => {
  const emailNorm = normalize(email);
  return mockData.users.some((u) => normalize(u.email) === emailNorm);
};

// Seed data for the admin user (id: 1)
// Helper: returns an ISO date string N days before today
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const isoAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
};

const userDataStore = {
  1: {
    medicines: [
      { id: 1, generic_name: 'Aspirin', brand_name: 'Bayer', dosage_form: 'Tablet', strength: '500mg', quantity_on_hand: 100, purchase_price: 30, selling_price: 50, reorder_level: 20, category: 'Painkillers', barcode: '8901234567001', manufacturing_date: '2025-01-15', expiry_date: '2027-01-15' },
      { id: 2, generic_name: 'Paracetamol', brand_name: 'Crocin', dosage_form: 'Tablet', strength: '650mg', quantity_on_hand: 150, purchase_price: 25, selling_price: 40, reorder_level: 30, category: 'Painkillers', barcode: '8901234567002', manufacturing_date: '2025-02-10', expiry_date: '2027-02-10' },
      { id: 3, generic_name: 'Ibuprofen', brand_name: 'Brufen', dosage_form: 'Tablet', strength: '400mg', quantity_on_hand: 80, purchase_price: 40, selling_price: 60, reorder_level: 25, category: 'Painkillers', barcode: '8901234567003', manufacturing_date: '2025-01-20', expiry_date: '2027-01-20' },
      { id: 4, generic_name: 'Amoxicillin', brand_name: 'Amoxyl', dosage_form: 'Capsule', strength: '500mg', quantity_on_hand: 50, purchase_price: 120, selling_price: 200, reorder_level: 15, category: 'Antibiotics', barcode: '8901234567004', manufacturing_date: '2024-12-01', expiry_date: '2026-12-01' },
      { id: 5, generic_name: 'Metformin', brand_name: 'Glucomet', dosage_form: 'Tablet', strength: '500mg', quantity_on_hand: 200, purchase_price: 90, selling_price: 150, reorder_level: 40, category: 'Diabetes', barcode: '8901234567005', manufacturing_date: '2025-01-05', expiry_date: '2027-01-05' },
      { id: 6, generic_name: 'Atorvastatin', brand_name: 'Lipitor', dosage_form: 'Tablet', strength: '10mg', quantity_on_hand: 75, purchase_price: 180, selling_price: 300, reorder_level: 20, category: 'Cardiac', barcode: '8901234567006', manufacturing_date: '2025-01-10', expiry_date: '2027-01-10' },
    ],
    sales: [
      { id: 1, date: daysAgo(0), created_at: isoAgo(0), payment_method: 'cash', total_before_tax: 450, tax_amount: 50, total_amount: 500, items: [{ medicine: 1, quantity_sold: 5, unit_price: 50, purchase_price: 30 }, { medicine: 2, quantity_sold: 3, unit_price: 40, purchase_price: 25 }] },
      { id: 2, date: daysAgo(1), created_at: isoAgo(1), payment_method: 'card', total_before_tax: 720, tax_amount: 80, total_amount: 800, items: [{ medicine: 3, quantity_sold: 4, unit_price: 60, purchase_price: 40 }, { medicine: 4, quantity_sold: 2, unit_price: 200, purchase_price: 120 }] },
      { id: 3, date: daysAgo(2), created_at: isoAgo(2), payment_method: 'cash', total_before_tax: 540, tax_amount: 60, total_amount: 600, items: [{ medicine: 5, quantity_sold: 2, unit_price: 150, purchase_price: 90 }, { medicine: 6, quantity_sold: 1, unit_price: 300, purchase_price: 180 }] },
      { id: 4, date: daysAgo(5), created_at: isoAgo(5), payment_method: 'cash', total_before_tax: 360, tax_amount: 40, total_amount: 400, items: [{ medicine: 1, quantity_sold: 4, unit_price: 50, purchase_price: 30 }, { medicine: 2, quantity_sold: 2, unit_price: 40, purchase_price: 25 }] },
      { id: 5, date: daysAgo(10), created_at: isoAgo(10), payment_method: 'card', total_before_tax: 630, tax_amount: 70, total_amount: 700, items: [{ medicine: 4, quantity_sold: 3, unit_price: 200, purchase_price: 120 }] },
      { id: 6, date: daysAgo(20), created_at: isoAgo(20), payment_method: 'cash', total_before_tax: 900, tax_amount: 100, total_amount: 1000, items: [{ medicine: 5, quantity_sold: 4, unit_price: 150, purchase_price: 90 }, { medicine: 6, quantity_sold: 1, unit_price: 300, purchase_price: 180 }] },
    ],
    customers: [
      { id: 1, first_name: 'John', last_name: 'Doe', name: 'John Doe', phone: '9876543210', email: 'john@example.com', loyalty_balance: 100, outstanding_balance: 0, is_vip: false, loyalty_points: 100 },
      { id: 2, first_name: 'Jane', last_name: 'Smith', name: 'Jane Smith', phone: '9876543211', email: 'jane@example.com', loyalty_balance: 250, outstanding_balance: 500, is_vip: true, loyalty_points: 250 },
    ],
    dues: [
      { id: 1, customer_id: 2, customer_name: 'Jane Smith', customer_phone: '9876543211', sale_id: 2, date: daysAgo(1), created_at: isoAgo(1), total_amount: 800, amount_paid: 300, balance: 500, status: 'partial', notes: 'Paid Rs 300 on pickup', payments: [{ id: 1, amount: 300, date: daysAgo(1), method: 'cash', note: 'Partial payment at pickup' }] },
    ],
    purchases: [
      { id: 1, date: daysAgo(0), created_at: isoAgo(0), supplier_name: 'Cipla Limited', items: [{ medicine_id: 1, quantity: 100, unit_cost: 30, line_total: 3000 }], total_cost: 3000, status: 'completed' },
      { id: 2, date: daysAgo(3), created_at: isoAgo(3), supplier_name: 'Sun Pharma', items: [{ medicine_id: 3, quantity: 80, unit_cost: 40, line_total: 3200 }, { medicine_id: 4, quantity: 50, unit_cost: 120, line_total: 6000 }], total_cost: 9200, status: 'completed' },
      { id: 3, date: daysAgo(7), created_at: isoAgo(7), supplier_name: 'Abbott', items: [{ medicine_id: 5, quantity: 200, unit_cost: 90, line_total: 18000 }], total_cost: 18000, status: 'completed' },
      { id: 4, date: daysAgo(15), created_at: isoAgo(15), supplier_name: 'Lupin', items: [{ medicine_id: 2, quantity: 150, unit_cost: 25, line_total: 3750 }, { medicine_id: 6, quantity: 75, unit_cost: 180, line_total: 13500 }], total_cost: 17250, status: 'completed' },
    ],
    refunds: [
      { id: 1, date: daysAgo(2), created_at: isoAgo(2), sale_id: 2, reason: 'Product damage', medicine_id: 3, quantity: 1, unit_price: 60, total_amount: 60, status: 'completed' },
      { id: 2, date: daysAgo(8), created_at: isoAgo(8), sale_id: 5, reason: 'Expired product', medicine_id: 4, quantity: 1, unit_price: 200, total_amount: 200, status: 'completed' },
    ]
  }
};

// Returns the data bucket for the authenticated user, creating a fresh one if first login.
function getUserData(userId) {
  if (!userDataStore[userId]) {
    userDataStore[userId] = {
      medicines: [],
      sales: [],
      customers: [],
      dues: [],
      refunds: [],
      purchases: []
    };
  }
  return userDataStore[userId];
}

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ detail: 'Invalid token.' });
  }
};

// Seed empty data store for ahmad (id: 2)
userDataStore[2] = { medicines: [], sales: [], customers: [], dues: [] };

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required.' });
  next();
};

// ============ Activity Log (for audit trail) ============
const activityLog = [];

function logActivity(userId, action, details = {}) {
  activityLog.push({
    id: activityLog.length + 1,
    timestamp: new Date().toISOString(),
    user_id: userId,
    action,
    details
  });
  // Keep only last 1000 logs
  if (activityLog.length > 1000) activityLog.shift();
}

// ============ Authentication ============
app.post('/api/v1/auth/login/', (req, res) => {
  const { username, password } = req.body;
  const identifier = String(username || '').trim().toLowerCase();
  const user = mockData.users.find(u =>
    (String(u.username || '').toLowerCase() === identifier || String(u.email || '').toLowerCase() === identifier) && u.password === password
  );
  
  if (user) {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    logActivity(user.id, 'login', { username });
    res.json({
      access: token,
      refresh: token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } else {
    res.status(401).json({ detail: 'Invalid credentials.' });
  }
});

app.post('/api/v1/auth/logout/', authenticate, (req, res) => {
  res.json({ detail: 'Successfully logged out.' });
});

// ============ Desktop App Login (Electron) ============
// Compatible with the license server response format expected by dist-electron/main.js
app.post('/api/auth/login', (req, res) => {
  const { email, password, username: bodyUsername } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedUsername = String(bodyUsername || '').trim().toLowerCase();
  // Accept login by email or username
  const user = mockData.users.find(u =>
    (normalizedEmail && (String(u.email || '').toLowerCase() === normalizedEmail || String(u.username || '').toLowerCase() === normalizedEmail)) ||
    (normalizedUsername && String(u.username || '').toLowerCase() === normalizedUsername)
  );
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ADMIN_FEATURES = {
    max_medicines: null, max_customers: null,
    has_pos: true, has_inventory: true, has_transaction_history: true,
    has_dues: true, has_customer_management: true, has_analytics: true,
    has_accounting: true, has_purchase_management: true, has_prescriptions: true,
    has_desktop_app: true, has_api_access: true, has_multi_branch: true,
  };
  // Admin always has desktop access
  if (user.role === 'admin') {
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    return res.json({
      access_token: token,
      refresh_token: token,
      user: { id: user.id, email: user.email || '', name: (user.first_name + ' ' + user.last_name).trim() || user.username, role: user.role, license_type: 'LIFETIME' },
      features: ADMIN_FEATURES,
      license: {
        user_id: user.id, device_id: 0, email: user.email || '', name: user.username,
        role: user.role, license_type: 'LIFETIME',
        expires_at: null, issued_at: new Date().toISOString(), last_validation: new Date().toISOString(),
      },
    });
  }
  // Check plan has desktop access
  const sub = userSubscriptions[user.id];
  const plan = sub ? subscriptionPlans.find(p => p.id === sub.plan_id) : null;
  if (!plan || !plan.features_config?.has_desktop_app) {
    return res.status(403).json({
      error: 'Your current plan does not include Desktop App access. Please upgrade to Enterprise plan.',
      code: 'NO_DESKTOP_ACCESS',
    });
  }
  // Check subscription is still active
  const now = new Date();
  if (!sub || sub.status !== 'active' || (sub.expires_at && new Date(sub.expires_at) < now)) {
    return res.status(403).json({
      error: 'Your subscription has expired. Please renew to use the desktop app.',
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
  return res.json({
    access_token: token,
    refresh_token: token,
    user: { id: user.id, email: user.email || '', name: (user.first_name + ' ' + user.last_name).trim() || user.username, role: user.role, license_type: 'MONTHLY' },
    features: plan.features_config,
    license: {
      user_id: user.id, device_id: user.id, email: user.email || '', name: user.username,
      role: user.role, license_type: 'MONTHLY',
      expires_at: sub.expires_at, issued_at: sub.approved_at || new Date().toISOString(),
      last_validation: new Date().toISOString(),
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

app.post('/api/v1/auth/register/send-otp/', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ detail: 'Username, email and password are required.' });
  }

  if (userExistsByUsername(username)) {
    return res.status(400).json({ detail: 'Username already exists.' });
  }
  if (userExistsByEmail(email)) {
    return res.status(400).json({ detail: 'Email already registered.' });
  }

  const emailNorm = normalize(email);
  const otp = generateOtp();
  pendingRegistrationOtps[emailNorm] = {
    username,
    email,
    password,
    pharmacy_name: req.body.pharmacy_name || '',
    otp,
    createdAt: Date.now(),
  };

  // Mock mode: print OTP to backend console for testing.
  console.log(`[OTP][REGISTER] ${emailNorm}: ${otp}`);
  return res.json({ detail: 'Verification code sent successfully.' });
});

app.post('/api/v1/auth/register/', (req, res) => {
  const { username, email, password, first_name, last_name, otp } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ detail: 'Username, email and password are required.' });
  }

  if (userExistsByUsername(username)) {
    return res.status(400).json({ detail: 'Username already exists.' });
  }
  if (userExistsByEmail(email)) {
    return res.status(400).json({ detail: 'Email already registered.' });
  }

  const emailNorm = normalize(email);
  const pendingOtp = pendingRegistrationOtps[emailNorm];
  if (pendingOtp) {
    if (!otp) {
      return res.status(400).json({ detail: 'Verification code is required.' });
    }
    if (String(otp).trim() !== String(pendingOtp.otp)) {
      return res.status(400).json({ detail: 'Invalid verification code.' });
    }
    if (normalize(pendingOtp.username) !== normalize(username)) {
      return res.status(400).json({ detail: 'Username does not match verification request.' });
    }
  }

  const newUser = { id: mockData.users.length + 1, username, email, password, first_name: first_name || '', last_name: last_name || '', role: 'staff' };
  mockData.users.push(newUser);
  delete pendingRegistrationOtps[emailNorm];

  const token = jwt.sign({ id: newUser.id, username: newUser.username }, SECRET_KEY, { expiresIn: '24h' });
  res.status(201).json({
    access: token,
    refresh: token,
    user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }
  });
});

app.post('/api/v1/auth/password-reset/send-otp/', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ detail: 'Email is required.' });
  }

  const emailNorm = normalize(email);
  const user = mockData.users.find((u) => normalize(u.email) === emailNorm);
  if (!user) {
    return res.status(404).json({ detail: 'No account found with this email.' });
  }

  const otp = generateOtp();
  passwordResetOtps[emailNorm] = {
    otp,
    createdAt: Date.now(),
  };

  // Mock mode: print OTP to backend console for testing.
  console.log(`[OTP][PASSWORD_RESET] ${emailNorm}: ${otp}`);
  return res.json({ detail: 'Reset verification code sent successfully.' });
});

app.post('/api/v1/auth/password-reset/confirm-reset-otp/', (req, res) => {
  const { email, otp, new_password, confirm_password } = req.body;
  if (!email || !otp || !new_password || !confirm_password) {
    return res.status(400).json({ detail: 'Email, otp, and passwords are required.' });
  }
  if (new_password !== confirm_password) {
    return res.status(400).json({ detail: 'Passwords do not match.' });
  }

  const emailNorm = normalize(email);
  const pendingOtp = passwordResetOtps[emailNorm];
  if (!pendingOtp) {
    return res.status(400).json({ detail: 'No reset request found. Request a new code.' });
  }
  if (String(otp).trim() !== String(pendingOtp.otp)) {
    return res.status(400).json({ detail: 'Invalid verification code.' });
  }

  const user = mockData.users.find((u) => normalize(u.email) === emailNorm);
  if (!user) {
    return res.status(404).json({ detail: 'No account found with this email.' });
  }

  user.password = new_password;
  delete passwordResetOtps[emailNorm];
  return res.json({ detail: 'Password reset successfully.' });
});

// ============ Medicines ============
const medicineHandler = {
  getAll: (req, res) => {
    const ud = getUserData(req.user.id);
    let results = [...ud.medicines];
    const search = req.query.search || req.query.q;
    if (search) {
      results = results.filter(m =>
        m.generic_name.toLowerCase().includes(search.toLowerCase()) ||
        m.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.barcode && m.barcode.includes(search))
      );
    }
    res.json({ count: results.length, results });
  },
  getOne: (req, res) => {
    const ud = getUserData(req.user.id);
    const medicine = ud.medicines.find(m => m.id === Number(req.params.id));
    if (medicine) res.json(medicine);
    else res.status(404).json({ detail: 'Not found.' });
  },
  create: (req, res) => {
    const ud = getUserData(req.user.id);
    if (!req.body.manufacturing_date) return res.status(400).json({ detail: 'manufacturing_date is required.' });
    if (!req.body.expiry_date) return res.status(400).json({ detail: 'expiry_date is required.' });
    // Enforce plan medicine limit (skip for admin)
    if (req.user.role !== 'admin') {
      const sub = userSubscriptions[req.user.id];
      const plan = sub ? subscriptionPlans.find(p => p.id === sub.plan_id) : null;
      const maxMeds = plan?.features_config?.max_medicines;
      if (maxMeds !== null && maxMeds !== undefined && ud.medicines.length >= maxMeds) {
        return res.status(403).json({ detail: `Your plan allows a maximum of ${maxMeds} medicines. Please upgrade to add more.`, limit_reached: true, limit: maxMeds });
      }
    }
    const existing = ud.medicines.find(m =>
      m.generic_name && req.body.generic_name &&
      m.generic_name.toLowerCase() === req.body.generic_name.toLowerCase() &&
      (m.brand_name || '').toLowerCase() === (req.body.brand_name || '').toLowerCase()
    );
    if (existing) {
      // SET the quantity to exactly what the user typed — don't accumulate on top.
      // Accumulation only makes sense for bulk import (separate endpoint).
      const newQty = parseFloat(req.body.quantity_on_hand) || 0;
      existing.quantity_on_hand = newQty;
      Object.assign(existing, req.body);
      return res.status(200).json(existing);
    }
    const medicine = { id: Date.now(), quantity_on_hand: 0, reorder_level: 10, ...req.body };
    ud.medicines.push(medicine);
    // Stock is already set correctly from req.body via spread.
    // Do NOT create a purchase record here to avoid stock doubling.
    res.status(201).json(medicine);
  },
  update: (req, res) => {
    const ud = getUserData(req.user.id);
    const reqId = Number(req.params.id);
    const idx = ud.medicines.findIndex(m => m.id === reqId);
    if (idx === -1) return res.status(404).json({ detail: 'Not found.' });
    // Directly update the medicine fields including quantity_on_hand.
    // The frontend's autoPurchase call creates an audit purchase record,
    // but the purchases handler skips stock adjustment for 'Inventory Addition'
    // to prevent doubling. No need to create a purchase record here.
    ud.medicines[idx] = { ...ud.medicines[idx], ...req.body };
    res.json(ud.medicines[idx]);
  },
  remove: (req, res) => {
    const ud = getUserData(req.user.id);
    const reqId = Number(req.params.id);
    const idx = ud.medicines.findIndex(m => m.id === reqId);
    if (idx === -1) return res.status(404).json({ detail: 'Not found.' });
    ud.medicines.splice(idx, 1);
    res.status(204).send();
  }
};

// Both route patterns
app.get('/api/v1/medicines/', authenticate, medicineHandler.getAll);
app.get('/api/v1/medicines/:id/', authenticate, medicineHandler.getOne);
app.post('/api/v1/medicines/', authenticate, medicineHandler.create);
app.put('/api/v1/medicines/:id/', authenticate, medicineHandler.update);
app.patch('/api/v1/medicines/:id/', authenticate, medicineHandler.update);
app.delete('/api/v1/medicines/:id/', authenticate, medicineHandler.remove);

// Auto-incrementing integer counter for bulk-imported medicine IDs
let bulkMedicineIdBase = Date.now();
const nextBulkId = () => ++bulkMedicineIdBase;

app.post('/api/v1/inventory/medicines/bulk/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ detail: 'items array is required.' });
  }
  
  // For large imports (10k+), log progress
  const startTime = Date.now();
  const isLarge = items.length >= 1000;
  if (isLarge) console.log(`[Bulk Import] Processing ${items.length} items...`);
  
  let createdCount = 0, updatedCount = 0, failedCount = 0;
  const results = [];
  const errors = [];
  
  // Build lookup map for O(1) existing medicine checks (optimization for large datasets)
  const existingMap = new Map();
  ud.medicines.forEach(m => {
    if (m.generic_name) {
      const key = `${m.generic_name.toLowerCase()}|${(m.brand_name || '').toLowerCase()}`;
      existingMap.set(key, m);
    }
  });
  
  items.forEach((item, index) => {
    try {
      if (!item.generic_name) {
        errors.push({ index, error: 'generic_name required' });
        failedCount++;
        return;
      }
      
      const key = `${item.generic_name.toLowerCase()}|${(item.brand_name || '').toLowerCase()}`;
      const existing = existingMap.get(key);
      
      if (existing) {
        // UPDATE existing medicine: add the new quantity on top of existing stock
        const addQty = parseFloat(item.quantity_on_hand) || 0;
        existing.quantity_on_hand = (parseFloat(existing.quantity_on_hand) || 0) + addQty;
        const { quantity_on_hand, ...rest } = item;
        Object.assign(existing, rest);
        updatedCount++;
        results.push(existing);
      } else {
        // CREATE new medicine
        const medicine = { id: nextBulkId(), quantity_on_hand: 0, reorder_level: 10, ...item };
        ud.medicines.push(medicine);
        existingMap.set(key, medicine); // Add to map for subsequent items
        createdCount++;
        results.push(medicine);
      }
      
      // Progress logging for large imports
      if (isLarge && (index + 1) % 1000 === 0) {
        console.log(`  Processed ${index + 1}/${items.length} items...`);
      }
    } catch (err) {
      errors.push({ index, error: err.message });
      failedCount++;
    }
  });
  
  if (isLarge) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Bulk Import] Complete: ${createdCount} created, ${updatedCount} updated, ${failedCount} failed in ${elapsed}s`);
  }
  
  res.status(201).json({ 
    created: createdCount, 
    updated: updatedCount, 
    failed: failedCount,
    total: items.length,
    errors: errors.length > 0 ? errors.slice(0, 100) : undefined, // Return first 100 errors
    results: results.slice(0, 1000) // Return first 1000 results to avoid huge response
  });
});

app.get('/api/v1/inventory/medicines/', authenticate, medicineHandler.getAll);
app.get('/api/v1/inventory/medicines/:id/', authenticate, medicineHandler.getOne);
app.post('/api/v1/inventory/medicines/', authenticate, medicineHandler.create);
app.put('/api/v1/inventory/medicines/:id/', authenticate, medicineHandler.update);
app.patch('/api/v1/inventory/medicines/:id/', authenticate, medicineHandler.update);
app.delete('/api/v1/inventory/medicines/:id/', authenticate, medicineHandler.remove);

// ============ Sales ============
const saleHandler = {
  getAll: (req, res) => {
    const ud = getUserData(req.user.id);
    const enrichedSales = ud.sales
      .filter(sale => !sale.is_due)
      .map(sale => ({
        ...sale,
        items: (sale.items || []).map(item => ({
          ...item,
          medicine: ud.medicines.find(m => m.id === Number(item.medicine)) || { id: item.medicine, generic_name: 'Unknown' }
        }))
      }));
    res.json({ count: enrichedSales.length, results: enrichedSales });
  },
  create: (req, res) => {
    const ud = getUserData(req.user.id);
    const { items = [], total_before_tax = 0, tax_amount = 0, payment_method = 'cash', customer, is_due = false } = req.body;
    const enrichedItems = items.map(item => {
      const medicine = ud.medicines.find(m => m.id === Number(item.medicine));
      if (medicine) {
        const qty = parseInt(item.quantity_sold) || 0;
        medicine.quantity_on_hand = Math.max(0, (parseFloat(medicine.quantity_on_hand) || 0) - qty);
        return { ...item, purchase_price: medicine.purchase_price };
      }
      return item;
    });
    const calculatedTotal = enrichedItems.reduce((sum, i) => sum + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity_sold) || 0), 0);
    const total_amount = parseFloat(total_before_tax) + parseFloat(tax_amount) || calculatedTotal;
    const sale = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      payment_method,
      total_before_tax: parseFloat(total_before_tax) || calculatedTotal,
      tax_amount: parseFloat(tax_amount) || 0,
      total_amount,
      customer: customer || null,
      is_due: !!is_due,
      items: enrichedItems
    };
    ud.sales.push(sale);
    res.status(201).json(sale);
  }
};

app.get('/api/v1/sales/', authenticate, saleHandler.getAll);
app.post('/api/v1/sales/', authenticate, saleHandler.create);
app.get('/api/v1/sales/sales/', authenticate, saleHandler.getAll);
app.post('/api/v1/sales/sales/', authenticate, saleHandler.create);
app.post('/api/v1/sales/sales/create_sale/', authenticate, saleHandler.create);

// ============ Refunds ============
app.get('/api/v1/refunds/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const enrichedRefunds = ud.refunds.map(refund => ({
    ...refund,
    items: (refund.items || []).map(item => ({
      ...item,
      medicine: ud.medicines.find(m => m.id === Number(item.medicine)) || { id: item.medicine, generic_name: 'Unknown' }
    }))
  }));
  res.json({ count: enrichedRefunds.length, results: enrichedRefunds });
});

app.post('/api/v1/refunds/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const { sale_id, items = [], reason = '', total_amount = 0 } = req.body;

  if (sale_id) {
    const originalSale = ud.sales.find(s => s.id === parseInt(sale_id));
    if (!originalSale) return res.status(404).json({ detail: 'Sale not found.' });
  }

  const enrichedItems = items.map(item => {
    const medicine = ud.medicines.find(m => m.id === Number(item.medicine));
    if (medicine) {
      const qty = parseInt(item.quantity_returned || item.quantity || 0);
      medicine.quantity_on_hand = (parseFloat(medicine.quantity_on_hand) || 0) + qty;
      return { ...item, quantity: qty };
    }
    return item;
  });

  const refund = {
    id: Date.now(),
    sale_id: sale_id ? parseInt(sale_id) : null,
    date: new Date().toISOString().split('T')[0],
    reason: reason || 'Customer return',
    total_amount: parseFloat(total_amount) || 0,
    items: enrichedItems,
    created_at: new Date().toISOString()
  };

  ud.refunds.push(refund);
  res.status(201).json(refund);
});

// ============ Purchases (Stock Replenishment) ============
app.get('/api/v1/purchases/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const enrichedPurchases = ud.purchases.map(purchase => ({
    ...purchase,
    items: (purchase.items || []).map(item => {
      const medId = Number(item.medicine || item.medicine_id);
      const med = ud.medicines.find(m => m.id === medId);
      return {
        ...item,
        medicine: med || { id: medId, generic_name: 'Unknown' },
        medicine_id: medId,
        unit_price: item.unit_price ?? item.unit_cost ?? 0,
        quantity_purchased: item.quantity_purchased ?? item.quantity ?? 0
      };
    })
  }));
  res.json({ count: enrichedPurchases.length, results: enrichedPurchases });
});

app.post('/api/v1/purchases/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const { items = [], supplier_name = '', total_cost = 0, notes = '' } = req.body;

  const enrichedItems = items.map(item => {
    const medicine = ud.medicines.find(m => m.id === Number(item.medicine));
    if (medicine) {
      const qty = parseInt(item.quantity_purchased) || 0;
      const supplierTrimmed = (supplier_name || '').trim();
      // Only increment stock for REAL supplier purchases.
      // 'Inventory Addition' purchases are just audit records —
      // the stock was already set when the medicine was created or updated.
      if (supplierTrimmed !== 'Inventory Addition') {
        medicine.quantity_on_hand = (parseFloat(medicine.quantity_on_hand) || 0) + qty;
      }
      return item;
    }
    return item;
  });

  const purchase = {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    supplier_name: supplier_name || 'Supplier',
    total_cost: parseFloat(total_cost) || 0,
    notes: notes || '',
    items: enrichedItems,
    created_at: new Date().toISOString()
  };

  ud.purchases.push(purchase);
  res.status(201).json(purchase);
});

// ============ Customers ============
const customerHandler = {
  getAll: (req, res) => {
    const ud = getUserData(req.user.id);
    let results = [...ud.customers];
    const search = req.query.search;
    if (search) {
      results = results.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.first_name && c.first_name.toLowerCase().includes(search.toLowerCase())) ||
        c.phone.includes(search)
      );
    }
    res.json({ count: results.length, results });
  },
  create: (req, res) => {
    const ud = getUserData(req.user.id);
    // Enforce plan customer limit (skip for admin)
    if (req.user.role !== 'admin') {
      const sub = userSubscriptions[req.user.id];
      const plan = sub ? subscriptionPlans.find(p => p.id === sub.plan_id) : null;
      const maxCust = plan?.features_config?.max_customers;
      if (maxCust !== null && maxCust !== undefined && ud.customers.length >= maxCust) {
        return res.status(403).json({ detail: `Your plan allows a maximum of ${maxCust} customers. Please upgrade to add more.`, limit_reached: true, limit: maxCust });
      }
    }
    const customer = { id: Date.now(), loyalty_balance: 0, outstanding_balance: 0, is_vip: false, loyalty_points: 0, ...req.body };
    ud.customers.push(customer);
    res.status(201).json(customer);
  }
};

app.get('/api/v1/customers/', authenticate, customerHandler.getAll);
app.post('/api/v1/customers/', authenticate, customerHandler.create);
app.get('/api/v1/customers/customers/', authenticate, customerHandler.getAll);
app.post('/api/v1/customers/customers/', authenticate, customerHandler.create);
app.get('/api/v1/customers/customers/:id/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const customer = ud.customers.find(c => c.id === parseInt(req.params.id));
  if (!customer) return res.status(404).json({ detail: 'Not found.' });
  res.json(customer);
});
app.post('/api/v1/customers/customers/:id/add_loyalty_points/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const customer = ud.customers.find(c => c.id === parseInt(req.params.id));
  if (!customer) return res.status(404).json({ detail: 'Not found.' });
  customer.loyalty_balance = (customer.loyalty_balance || 0) + parseFloat(req.body.points || 0);
  customer.loyalty_points = customer.loyalty_balance;
  res.json(customer);
});

// ============ Dues ============
app.get('/api/v1/dues/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  let results = [...ud.dues];
  const { customer_id, status } = req.query;
  if (customer_id) results = results.filter(d => d.customer_id === parseInt(customer_id));
  if (status) results = results.filter(d => d.status === status);
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const totalOutstanding = results.filter(d => d.status !== 'paid').reduce((s, d) => s + d.balance, 0);
  res.json({ count: results.length, results, total_outstanding: totalOutstanding });
});

app.get('/api/v1/dues/:id/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const due = ud.dues.find(d => d.id === parseInt(req.params.id));
  if (!due) return res.status(404).json({ detail: 'Not found.' });
  res.json(due);
});

app.post('/api/v1/dues/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const { customer_id, sale_id, total_amount, amount_paid = 0, notes = '' } = req.body;
  const customer = ud.customers.find(c => c.id === parseInt(customer_id));
  if (!customer) return res.status(404).json({ detail: 'Customer not found.' });
  const paid = parseFloat(amount_paid) || 0;
  const total = parseFloat(total_amount) || 0;
  const balance = total - paid;
  const status = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
  const due = {
    id: Date.now(),
    customer_id: parseInt(customer_id),
    customer_name: customer.name || `${customer.first_name} ${customer.last_name}`,
    customer_phone: customer.phone,
    sale_id: sale_id ? parseInt(sale_id) : null,
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    total_amount: total,
    amount_paid: paid,
    balance: Math.max(0, balance),
    status,
    notes,
    payments: paid > 0 ? [{ id: Date.now() + 1, amount: paid, date: new Date().toISOString().split('T')[0], method: req.body.payment_method || 'cash', note: 'Initial payment' }] : []
  };
  customer.outstanding_balance = (parseFloat(customer.outstanding_balance) || 0) + due.balance;
  ud.dues.push(due);
  res.status(201).json(due);
});

app.post('/api/v1/dues/:id/pay/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const due = ud.dues.find(d => d.id === parseInt(req.params.id));
  if (!due) return res.status(404).json({ detail: 'Not found.' });
  const amount = parseFloat(req.body.amount) || 0;
  if (amount <= 0) return res.status(400).json({ detail: 'Amount must be greater than 0.' });
  if (amount > due.balance) return res.status(400).json({ detail: `Amount exceeds outstanding balance of Rs ${due.balance}.` });
  due.amount_paid = (parseFloat(due.amount_paid) || 0) + amount;
  due.balance = Math.max(0, due.total_amount - due.amount_paid);
  due.status = due.balance <= 0 ? 'paid' : 'partial';
  due.payments.push({ id: Date.now(), amount, date: new Date().toISOString().split('T')[0], method: req.body.method || 'cash', note: req.body.note || '' });
  const customer = ud.customers.find(c => c.id === due.customer_id);
  if (customer) customer.outstanding_balance = Math.max(0, (parseFloat(customer.outstanding_balance) || 0) - amount);

  if (due.balance <= 0) {
    if (due.sale_id) {
      const sale = ud.sales.find(s => s.id === due.sale_id);
      if (sale) { sale.payment_method = req.body.method || 'cash'; sale.is_due = false; }
    }
    const idx = ud.dues.findIndex(d => d.id === due.id);
    if (idx !== -1) ud.dues.splice(idx, 1);
    return res.json({ ...due, deleted: true, message: 'Due fully paid and removed.' });
  }

  res.json(due);
});

app.delete('/api/v1/dues/:id/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const idx = ud.dues.findIndex(d => d.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Not found.' });
  const due = ud.dues[idx];
  const customer = ud.customers.find(c => c.id === due.customer_id);
  if (customer) customer.outstanding_balance = Math.max(0, (parseFloat(customer.outstanding_balance) || 0) - due.balance);
  ud.dues.splice(idx, 1);
  res.status(204).send();
});

// ============ Analytics/Dashboard ============
const analyticsData = (ud) => ({
  total_revenue: ud.sales.reduce((sum, s) => sum + (s.total || s.total_amount || 0), 0) || 0,
  total_sales: ud.sales.length,
  total_customers: ud.customers.length,
  gross_margin: 35.5,
  sales_trend: [100, 150, 120, 180, 200, 160, 140],
  top_medicines: ud.medicines.slice(0, 3)
});

app.get('/api/v1/analytics/dashboard/', authenticate, (req, res) => res.json(analyticsData(getUserData(req.user.id))));
app.get('/api/v1/analytics/kpis/', authenticate, (req, res) => res.json(analyticsData(getUserData(req.user.id))));
app.get('/api/v1/analytics/daily-sales/', authenticate, (req, res) => {
  const days = parseInt(req.query.days || 7);
  const trend = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
    revenue: Math.floor(Math.random() * 5000) + 1000,
    transactions: Math.floor(Math.random() * 30) + 5
  }));
  res.json({ count: trend.length, results: trend });
});
app.get('/api/v1/analytics/inventory-valuation/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const totalValue = ud.medicines.reduce((sum, m) => sum + (m.purchase_price || 0) * (m.quantity_on_hand || 0), 0);
  res.json({ total_value: totalValue, total_items: ud.medicines.length, low_stock_count: ud.medicines.filter(m => m.quantity_on_hand <= m.reorder_level).length });
});

// ============ Inventory ============
app.get('/api/v1/inventory/low-stock/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const lowStock = ud.medicines.filter(m => m.quantity_on_hand <= (m.reorder_level || 20));
  res.json({ count: lowStock.length, results: lowStock });
});
app.get('/api/v1/inventory/expiring-soon/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const today = new Date(); today.setHours(0,0,0,0);
  const results = ud.medicines
    .filter(m => m.expiry_date)
    .map(m => {
      const exp = new Date(m.expiry_date); exp.setHours(0,0,0,0);
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...m, days_left: daysLeft };
    })
    .filter(m => m.days_left <= 90)
    .sort((a, b) => a.days_left - b.days_left);
  res.json({ count: results.length, results });
});
app.get('/api/v1/inventory/inventory/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  res.json({ count: ud.medicines.length, results: ud.medicines });
});
app.get('/api/v1/inventory/batches/expiring_soon/', authenticate, (req, res) => {
  res.json({ count: 0, results: [] });
});

// ============ Accounting ============
app.get('/api/v1/accounting/profit-loss/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const period = req.query.period || 'monthly';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  let filtered, label, periodStart, periodEnd;

  if (period === 'daily') {
    filtered = ud.sales.filter(s => s.date === todayStr);
    label = `Today (${todayStr})`;
    periodStart = todayStr;
    periodEnd = todayStr;
  } else if (period === 'annual') {
    filtered = ud.sales.filter(s => s.date && s.date.startsWith(`${year}`));
    label = `Year ${year}`;
    periodStart = `${year}-01-01`;
    periodEnd = `${year}-12-31`;
  } else {
    filtered = ud.sales.filter(s => s.date && s.date.startsWith(`${year}-${month}`));
    label = `${year}-${month}`;
    periodStart = `${year}-${month}-01`;
    periodEnd = `${year}-${month}-${new Date(year, today.getMonth() + 1, 0).getDate()}`;
  }

  let revenue = 0, cogs = 0;
  filtered.forEach(sale => {
    if (Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        const qty = parseInt(item.quantity_sold) || 0;
        revenue += (parseFloat(item.unit_price) || 0) * qty;
        cogs += (parseFloat(item.purchase_price) || 0) * qty;
      });
    } else {
      revenue += parseFloat(sale.total_amount || sale.total || 0);
    }
  });

  const gross_profit = revenue - cogs;
  const gross_margin_percent = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
  const net_profit = gross_profit;

  const dailyMap = {};
  filtered.forEach(sale => {
    const d = sale.date;
    if (!dailyMap[d]) dailyMap[d] = { date: d, revenue: 0, cogs: 0, transactions: 0 };
    dailyMap[d].transactions += 1;
    if (Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        const qty = parseInt(item.quantity_sold) || 0;
        dailyMap[d].revenue += (parseFloat(item.unit_price) || 0) * qty;
        dailyMap[d].cogs += (parseFloat(item.purchase_price) || 0) * qty;
      });
    } else {
      dailyMap[d].revenue += parseFloat(sale.total_amount || sale.total || 0);
    }
  });
  const daily_breakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    period, label, period_start: periodStart, period_end: periodEnd,
    total_revenue: Math.round(revenue * 100) / 100,
    total_cost_of_goods: Math.round(cogs * 100) / 100,
    gross_profit: Math.round(gross_profit * 100) / 100,
    gross_margin_percent: Math.round(gross_margin_percent * 100) / 100,
    net_profit: Math.round(net_profit * 100) / 100,
    total_transactions: filtered.length,
    daily_breakdown
  });
});

app.get('/api/v1/accounting/summary/', authenticate, (req, res) => {
  const ud = getUserData(req.user.id);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const calc = (sales) => {
    let revenue = 0, cogs = 0;
    sales.forEach(s => {
      if (Array.isArray(s.items)) {
        s.items.forEach(i => {
          const qty = parseInt(i.quantity_sold) || 0;
          revenue += (parseFloat(i.unit_price) || 0) * qty;
          cogs += (parseFloat(i.purchase_price) || 0) * qty;
        });
      } else { revenue += parseFloat(s.total_amount || s.total || 0); }
    });
    return { revenue: Math.round(revenue), cogs: Math.round(cogs), profit: Math.round(revenue - cogs), transactions: sales.length };
  };

  res.json({
    daily: calc(ud.sales.filter(s => s.date === todayStr)),
    monthly: calc(ud.sales.filter(s => s.date && s.date.startsWith(`${year}-${month}`))),
    annual: calc(ud.sales.filter(s => s.date && s.date.startsWith(`${year}`))),
  });
});

// ============ ADMIN ONLY ENDPOINTS ============

// User Management
app.get('/api/v1/admin/users/', authenticate, adminOnly, (req, res) => {
  const users = mockData.users.map(u => {
    const sub = userSubscriptions[u.id] || null;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      is_active: u.is_active !== false,
      date_joined: u.created_at || '2026-01-01T00:00:00Z',
      created_at: u.created_at || '2026-01-01T00:00:00Z',
      subscription: sub ? {
        status: sub.status,
        plan_name: sub.plan_name || null,
        expires_at: sub.expires_at || null
      } : null,
      data_stats: {
        medicines: (userDataStore[u.id]?.medicines || []).length,
        sales: (userDataStore[u.id]?.sales || []).length,
        customers: (userDataStore[u.id]?.customers || []).length
      }
    };
  });
  // Admins at top, then sort by created_at
  users.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });
  res.json({ count: users.length, results: users });
});

app.put('/api/v1/admin/users/:id/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = mockData.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ detail: 'User not found.' });
  const { username, email, first_name, last_name, role, new_password, password } = req.body;
  if (username && username !== user.username) {
    if (mockData.users.find(u => u.username === username && u.id !== userId)) {
      return res.status(400).json({ detail: 'Username already taken.' });
    }
    user.username = username;
  }
  if (email !== undefined) user.email = email;
  if (first_name !== undefined) user.first_name = first_name;
  if (last_name !== undefined) user.last_name = last_name;
  if (role !== undefined) {
    if (userId === 1 && role !== 'admin') return res.status(403).json({ detail: 'Cannot change primary admin role.' });
    user.role = role;
  }
  if (new_password || password) user.password = new_password || password;
  logActivity(req.user.id, 'user_updated', { updated_user_id: userId });
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name });
});

// PATCH endpoint (alternative to PUT)
app.patch('/api/v1/admin/users/:id/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = mockData.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ detail: 'User not found.' });
  const { username, email, first_name, last_name, role, password } = req.body;
  if (username && username !== user.username) {
    if (mockData.users.find(u => u.username === username && u.id !== userId)) {
      return res.status(400).json({ detail: 'Username already taken.' });
    }
    user.username = username;
  }
  if (email !== undefined) user.email = email;
  if (first_name !== undefined) user.first_name = first_name;
  if (last_name !== undefined) user.last_name = last_name;
  if (role !== undefined) {
    if (userId === 1 && role !== 'admin') return res.status(403).json({ detail: 'Cannot change primary admin role.' });
    user.role = role;
  }
  if (password) user.password = password;
  logActivity(req.user.id, 'user_updated', { updated_user_id: userId });
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name });
});

app.post('/api/v1/admin/users/', authenticate, adminOnly, (req, res) => {
  const { username, password, email, first_name, last_name, role = 'user' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ detail: 'username and password are required.' });
  }
  if (mockData.users.find(u => u.username === username)) {
    return res.status(400).json({ detail: 'Username already exists.' });
  }
  const newUser = {
    id: Math.max(...mockData.users.map(u => u.id)) + 1,
    username,
    password,
    email,
    first_name: first_name || '',
    last_name: last_name || '',
    role,
    created_at: new Date().toISOString()
  };
  mockData.users.push(newUser);
  logActivity(req.user.id, 'user_created', { created_user_id: newUser.id, username });
  res.status(201).json({ id: newUser.id, username, email, role });
});

app.delete('/api/v1/admin/users/:id/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === 1) return res.status(403).json({ detail: 'Cannot delete the primary admin user.' });
  const idx = mockData.users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ detail: 'User not found.' });
  const deletedUser = mockData.users[idx];
  mockData.users.splice(idx, 1);
  delete userDataStore[userId];
  logActivity(req.user.id, 'user_deleted', { deleted_user_id: userId, username: deletedUser.username });
  res.json({ detail: 'User deleted successfully.' });
});

app.post('/api/v1/admin/users/:id/reset-password/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ detail: 'new_password is required.' });
  const user = mockData.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ detail: 'User not found.' });
  user.password = new_password;
  logActivity(req.user.id, 'password_reset', { reset_user_id: userId });
  res.json({ detail: 'Password reset successfully.' });
});

app.post('/api/v1/admin/users/:id/promote-to-admin/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  const currentUser = mockData.users.find(u => u.id === userId);
  if (!currentUser) return res.status(404).json({ detail: 'User not found.' });
  if (currentUser.role === 'admin') return res.status(400).json({ detail: 'User is already an admin.' });
  currentUser.role = 'staff';
  logActivity(req.user.id, 'user_promoted', { promoted_user_id: userId, new_role: 'staff' });
  res.json({ detail: 'User promoted to staff successfully.', user: currentUser });
});

app.post('/api/v1/admin/users/:id/demote-to-pharmacist/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  const currentUser = mockData.users.find(u => u.id === userId);
  if (!currentUser) return res.status(404).json({ detail: 'User not found.' });
  if (currentUser.role === 'user') return res.status(400).json({ detail: 'User is already a regular user.' });
  currentUser.role = 'user';
  logActivity(req.user.id, 'user_demoted', { demoted_user_id: userId, new_role: 'user' });
  res.json({ detail: 'User demoted to regular user successfully.', user: currentUser });
});

// System-wide Analytics
app.get('/api/v1/admin/analytics/system/', authenticate, adminOnly, (req, res) => {
  const totalUsers = mockData.users.length;
  const totalRevenue = Object.values(userDataStore).reduce((sum, ud) => {
    return sum + (ud.sales || []).reduce((s, sale) => s + (sale.total || sale.total_amount || 0), 0);
  }, 0);
  const totalSales = Object.values(userDataStore).reduce((sum, ud) => sum + (ud.sales || []).length, 0);
  const totalCustomers = Object.values(userDataStore).reduce((sum, ud) => sum + (ud.customers || []).length, 0);
  const totalMedicines = Object.values(userDataStore).reduce((sum, ud) => sum + (ud.medicines || []).length, 0);
  const totalOutstanding = Object.values(userDataStore).reduce((sum, ud) => {
    return sum + (ud.dues || []).filter(d => d.status !== 'paid').reduce((s, d) => s + d.balance, 0);
  }, 0);

  const userStats = mockData.users.map(u => ({
    username: u.username,
    role: u.role,
    revenue: Object.values(userDataStore).find(ud => ud === userDataStore[u.id]) 
      ? (userDataStore[u.id]?.sales || []).reduce((s, sale) => s + (sale.total || sale.total_amount || 0), 0)
      : 0,
    transactions: (userDataStore[u.id]?.sales || []).length,
    customers: (userDataStore[u.id]?.customers || []).length
  }));

  res.json({
    total_users: totalUsers,
    total_active_users: mockData.users.filter(u => u.role !== 'admin' || u.id === 1).length,
    total_revenue: Math.round(totalRevenue),
    total_sales: totalSales,
    total_customers: totalCustomers,
    total_medicines: totalMedicines,
    total_outstanding_dues: Math.round(totalOutstanding),
    user_stats: userStats
  });
});

// Admin Settings
app.get('/api/v1/admin/settings/', authenticate, adminOnly, (req, res) => {
  res.json({
    system_name: 'PharmacyPro',
    system_version: '1.0.0',
    tax_rate: 11,
    currency: 'PKR',
    max_sessions_per_user: 1,
    backup_enabled: true,
    backup_frequency: 'daily',
    analytics_retention_days: 90,
    default_reorder_level: 20
  });
});

app.post('/api/v1/admin/settings/', authenticate, adminOnly, (req, res) => {
  const { tax_rate, max_sessions_per_user, backup_enabled, backup_frequency, default_reorder_level } = req.body;
  logActivity(req.user.id, 'settings_updated', { changes: req.body });
  res.json({
    detail: 'Settings updated successfully.',
    settings: {
      tax_rate: tax_rate || 11,
      max_sessions_per_user: max_sessions_per_user || 1,
      backup_enabled: backup_enabled !== undefined ? backup_enabled : true,
      backup_frequency: backup_frequency || 'daily',
      default_reorder_level: default_reorder_level || 20
    }
  });
});

// Activity Logs
app.get('/api/v1/admin/logs/', authenticate, adminOnly, (req, res) => {
  let results = [...activityLog].reverse();
  const { action, user_id, days = 7 } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 86400000);
  
  results = results.filter(log => new Date(log.timestamp) >= since);
  if (action) results = results.filter(log => log.action === action);
  if (user_id) results = results.filter(log => log.user_id === parseInt(user_id));
  
  const paginated = results.slice(0, 500);
  res.json({ count: paginated.length, total_logs: activityLog.length, results: paginated });
});

// ============ Subscription Plans ============
let subscriptionPlans = [
  {
    id: 1,
    name: 'Basic',
    price: 999,
    duration_days: 30,
    description: 'Perfect for small pharmacies getting started.',
    color: 'blue',
    is_active: true,
    is_popular: false,
    features_config: {
      max_medicines: 500,
      max_customers: 50,
      has_pos: true,
      has_inventory: true,
      has_transaction_history: true,
      has_dues: false,
      has_customer_management: false,
      has_analytics: false,
      has_accounting: false,
      has_purchase_management: false,
      has_prescriptions: false,
      has_desktop_app: false,
      has_api_access: false,
      has_multi_branch: false,
    }
  },
  {
    id: 2,
    name: 'Professional',
    price: 2499,
    duration_days: 30,
    description: 'For growing pharmacies that need more power.',
    color: 'purple',
    is_active: true,
    is_popular: true,
    features_config: {
      max_medicines: null,
      max_customers: null,
      has_pos: true,
      has_inventory: true,
      has_transaction_history: true,
      has_dues: true,
      has_customer_management: true,
      has_analytics: true,
      has_accounting: true,
      has_purchase_management: true,
      has_prescriptions: true,
      has_desktop_app: false,
      has_api_access: false,
      has_multi_branch: false,
    }
  },
  {
    id: 3,
    name: 'Enterprise',
    price: 4999,
    duration_days: 30,
    description: 'Full-featured for large or multi-branch pharmacies.',
    color: 'emerald',
    is_active: true,
    is_popular: false,
    features_config: {
      max_medicines: null,
      max_customers: null,
      has_pos: true,
      has_inventory: true,
      has_transaction_history: true,
      has_dues: true,
      has_customer_management: true,
      has_analytics: true,
      has_accounting: true,
      has_purchase_management: true,
      has_prescriptions: true,
      has_desktop_app: true,
      has_api_access: true,
      has_multi_branch: true,
    }
  }
];

// ============ Payment Accounts ============
let paymentAccounts = [
  {
    id: 1,
    account_title: 'PharmacyPro Official',
    bank_name: 'HBL Bank',
    account_number: '01234567891234',
    iban: 'PK36HABB0000001234567891',
    qr_code: null,
    instructions: 'Transfer to this account and upload the screenshot below.',
    is_active: true
  }
];

// ============ Payment Submissions ============
let paymentSubmissions = [];
// Per-user subscription store: { userId: { plan_id, status, expires_at, submission_id } }
let userSubscriptions = {
  1: { id: 1, user_id: 1, plan_id: null, status: 'admin', expires_at: null, approved_at: null } // admin never needs subscription
};

function getUserSubscription(userId) {
  return userSubscriptions[userId] || null;
}

// ============ Public Subscription Routes ============

// Get available plans (public, no auth needed)
app.get('/api/v1/subscriptions/plans/', (req, res) => {
  res.json({ count: subscriptionPlans.length, results: subscriptionPlans.filter(p => p.is_active) });
});

// Get current user's subscription status
app.get('/api/v1/subscriptions/my-subscription/', authenticate, (req, res) => {
  const sub = getUserSubscription(req.user.id);
  if (!sub) return res.json({ status: 'none', expires_at: null, plan: null });
  const plan = subscriptionPlans.find(p => p.id === sub.plan_id) || null;
  const now = new Date();
  const expired = sub.expires_at && new Date(sub.expires_at) < now;
  return res.json({ ...sub, plan, is_expired: expired });
});

// Submit payment proof (base64 image)
app.post('/api/v1/subscriptions/submit-payment/', authenticate, (req, res) => {
  const { plan_id, screenshot_base64, payment_account_id, amount_paid, notes } = req.body;
  if (!plan_id || !screenshot_base64) {
    return res.status(400).json({ detail: 'plan_id and screenshot_base64 are required.' });
  }
  const plan = subscriptionPlans.find(p => p.id === parseInt(plan_id));
  if (!plan) return res.status(404).json({ detail: 'Plan not found.' });

  // Cancel any existing pending submission for this user
  paymentSubmissions = paymentSubmissions.map(s =>
    s.user_id === req.user.id && s.status === 'pending' ? { ...s, status: 'cancelled' } : s
  );

  const submission = {
    id: Date.now(),
    user_id: req.user.id,
    username: req.user.username,
    plan_id: parseInt(plan_id),
    plan_name: plan.name,
    plan_price: plan.price,
    payment_account_id: payment_account_id || null,
    amount_paid: amount_paid || plan.price,
    screenshot_base64,
    notes: notes || '',
    status: 'pending',
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null
  };
  paymentSubmissions.push(submission);
  logActivity(req.user.id, 'payment_submitted', { plan_id, submission_id: submission.id });
  res.status(201).json({ detail: 'Payment submitted successfully. Awaiting admin approval.', submission_id: submission.id });
});

// ============ Admin Subscription Management ============

// Get/update subscription plans (Accessible to any logged in user)
app.get('/api/v1/admin/subscription-plans/', authenticate, (req, res) => {
  res.json({ count: subscriptionPlans.length, results: subscriptionPlans });
});

app.post('/api/v1/admin/subscription-plans/', authenticate, adminOnly, (req, res) => {
  const { name, price, duration_days, description, color, is_popular, features_config } = req.body;
  if (!name || !price || !duration_days) {
    return res.status(400).json({ detail: 'name, price, and duration_days are required.' });
  }
  const defaultFeatures = {
    max_medicines: null, max_customers: null,
    has_pos: true, has_inventory: true, has_transaction_history: true,
    has_dues: false, has_customer_management: false, has_analytics: false,
    has_accounting: false, has_purchase_management: false, has_prescriptions: false,
    has_desktop_app: false, has_api_access: false, has_multi_branch: false,
  };
  const newPlan = {
    id: Math.max(...subscriptionPlans.map(p => p.id)) + 1,
    name, price: parseInt(price), duration_days: parseInt(duration_days),
    description: description || '',
    color: color || 'blue',
    is_active: true,
    is_popular: is_popular || false,
    features_config: { ...defaultFeatures, ...(features_config || {}) }
  };
  subscriptionPlans.push(newPlan);
  logActivity(req.user.id, 'plan_created', { plan_id: newPlan.id, name });
  res.status(201).json(newPlan);
});

app.put('/api/v1/admin/subscription-plans/:id/', authenticate, adminOnly, (req, res) => {
  const idx = subscriptionPlans.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Plan not found.' });
  subscriptionPlans[idx] = { ...subscriptionPlans[idx], ...req.body, id: subscriptionPlans[idx].id };
  // Merge features_config instead of replacing
  if (req.body.features_config) {
    subscriptionPlans[idx].features_config = { ...subscriptionPlans[idx].features_config, ...req.body.features_config };
  }
  logActivity(req.user.id, 'plan_updated', { plan_id: req.params.id });
  res.json(subscriptionPlans[idx]);
});

app.delete('/api/v1/admin/subscription-plans/:id/', authenticate, adminOnly, (req, res) => {
  const idx = subscriptionPlans.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Plan not found.' });
  if (subscriptionPlans.length <= 1) return res.status(400).json({ detail: 'Cannot delete the last plan.' });
  subscriptionPlans.splice(idx, 1);
  logActivity(req.user.id, 'plan_deleted', { plan_id: req.params.id });
  res.json({ detail: 'Plan deleted.' });
});

// Get current user's subscription status
app.get('/api/v1/admin/tenant-subscriptions/my_subscription/', authenticate, (req, res) => {
  const sub = getUserSubscription(req.user.id);
  if (!sub) {
    // Check if pending submission exists
    const submission = paymentSubmissions.find(s => s.user_id === req.user.id && s.status === 'pending');
    if (submission) {
      return res.json({ status: 'pending', submission_id: submission.id });
    }
    return res.status(404).json({ detail: 'No active subscription.' });
  }
  const plan = subscriptionPlans.find(p => p.id === sub.plan_id) || null;
  return res.json({
    id: sub.id,
    pharmacy: 1, // mock
    plan: plan, // frontend expects sub.plan.features_config
    plan_details: plan, // matching DRF serializer name
    status: sub.status,
    starts_at: sub.starts_at || sub.approved_at || new Date().toISOString(),
    expires_at: sub.expires_at
  });
});

// Admin: Get all tenant subscriptions
app.get('/api/v1/admin/tenant-subscriptions/', authenticate, adminOnly, (req, res) => {
  console.log('[API] GET /admin/tenant-subscriptions/ - User:', req.user?.username);
  const list = Object.values(userSubscriptions).map(sub => {
    const plan = subscriptionPlans.find(p => p.id === sub.plan_id) || null;
    return {
      id: sub.id,
      pharmacy: sub.user_id,
      plan: sub.plan_id,
      plan_details: plan,
      status: sub.status,
      starts_at: sub.starts_at || sub.approved_at || new Date().toISOString(),
      expires_at: sub.expires_at
    };
  });
  console.log('[API] Returning', list.length, 'subscriptions');
  res.json({ count: list.length, results: list });
});

// Submit payment (Django-style endpoint)
app.post('/api/v1/admin/payment-submissions/', authenticate, (req, res) => {
  const { plan_id, screenshot_base64, receipt_image, payment_account_id, amount_paid, amount, notes } = req.body;
  
  const finalPlanId = plan_id;
  const finalScreenshot = screenshot_base64 || receipt_image;
  const finalAmount = amount_paid || amount;
  
  if (!finalPlanId || !finalScreenshot) {
    return res.status(400).json({ detail: 'plan_id and screenshot_base64/receipt_image are required.' });
  }
  
  const plan = subscriptionPlans.find(p => p.id === parseInt(finalPlanId));
  if (!plan) return res.status(404).json({ detail: 'Plan not found.' });

  // Cancel any existing pending submission for this user
  paymentSubmissions = paymentSubmissions.map(s =>
    s.user_id === req.user.id && s.status === 'pending' ? { ...s, status: 'cancelled' } : s
  );

  const submission = {
    id: Date.now(),
    user_id: req.user.id,
    username: req.user.username,
    pharmacy: req.user.id, // Display user id/username in the UI table
    plan: plan.id,
    plan_id: plan.id,
    plan_name: plan.name,
    plan_price: plan.price,
    payment_account_id: payment_account_id || null,
    amount: parseFloat(finalAmount || plan.price),
    screenshot_base64: finalScreenshot,
    receipt_image: finalScreenshot,
    notes: notes || '',
    status: 'pending',
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null
  };
  
  paymentSubmissions.push(submission);
  logActivity(req.user.id, 'payment_submitted', { plan_id: finalPlanId, submission_id: submission.id });
  res.status(201).json(submission);
});

// Payment accounts CRUD
app.get('/api/v1/admin/payment-accounts/', authenticate, (req, res) => {
  res.json({ count: paymentAccounts.length, results: paymentAccounts });
});

// Also allow users to view active payment accounts
app.get('/api/v1/subscriptions/payment-accounts/', authenticate, (req, res) => {
  res.json({ count: paymentAccounts.length, results: paymentAccounts.filter(a => a.is_active) });
});

app.post('/api/v1/admin/payment-accounts/', authenticate, adminOnly, (req, res) => {
  const { account_title, bank_name, account_number, iban, qr_code, instructions } = req.body;
  if (!account_title || !bank_name || !account_number) {
    return res.status(400).json({ detail: 'account_title, bank_name, and account_number are required.' });
  }
  const account = {
    id: Date.now(),
    account_title,
    bank_name,
    account_number,
    iban: iban || '',
    qr_code: qr_code || null,
    instructions: instructions || '',
    is_active: true
  };
  paymentAccounts.push(account);
  logActivity(req.user.id, 'payment_account_added', { account_id: account.id });
  res.status(201).json(account);
});

app.put('/api/v1/admin/payment-accounts/:id/', authenticate, adminOnly, (req, res) => {
  const idx = paymentAccounts.findIndex(a => a.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Account not found.' });
  paymentAccounts[idx] = { ...paymentAccounts[idx], ...req.body, id: paymentAccounts[idx].id };
  res.json(paymentAccounts[idx]);
});

app.delete('/api/v1/admin/payment-accounts/:id/', authenticate, adminOnly, (req, res) => {
  const idx = paymentAccounts.findIndex(a => a.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Account not found.' });
  paymentAccounts.splice(idx, 1);
  res.status(204).send();
});

// Payment submissions
app.get('/api/v1/admin/payment-submissions/', authenticate, adminOnly, (req, res) => {
  const { status } = req.query;
  let results = [...paymentSubmissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  if (status) results = results.filter(s => s.status === status);
  // Strip base64 from list view for performance
  const stripped = results.map(({ screenshot_base64, ...rest }) => rest);
  res.json({ count: stripped.length, results: stripped });
});

// Get single submission (with screenshot)
app.get('/api/v1/admin/payment-submissions/:id/', authenticate, adminOnly, (req, res) => {
  const submission = paymentSubmissions.find(s => s.id === parseInt(req.params.id));
  if (!submission) return res.status(404).json({ detail: 'Not found.' });
  res.json(submission);
});

// Approve submission
app.post('/api/v1/admin/payment-submissions/:id/approve/', authenticate, adminOnly, (req, res) => {
  const submission = paymentSubmissions.find(s => s.id === parseInt(req.params.id));
  if (!submission) return res.status(404).json({ detail: 'Not found.' });
  if (submission.status !== 'pending') return res.status(400).json({ detail: 'Submission is not pending.' });

  const plan = subscriptionPlans.find(p => p.id === submission.plan_id);
  const durationDays = plan ? plan.duration_days : 30;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  submission.status = 'approved';
  submission.reviewed_at = new Date().toISOString();
  submission.reviewed_by = req.user.username;

  userSubscriptions[submission.user_id] = {
    id: submission.user_id,
    user_id: submission.user_id,
    plan_id: submission.plan_id,
    plan_name: submission.plan_name,
    status: 'active',
    expires_at: expiresAt,
    approved_at: new Date().toISOString(),
    submission_id: submission.id
  };

  logActivity(req.user.id, 'subscription_approved', { submission_id: submission.id, user_id: submission.user_id });
  res.json({ detail: 'Subscription approved successfully.', expires_at: expiresAt });
});

// Reject submission
app.post('/api/v1/admin/payment-submissions/:id/reject/', authenticate, adminOnly, (req, res) => {
  const submission = paymentSubmissions.find(s => s.id === parseInt(req.params.id));
  if (!submission) return res.status(404).json({ detail: 'Not found.' });
  if (submission.status !== 'pending') return res.status(400).json({ detail: 'Submission is not pending.' });
  submission.status = 'rejected';
  submission.reviewed_at = new Date().toISOString();
  submission.reviewed_by = req.user.username;
  submission.rejection_reason = req.body.reason || 'Payment could not be verified.';
  logActivity(req.user.id, 'subscription_rejected', { submission_id: submission.id, user_id: submission.user_id });
  res.json({ detail: 'Submission rejected.', reason: submission.rejection_reason });
});

// Revoke subscription
app.post('/api/v1/admin/users/:id/revoke-subscription/', authenticate, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  if (!userSubscriptions[userId]) return res.status(404).json({ detail: 'No subscription found.' });
  delete userSubscriptions[userId];
  logActivity(req.user.id, 'subscription_revoked', { user_id: userId });
  res.json({ detail: 'Subscription revoked.' });
});

// Admin: directly grant/update a subscription for any user
app.post('/api/v1/admin/subscriptions/grant/', authenticate, adminOnly, (req, res) => {
  const { user_id, plan_id, duration_days } = req.body;
  if (!user_id || !plan_id) return res.status(400).json({ detail: 'user_id and plan_id are required.' });
  const plan = subscriptionPlans.find(p => p.id === parseInt(plan_id));
  if (!plan) return res.status(404).json({ detail: 'Plan not found.' });
  const days = duration_days || plan.duration_days;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  userSubscriptions[parseInt(user_id)] = {
    id: parseInt(user_id), user_id: parseInt(user_id), plan_id: plan.id, plan_name: plan.name,
    status: 'active', expires_at: expiresAt, approved_at: new Date().toISOString(), submission_id: null
  };
  logActivity(req.user.id, 'subscription_granted', { user_id, plan_id });
  res.json({ detail: 'Subscription granted.', expires_at: expiresAt });
});

// ============ API Docs ============
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Pharmacy Management System API',
    version: '1.0',
    endpoints: {
      auth: ['/api/v1/auth/login/', '/api/v1/auth/logout/'],
      medicines: ['/api/v1/medicines/', '/api/v1/medicines/{id}/'],
      sales: ['/api/v1/sales/'],
      customers: ['/api/v1/customers/'],
      analytics: ['/api/v1/analytics/dashboard/'],
      inventory: ['/api/v1/inventory/low-stock/'],
      admin: ['/api/v1/admin/users/', '/api/v1/admin/analytics/system/', '/api/v1/admin/settings/', '/api/v1/admin/logs/']
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ Data Persistence ============
const DB_FILE = path.join(__dirname, 'db.json');

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (data.mockData) {
        mockData.users = data.mockData.users || mockData.users;
      }
      if (data.userDataStore) {
        for (const k in userDataStore) delete userDataStore[k];
        Object.assign(userDataStore, data.userDataStore);
      }
      if (data.subscriptionPlans) subscriptionPlans = data.subscriptionPlans;
      if (data.paymentAccounts) paymentAccounts = data.paymentAccounts;
      if (data.paymentSubmissions) paymentSubmissions = data.paymentSubmissions;
      if (data.userSubscriptions) userSubscriptions = data.userSubscriptions;
      console.log('📦 Loaded database from db.json');
    } catch (e) {
      console.error('Failed to load db.json', e);
    }
  }
}

function saveDb() {
  try {
    const data = {
      mockData,
      userDataStore,
      subscriptionPlans,
      paymentAccounts,
      paymentSubmissions,
      userSubscriptions
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save db.json', e);
  }
}

// Load existing DB on startup
loadDb();
// Save DB every 5 seconds to persist changes automatically
setInterval(saveDb, 5000);

app.listen(PORT, () => {
  console.log(`\n✅ Mock Backend API running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Login: admin / admin123\n`);
});
