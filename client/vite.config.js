import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const missing = REQUIRED.filter((key) => !env[key])

  // Vite inlines import.meta.env at build time, so a missing value does not
  // surface as a runtime error — it silently bakes `undefined` into the
  // bundle. Fail here instead, where the message is actionable.
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment ${missing.length > 1 ? 'variables' : 'variable'}: ${missing.join(', ')}.\n` +
      `Copy client/.env.example to client/.env.local and fill them in.`
    )
  }

  return { plugins: [react()] }
})
