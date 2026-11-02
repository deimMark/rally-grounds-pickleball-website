import 'server-only';
import { createSupabaseConnection } from '@/lib/supabase/server';
import { validateClubDay, normalizeAvailability, validateSelectedDuration } from '@/lib/domain/availability';
// Internal server contract for Phase 3. No public booking endpoint or personal fields.
export async function getAvailability(day, durationMinutes) {
  const validatedDay = validateClubDay(day);
  const selectedDuration = validateSelectedDuration(durationMinutes);
  const client = createSupabaseConnection();
  if (!client) throw new Error('Availability connection is not configured');
  const result = await client.rpc('availability', { p_day: validatedDay, p_duration_minutes: selectedDuration });
  if (result.error) {
    const invalid = result.error.code === '22023';
    const failure = new Error(invalid ? 'Selected duration or effective policy configuration is unsupported' : 'Availability could not be loaded');
    failure.code = invalid ? 'INVALID_DURATION_OR_POLICY' : 'AVAILABILITY_UNAVAILABLE';
    throw failure;
  }
  return normalizeAvailability(result.data);
}
