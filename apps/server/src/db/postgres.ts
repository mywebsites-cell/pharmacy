import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pharmacy_licenses',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

// ---- Migrations ------------------------------------------------

const migrations: string[] = [
  // 001 — users
  `CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'pharmacist',
    license_type    VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
    approved        BOOLEAN NOT NULL DEFAULT false,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 002 — devices
  `CREATE TABLE IF NOT EXISTS devices (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint  VARCHAR(128) NOT NULL,
    device_name         VARCHAR(200),
    activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE(user_id, device_fingerprint)
  )`,

  // 003 — licenses
  `CREATE TABLE IF NOT EXISTS licenses (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token             TEXT NOT NULL,
    last_validation   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 004 — subscriptions
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan        VARCHAR(20) NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'active'
  )`,

  // 005 — activation_requests
  `CREATE TABLE IF NOT EXISTS activation_requests (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint  VARCHAR(128) NOT NULL,
    device_name         VARCHAR(200),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 006 — audit_logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    metadata    JSONB,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 007 — refresh_tokens
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(128) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

// ---- Seed admin user -------------------------------------------

async function seedAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pharmacypro.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, license_type, approved, status)
       VALUES ($1, $2, $3, 'admin', 'LIFETIME', true, 'active')`,
      ['System Admin', adminEmail, hash]
    );
    console.log('[DB] Seeded admin user:', adminEmail);
  }
}

// ---- Run all migrations ----------------------------------------

export async function runMigrations(): Promise<void> {
  console.log('[DB] Running migrations…');
  for (const sql of migrations) {
    await pool.query(sql);
  }
  console.log('[DB] Migrations complete.');
  await seedAdmin();
}

export async function logAudit(
  userId: number | null,
  action: string,
  metadata?: object,
  ip?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, metadata, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [userId, action, metadata ? JSON.stringify(metadata) : null, ip || null]
  );
}
