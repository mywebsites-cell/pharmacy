import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { pool, logAudit } from '../db/postgres';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/security';

const router = Router();

// ---- Helper: sign tokens ----------------------------------------

function signAccessToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

function signRefreshToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO NOTHING`,
    [userId, hash, expires]
  );
}

// ---- POST /api/auth/register ------------------------------------

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const hash = await bcrypt.hash(password, 12);
      const trialDays = parseInt(process.env.TRIAL_DAYS || '14');
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, license_type, approved, status)
         VALUES ($1, $2, $3, 'pharmacist', 'TRIAL', false, 'pending')
         RETURNING id, name, email, role, license_type, approved, status, created_at`,
        [name, email, hash]
      );
      const user = result.rows[0];

      // Create trial subscription
      await pool.query(
        `INSERT INTO subscriptions (user_id, plan, expiry_date, status)
         VALUES ($1, 'TRIAL', NOW() + INTERVAL '${trialDays} days', 'active')`,
        [user.id]
      );

      await logAudit(user.id, 'USER_REGISTERED', { email }, req.ip || undefined);
      res.status(201).json({
        message: 'Registration successful. Awaiting admin approval.',
        user,
      });
    } catch (err) {
      console.error('[auth/register]', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ---- POST /api/auth/login ----------------------------------------

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('device_fingerprint').notEmpty().withMessage('Device fingerprint required'),
    body('device_name').optional().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, device_fingerprint, device_name } = req.body;

    try {
      const { rows } = await pool.query(
        `SELECT u.*, 
           s.plan AS sub_plan, s.expiry_date, s.status AS sub_status
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
           AND s.status = 'active'
           AND s.expiry_date > NOW()
         WHERE u.email = $1
         ORDER BY s.expiry_date DESC NULLS LAST
         LIMIT 1`,
        [email]
      );

      if (!rows.length) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const user = rows[0];

      if (user.status === 'pending') {
        res.status(403).json({ error: 'Account pending admin approval', code: 'PENDING_APPROVAL' });
        return;
      }
      if (user.status === 'suspended' || user.status === 'inactive') {
        res.status(403).json({ error: 'Account suspended', code: 'SUSPENDED' });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Handle device activation
      let deviceRow = await pool.query(
        'SELECT * FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
        [user.id, device_fingerprint]
      );

      if (deviceRow.rows.length === 0) {
        // New device — activate for subscription/trial, or require approval for lifetime
        if (user.license_type === 'LIFETIME') {
          // Check if user already has another device
          const otherDevices = await pool.query(
            "SELECT id FROM devices WHERE user_id = $1 AND status = 'active'",
            [user.id]
          );
          if (otherDevices.rows.length > 0) {
            res.status(403).json({
              error: 'Lifetime license allows single device only. Contact support to transfer.',
              code: 'DEVICE_LIMIT',
            });
            return;
          }
        }

        // Register this device
        const newDevice = await pool.query(
          `INSERT INTO devices (user_id, device_fingerprint, device_name, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING *`,
          [user.id, device_fingerprint, device_name || 'Unknown Device']
        );
        deviceRow = { rows: [newDevice.rows[0]] } as typeof deviceRow;
      } else {
        if (deviceRow.rows[0].status === 'revoked') {
          res.status(403).json({ error: 'Device revoked. Contact support.', code: 'DEVICE_REVOKED' });
          return;
        }
        // Update last seen
        await pool.query('UPDATE devices SET last_seen = NOW() WHERE id = $1', [deviceRow.rows[0].id]);
      }

      const device = deviceRow.rows[0];

      // Determine expiry
      const expiresAt: string | null = user.sub_plan === 'LIFETIME' ? null : user.expiry_date || null;
      const now = new Date();
      const expiry = expiresAt ? new Date(expiresAt) : null;
      const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;

      // Build license token payload
      const licensePayload = {
        user_id: user.id,
        device_id: device.id,
        email: user.email,
        name: user.name,
        role: user.role,
        license_type: user.license_type,
        expires_at: expiresAt,
        issued_at: now.toISOString(),
        last_validation: now.toISOString(),
      };

      const licenseSecret = process.env.LICENSE_SECRET!;
      const licenseToken = jwt.sign(licensePayload, licenseSecret, { expiresIn: '31d' } as jwt.SignOptions);

      // Save/update license record
      await pool.query(
        `INSERT INTO licenses (user_id, token, last_validation, expires_at)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT DO NOTHING`,
        [user.id, licenseToken, expiresAt]
      );
      await pool.query(
        'UPDATE licenses SET token = $1, last_validation = NOW() WHERE user_id = $2',
        [licenseToken, user.id]
      );

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        license_type: user.license_type,
      };
      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);
      await storeRefreshToken(user.id, refreshToken);

      await logAudit(user.id, 'LOGIN', { device_fingerprint, device_name }, req.ip || undefined);

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          license_type: user.license_type,
          approved: user.approved,
          status: user.status,
        },
        license: licensePayload,
        license_token: licenseToken,
        validation: {
          valid: true,
          license_type: user.license_type,
          expires_at: expiresAt,
          days_remaining: daysRemaining,
          requires_renewal: daysRemaining !== null && daysRemaining <= 5,
        },
      });
    } catch (err) {
      console.error('[auth/login]', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ---- POST /api/auth/refresh -------------------------------------

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET!) as {
      id: number;
      email: string;
      role: string;
      license_type: string;
    };

    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const stored = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [hash]
    );
    if (!stored.rows.length) {
      res.status(401).json({ error: 'Refresh token invalid or expired' });
      return;
    }

    // Rotate — delete old, issue new
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]);

    const payload = { id: decoded.id, email: decoded.email, role: decoded.role, license_type: decoded.license_type };
    const newAccess = signAccessToken(payload);
    const newRefresh = signRefreshToken(payload);
    await storeRefreshToken(decoded.id, newRefresh);

    res.json({ access_token: newAccess, refresh_token: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ---- POST /api/auth/logout --------------------------------------

router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  if (refresh_token) {
    const hash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]);
  }
  await logAudit(req.user!.id, 'LOGOUT', {}, req.ip || undefined);
  res.json({ message: 'Logged out' });
});

// ---- GET /api/auth/me ------------------------------------------

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, license_type, approved, status, created_at FROM users WHERE id = $1',
    [req.user!.id]
  );
  res.json(rows[0] || {});
});

export default router;
