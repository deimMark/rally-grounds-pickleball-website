// Accept only a publishable key; service-role/legacy JWT credentials are not needed here.
export function readSupabaseConfig(environment) {
  const url = environment.SUPABASE_URL?.trim();
  const key = environment.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) return { configured: false, reason: 'not-configured' };
  if (!url || !key) return { configured: false, reason: 'incomplete' };
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) throw new Error('Invalid protocol');
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !key.startsWith('sb_publishable_')) throw new Error('Invalid public connection configuration');
    return { configured: true, url, key };
  } catch {
    return { configured: false, reason: 'invalid' };
  }
}
