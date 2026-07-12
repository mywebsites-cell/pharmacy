import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/postgres';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    license_type: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      role: string;
      license_type: string;
    };

    // Confirm user still active in DB
    const { rows } = await pool.query(
      'SELECT id, email, role, license_type, status FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length || rows[0].status !== 'active') {
      res.status(401).json({ error: 'Account inactive or not found' });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};
