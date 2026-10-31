import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './config';

// Optional connection factory only. No automatic calls, auth, tables or writes.
export function createSupabaseConnection() {
  const config = readSupabaseConfig(process.env);
  if (!config.configured) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
