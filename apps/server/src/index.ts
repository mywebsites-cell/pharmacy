import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runMigrations } from './db/postgres';
import { securityHeaders, apiLimiter, requestLogger } from './middleware/security';
import authRoutes from './routes/auth';
import licenseRoutes from './routes/license';
import deviceRoutes from './routes/device';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '9000');

// ---- Security headers ------------------------------------------
app.use(securityHeaders);
app.use(requestLogger);

// ---- CORS ------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Electron (no origin) and listed origins
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ---- Body parsing ----------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Rate limiting ---------------------------------------------
app.use('/api', apiLimiter);

// ---- Health check ----------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'PharmacyPro Licensing Server' });
});

// ---- Routes ----------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/admin', adminRoutes);

// ---- 404 handler -----------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Global error handler --------------------------------------
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Start ------------------------------------------------------
async function start(): Promise<void> {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`[Server] PharmacyPro Licensing Server running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
