import 'server-only';
import { demoClub, demoCourts, demoDays, demoAvailability, demoFeatures } from '@/lib/demo/club';
import { demoDashboard } from '@/lib/demo/dashboard';

// Future Supabase reads belong here behind authorization. Phase 1 never queries a DB.
export async function getPublicExperience() {
  return { club: demoClub, courts: demoCourts, days: demoDays, availability: demoAvailability, features: demoFeatures };
}
export async function getDashboardDemo() {
  // This route is an intentionally public, read-only demonstration, not staff Auth.
  return { club: demoClub, dashboard: demoDashboard };
}
