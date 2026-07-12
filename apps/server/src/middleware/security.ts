import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Strict rate limit for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { error: 'Rate limit exceeded.' },
});

// Validation endpoint stricter limit
export const validationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Validation rate limit exceeded.' },
});

export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Desktop app doesn't need CSP
  crossOriginEmbedderPolicy: false,
});

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
};
