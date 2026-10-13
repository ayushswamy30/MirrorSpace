import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The drawings are read straight from the app (../mobile/assets/art).
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { assetsInlineLimit: 0 }
});
