import express from 'express';
import cors from 'cors';

import { config, isProduction } from './config/env.js';
import { verifyConnection } from './config/health.js';
import { apiLimiter } from './middleware/rateLimit.js';

import userRoutes from './routes/user.js';
import sleepRoutes from './routes/sleep.js';
import journalRoutes from './routes/journal.js';
import insightRoutes from './routes/insights.js';
import chatRoutes from './routes/chat.js';
import calmRoutes from './routes/calm.js';
import patternRoutes from './routes/patterns.js';

const app = express();

// Behind a platform proxy (Render, Railway, Fly) so req.ip is the real client.
app.set('trust proxy', 1);
app.disable('x-powered-by');

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
app.use('/api/sleep', sleepRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calm', calmRoutes);
app.use('/api/patterns', patternRoutes);

// Health check — reports whether Supabase is actually reachable.
app.get('/api/health', async (req, res) => {
  const database = await verifyConnection();

  res.status(database.ok ? 200 : 503).json({
    status: database.ok ? 'MirrorSpace is breathing' : 'MirrorSpace is holding its breath',
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

const server = app.listen(config.port, async () => {
  console.log(`🪞 MirrorSpace server listening on port ${config.port}`);

  const database = await verifyConnection();
  if (database.ok) {
    console.log(`   Supabase connected: ${config.supabase.url}`);
  } else {
    console.error(`   Supabase unreachable: ${database.error}`);
  }
});

// Let the platform's rolling deploy drain in-flight requests.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  });
}

export default app;
