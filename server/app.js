/**
 * The Express application, with no listener attached (server.js binds the
 * port), so tests can mount it on their own.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config, isProduction } from './config/env.js';
import { verifyConnection } from './config/health.js';
import { apiLimiter } from './middleware/rateLimit.js';

import userRoutes from './routes/user.js';
import mirrorRoutes from './routes/mirror.js';
import circleRoutes from './routes/circle.js';
import legalRoutes from './routes/legal.js';

const app = express();

// Behind a platform proxy (Vercel, Render, Fly) so req.ip is the real client.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers. Apart from the two legal pages this process only
// answers JSON, so the directives that matter are the ones that stop a
// browser from treating a response as something it is not, or from
// embedding the API in someone else's page.
app.use(helmet({
  // Lock the whole content policy down rather than enumerating sources; the
  // legal pages set their own.
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"]
    }
  },
  // Journals are the content here. Keep referrers off entirely.
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProduction
    ? { maxAge: 15552000, includeSubDomains: true, preload: false }
    : false,
  // Lets the web app (on the site's origin) read responses; without it the
  // default same-origin policy blocks the browser from doing so.
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// The phone app sends no Origin; the web app at getlowkei.vercel.app/app does,
// and must be listed in CORS_ORIGINS.
app.use(cors({
  origin(origin, callback) {
    // Non-browser callers (curl, health checks) send no Origin.
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Blanket abuse ceiling, keyed by IP because it runs before authentication.
// The tighter, per-user limits live on the individual routes, after auth.
app.use('/api', apiLimiter);

// Routes
app.use('/api/user', userRoutes);
app.use('/api/mirror', mirrorRoutes);
app.use('/api/circle', circleRoutes);

// The privacy policy and terms — the only documents this process serves.
app.use(legalRoutes);

// Health check — reports whether Supabase is actually reachable.
app.get('/api/health', async (req, res) => {
  const database = await verifyConnection();

  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? 'Lowkei is breathing' : 'Lowkei is holding its breath',
    database,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Nothing lives at this address' });
});

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: 'Something went quietly wrong',
    error: isProduction ? undefined : err.message
  });
});

export default app;
