import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool, logAudit } from '../db/postgres';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validationLimiter } from '../middleware/security';

const router = Router();

const VALIDATION_INTERVAL_DAYS = 30;

// ---- POST /api/license/validate ---------------------------------
// Called every time the desktop app starts or background service runs.
// Returns fresh license token + subscription status.

router.post('/validate', validationLimiter, authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { device_fingerprint } = req.body;
  if (!device_fingerprint) {
    res.status(400).json({ error: 'Device fingerprint required' });
    return;
  }

  try {
    const userId = req.user!.id;

    // Check device matches
    const { rows: deviceRows } = await pool.query(
      "SELECT * FROM devices WHERE user_id = $1 AND device_fingerprint = $2 AND status = 'active'",
      [userId, device_fingerprint]
    );
    if (!deviceRows.length) {
      res.status(403).json({
        valid: false,
        error: 'Device not recognized or revoked',
        code: 'DEVICE_MISMATCH',
      });
      return;
    }
    const device = deviceRows[0];

    // Fetch user + subscription
    const { rows: userRows } = await pool.query(
      `SELECT u.*,
         s.plan AS sub_plan, s.expiry_date, s.status AS sub_status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
         AND s.status = 'active'
         AND s.expiry_date > NOW()
       WHERE u.id = $1
       ORDER BY s.expiry_date DESC NULLS LAST
       LIMIT 1`,
      [userId]
    );
    const user = userRows[0];
    if (!user || user.status !== 'active') {
      res.status(403).json({ valid: false, error: 'Account inactive', code: 'SUSPENDED' });
      return;
    }

    const now = new Date();
    const expiresAt: string | null = user.license_type === 'LIFETIME' ? null : (user.expiry_date || null);
    const expiry = expiresAt ? new Date(expiresAt) : null;
    const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;

    if (expiry && expiry < now && user.license_type !== 'LIFETIME') {
      // Expired — update subscription status
      await pool.query("UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId]);
      res.status(402).json({
        valid: false,
        error: 'Subscription expired',
        code: 'SUBSCRIPTION_EXPIRED',
        expires_at: expiresAt,
        days_remaining: daysRemaining,
      });
      return;
    }

    // Build fresh license token
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
    const newToken = jwt.sign(licensePayload, process.env.LICENSE_SECRET!, { expiresIn: '31d' } as jwt.SignOptions);

    // Update DB
    await pool.query(
      'UPDATE licenses SET token = $1, last_validation = NOW() WHERE user_id = $2',
      [newToken, userId]
    );
    await pool.query('UPDATE devices SET last_seen = NOW() WHERE id = $1', [device.id]);

    await logAudit(userId, 'LICENSE_VALIDATED', { device_fingerprint }, req.ip || undefined);

    res.json({
      valid: true,
      token: newToken,
      validation: {
        valid: true,
        license_type: user.license_type,
        expires_at: expiresAt,
        days_remaining: daysRemaining,
        requires_renewal: daysRemaining !== null && daysRemaining <= 5,
        message: daysRemaining !== null && daysRemaining <= 5
          ? `Your subscription expires in ${daysRemaining} day(s). Please renew.`
          : undefined,
      },
    });
  } catch (err) {
    console.error('[license/validate]', err);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// ---- GET /api/license/status ------------------------------------

router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT u.license_type, u.status,
         s.plan, s.expiry_date, s.status AS sub_status,
         l.last_validation
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN licenses l ON l.user_id = u.id
       WHERE u.id = $1
       ORDER BY s.expiry_date DESC NULLS LAST
       LIMIT 1`,
      [req.user!.id]
    );
    const r = rows[0];
    const now = new Date();
    const expiry = r?.expiry_date ? new Date(r.expiry_date) : null;
    const daysRemaining = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;

    res.json({
      license_type: r?.license_type,
      subscription_status: r?.sub_status,
      expires_at: r?.expiry_date || null,
      days_remaining: daysRemaining,
      last_validation: r?.last_validation,
      validation_overdue: r?.last_validation
        ? (now.getTime() - new Date(r.last_validation).getTime()) > VALIDATION_INTERVAL_DAYS * 86400000
        : true,
    });
  } catch (err) {
    res.status(500).json({ error: 'Status fetch failed' });
  }
});

export default router;
