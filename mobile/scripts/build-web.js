/**
 * Builds the real app for the browser — the iPhone version — into dist-web/,
 * to be served under /app by the site (site/build.mjs picks it up).
 *
 * Not the preview: EXPO_PUBLIC_WEB_APP=1 switches off the made-up month and
 * talks to Supabase and the API like the phone build does.
 */
const { spawnSync } = require('node:child_process');

const env = {
  ...process.env,
  EXPO_PUBLIC_WEB_APP: '1',
  EXPO_PUBLIC_UNLOCK_ALL: '0',
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL_WEB || 'https://mirrorspace-api.onrender.com/api'
};

const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-web', '--clear'], {
  cwd: `${__dirname}/..`,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);
