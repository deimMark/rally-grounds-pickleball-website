import 'server-only';
import { requireStaff } from '@/lib/server/staff-auth';
import { demoClub, demoCourts, demoDays, demoAvailability, demoFeatures } from '@/lib/demo/club';
import { demoDashboard } from '@/lib/demo/dashboard';

// Future Supabase reads belong here behind authorization. Phase 1 never queries a DB.
export async function getPublicExperience() {
  return { club: demoClub, courts: demoCourts, days: demoDays, availability: demoAvailability, features: demoFeatures };
}
export async function getDashboardDemo() {
  await requireStaff(); // Defense in depth: do not rely on a parent layout alone.
  return { club: demoClub, dashboard: demoDashboard };
}
