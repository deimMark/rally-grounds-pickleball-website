import 'server-only';
import { createSupabaseConnection } from '@/lib/supabase/server';
import { validateClubDay, normalizeAvailability } from '@/lib/domain/availability';
// Internal server contract for Phase 3. No public booking endpoint or personal fields.
export async function getAvailability(day) {
  const client = createSupabaseConnection();
  if (!client) throw new Error('Availability connection is not configured');
  const result = await client.rpc('availability', { p_day: validateClubDay(day) });
  if (result.error) throw new Error('Availability could not be loaded');
  return normalizeAvailability(result.data);
}
