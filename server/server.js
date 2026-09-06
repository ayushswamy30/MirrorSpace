/**
 * Long-running entrypoint: binds a port and serves until told to stop.
 * Serverless deployments import ../app.js directly instead.
 */
import app from './app.js';
import { config } from './config/env.js';
import { verifyConnection } from './config/health.js';

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

export default server;
