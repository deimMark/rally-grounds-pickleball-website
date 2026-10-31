import 'server-only';
import { redirect } from 'next/navigation';
import { createStaffClient } from '@/lib/supabase/auth-server';
export async function staffSession() {
  const client = await createStaffClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const role = await client.rpc('current_staff_role');
  if (role.error || !['owner', 'staff'].includes(role.data)) return null;
  return { client, userId: data.user.id, role: role.data };
}
export async function requireStaff() {
  const session = await staffSession();
  if (!session) redirect('/staff/login');
  return session;
}
