const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build is WebAssembly.
config.resolver.assetExts.push('wasm');

// …and needs SharedArrayBuffer, which browsers only allow on a
// cross-origin-isolated page. Only the web preview is served from here.
config.server.enhanceMiddleware = middleware => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
