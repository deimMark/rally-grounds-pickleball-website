import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { readSupabaseConfig } from './config';
export async function createStaffClient() {
  const config = readSupabaseConfig(process.env);
  if (!config.configured) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.APP_ORIGIN?.startsWith('https://') || false, path: '/' },
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server components cannot set cookies; the request proxy refreshes them. */ }
      },
    },
  });
}
