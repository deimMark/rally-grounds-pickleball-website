import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { readSupabaseConfig } from './lib/supabase/config';
export async function proxy(request) {
  let response = NextResponse.next({ request });
  const config = readSupabaseConfig(process.env);
  if (!config.configured) return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.APP_ORIGIN?.startsWith('https://') || false, path: '/' },
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getUser(); // Validate/refresh; route and database guards still authorize.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/staff/:path*'] };
