// Values the config module requires at import time. Tests never reach a real
// Supabase project or API.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.EXPO_PUBLIC_API_URL = 'https://api.test/api';
