import { NextResponse } from 'next/server';
import { createStaffClient } from '@/lib/supabase/auth-server';
import { isTrustedOrigin } from '@/lib/domain/auth-origin';
export async function POST(request) {
  if (!isTrustedOrigin(request.headers.get('origin'), process.env.APP_ORIGIN)) return new Response('Forbidden', { status: 403 });
  const fail = () => NextResponse.redirect(new URL('/staff/login?error=access', process.env.APP_ORIGIN), 303);
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) return fail();
  const form = await request.formData();
  const email = form.get('email'); const password = form.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256 || !email || !password) return fail();
  const client = await createStaffClient();
  if (!client) return fail();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) return fail();
  const role = await client.rpc('current_staff_role');
  if (role.error || !['owner', 'staff'].includes(role.data)) { await client.auth.signOut(); return fail(); }
  return NextResponse.redirect(new URL('/staff', process.env.APP_ORIGIN), 303);
}
