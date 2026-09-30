const { existsSync } = require('node:fs');
const { join } = require('node:path');

/**
 * app.json holds the configuration; this only adds what depends on the
 * machine. Circle alerts on Android need Firebase: once google-services.json
 * (from the Firebase console, for package app.mirrorspace) sits next to this
 * file, builds pick it up. Without it the app builds as before, and alerts
 * stay off.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(existsSync(join(__dirname, 'google-services.json')) ? { googleServicesFile: './google-services.json' } : {})
  }
});
