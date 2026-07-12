import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool, logAudit } from '../db/postgres';
import { authenticate, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, adminOnly);

// ---- GET /api/admin/users ----------------------------------------

router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.license_type, u.approved, u.status, u.created_at,
       s.plan, s.expiry_date, s.status AS sub_status,
       COUNT(DISTINCT d.id) AS device_count
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     LEFT JOIN devices d ON d.user_id = u.id AND d.status = 'active'
     GROUP BY u.id, s.id
     ORDER BY u.created_at DESC`
  );
  res.json(rows);
});

// ---- POST /api/admin/users ---------------------------------------

router.post('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, role, license_type } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email, password required' });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, license_type, approved, status)
       VALUES ($1, $2, $3, $4, $5, true, 'active')
       RETURNING id, name, email, role, license_type, approved, status, created_at`,
      [name, email, hash, role || 'pharmacist', license_type || 'TRIAL']
    );
    await logAudit(req.user!.id, 'ADMIN_CREATE_USER', { email }, req.ip || undefined);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// ---- PATCH /api/admin/users/:id ----------------------------------

router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, approved, license_type, role } = req.body;
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
  if (approved !== undefined) { updates.push(`approved = $${i++}`); values.push(approved); }
  if (license_type !== undefined) { updates.push(`license_type = $${i++}`); values.push(license_type); }
  if (role !== undefined) { updates.push(`role = $${i++}`); values.push(role); }

  if (!updates.length) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }
  values.push(parseInt(req.params.id));

  const { rows } = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, license_type, approved, status`,
    values
  );
  await logAudit(req.user!.id, 'ADMIN_UPDATE_USER', { target_id: req.params.id, ...req.body }, req.ip || undefined);
  res.json(rows[0] || {});
});

// ---- POST /api/admin/users/:id/promote-to-admin -----------------

router.post('/users/:id/promote-to-admin', async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: 'Cannot promote yourself' });
    return;
  }
  const { rows } = await pool.query(
    `UPDATE users SET role = 'admin' WHERE id = $1 RETURNING id, name, email, role, license_type, approved, status`,
    [targetId]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await logAudit(req.user!.id, 'ADMIN_PROMOTE_USER', { target_id: targetId, new_role: 'admin' }, req.ip || undefined);
  res.json({ message: 'User promoted to admin', user: rows[0] });
});

// ---- POST /api/admin/users/:id/demote-to-pharmacist ----------------

router.post('/users/:id/demote-to-pharmacist', async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: 'Cannot demote yourself' });
    return;
  }
  const { rows } = await pool.query(
    `UPDATE users SET role = 'pharmacist' WHERE id = $1 RETURNING id, name, email, role, license_type, approved, status`,
    [targetId]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await logAudit(req.user!.id, 'ADMIN_DEMOTE_USER', { target_id: targetId, new_role: 'pharmacist' }, req.ip || undefined);
  res.json({ message: 'User demoted to pharmacist', user: rows[0] });
});

// ---- DELETE /api/admin/users/:id ---------------------------------

router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }
  await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
  await logAudit(req.user!.id, 'ADMIN_DELETE_USER', { target_id: targetId }, req.ip || undefined);
  res.json({ message: 'User deleted' });
});

// ---- POST /api/admin/users/:id/approve ---------------------------

router.post('/users/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  const { license_type } = req.body;
  await pool.query(
    "UPDATE users SET approved = true, status = 'active', license_type = COALESCE($1, license_type) WHERE id = $2",
    [license_type || null, parseInt(req.params.id)]
  );
  await logAudit(req.user!.id, 'ADMIN_APPROVE_USER', { target_id: req.params.id, license_type }, req.ip || undefined);
  res.json({ message: 'User approved' });
});

// ---- POST /api/admin/users/:id/suspend ---------------------------

router.post('/users/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [parseInt(req.params.id)]);
  await logAudit(req.user!.id, 'ADMIN_SUSPEND_USER', { target_id: req.params.id }, req.ip || undefined);
  res.json({ message: 'User suspended' });
});

// ---- POST /api/admin/users/:id/reset-password --------------------

router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response): Promise<void> => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const hash = await bcrypt.hash(new_password, 12);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, parseInt(req.params.id)]);
  await logAudit(req.user!.id, 'ADMIN_RESET_PASSWORD', { target_id: req.params.id }, req.ip || undefined);
  res.json({ message: 'Password reset' });
});

// ---- POST /api/admin/subscriptions -------------------------------

router.post('/subscriptions', async (req: AuthRequest, res: Response): Promise<void> => {
  const { user_id, plan, days } = req.body;
  if (!user_id || !plan) {
    res.status(400).json({ error: 'user_id and plan required' });
    return;
  }
  const d = parseInt(days) || (plan === 'MONTHLY' ? 30 : plan === 'YEARLY' ? 365 : 14);

  // Deactivate current
  await pool.query("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND status = 'active'", [user_id]);

  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, expiry_date, status)
     VALUES ($1, $2, NOW() + INTERVAL '${d} days', 'active')
     RETURNING *`,
    [user_id, plan]
  );

  // Update user license_type
  await pool.query('UPDATE users SET license_type = $1 WHERE id = $2', [plan, user_id]);

  await logAudit(req.user!.id, 'ADMIN_CREATE_SUBSCRIPTION', { user_id, plan, days: d }, req.ip || undefined);
  res.status(201).json(rows[0]);
});

// ---- GET /api/admin/audit-logs -----------------------------------

router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  const { rows } = await pool.query(
    `SELECT l.*, u.name AS user_name, u.email
     FROM audit_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json(rows);
});

// ---- GET /api/admin/devices --------------------------------------

router.get('/devices', async (req: AuthRequest, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS user_name, u.email
     FROM devices d
     JOIN users u ON u.id = d.user_id
     ORDER BY d.last_seen DESC`
  );
  res.json(rows);
});

// ---- GET /api/admin/stats ----------------------------------------

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const [users, devices, subs, logs] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query("SELECT COUNT(*) FROM devices WHERE status = 'active'"),
    pool.query("SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND expiry_date > NOW()"),
    pool.query("SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'"),
  ]);
  res.json({
    total_users: parseInt(users.rows[0].count),
    active_devices: parseInt(devices.rows[0].count),
    active_subscriptions: parseInt(subs.rows[0].count),
    logs_last_24h: parseInt(logs.rows[0].count),
  });
});

export default router;
