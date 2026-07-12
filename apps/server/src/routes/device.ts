import { Router, Response } from 'express';
import { pool, logAudit } from '../db/postgres';
import { authenticate, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// ---- POST /api/device/activate ----------------------------------
// Called from desktop app when a new device is first used.

router.post('/activate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { device_fingerprint, device_name } = req.body;
  if (!device_fingerprint) {
    res.status(400).json({ error: 'device_fingerprint required' });
    return;
  }

  try {
    const userId = req.user!.id;

    // Check if device already activated
    const existing = await pool.query(
      'SELECT * FROM devices WHERE user_id = $1 AND device_fingerprint = $2',
      [userId, device_fingerprint]
    );

    if (existing.rows.length) {
      if (existing.rows[0].status === 'revoked') {
        res.status(403).json({ error: 'Device has been revoked', code: 'DEVICE_REVOKED' });
        return;
      }
      await pool.query('UPDATE devices SET last_seen = NOW() WHERE id = $1', [existing.rows[0].id]);
      res.json({ message: 'Device already active', device: existing.rows[0] });
      return;
    }

    // Lifetime license: only one device
    const { rows: userRows } = await pool.query(
      'SELECT license_type FROM users WHERE id = $1',
      [userId]
    );
    if (userRows[0]?.license_type === 'LIFETIME') {
      const activeDevices = await pool.query(
        "SELECT id FROM devices WHERE user_id = $1 AND status = 'active'",
        [userId]
      );
      if (activeDevices.rows.length > 0) {
        res.status(403).json({
          error: 'Lifetime license is single-device. Contact support to transfer.',
          code: 'DEVICE_LIMIT',
        });
        return;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO devices (user_id, device_fingerprint, device_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, device_fingerprint, device_name || 'Unknown Device']
    );

    await logAudit(userId, 'DEVICE_ACTIVATED', { device_fingerprint, device_name }, req.ip || undefined);
    res.status(201).json({ message: 'Device activated', device: rows[0] });
  } catch (err) {
    console.error('[device/activate]', err);
    res.status(500).json({ error: 'Activation failed' });
  }
});

// ---- GET /api/device/list ---------------------------------------

router.get('/list', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    'SELECT id, device_name, activated_at, last_seen, status FROM devices WHERE user_id = $1 ORDER BY activated_at DESC',
    [req.user!.id]
  );
  res.json(rows);
});

// ---- DELETE /api/device/:id (admin or self) ---------------------

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const deviceId = parseInt(req.params.id);
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'admin';

  const { rows } = await pool.query('SELECT * FROM devices WHERE id = $1', [deviceId]);
  if (!rows.length) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  if (!isAdmin && rows[0].user_id !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  await pool.query("UPDATE devices SET status = 'revoked' WHERE id = $1", [deviceId]);
  await logAudit(userId, 'DEVICE_REVOKED', { device_id: deviceId }, req.ip || undefined);
  res.json({ message: 'Device revoked' });
});

// ---- POST /api/device/reset (admin only) — clear all devices for a user ----

router.post('/reset', authenticate, adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { user_id } = req.body;
  if (!user_id) {
    res.status(400).json({ error: 'user_id required' });
    return;
  }

  await pool.query("UPDATE devices SET status = 'revoked' WHERE user_id = $1", [user_id]);
  await logAudit(req.user!.id, 'ADMIN_RESET_DEVICES', { target_user_id: user_id }, req.ip || undefined);
  res.json({ message: 'All devices reset for user' });
});

export default router;
