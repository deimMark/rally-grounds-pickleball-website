import { NextResponse } from 'next/server';
import { createStaffClient } from '@/lib/supabase/auth-server';
import { isTrustedOrigin } from '@/lib/domain/auth-origin';
export async function POST(request) {
  if (!isTrustedOrigin(request.headers.get('origin'), process.env.APP_ORIGIN)) return new Response('Forbidden', { status: 403 });
  const client = await createStaffClient();
  if (client) await client.auth.signOut();
  return NextResponse.redirect(new URL('/staff/login', process.env.APP_ORIGIN), 303);
}
