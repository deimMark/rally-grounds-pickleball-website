import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from '../../lib/supabase/config';
// Synthetic nonfunctional publishable key, never a real credential.
const key = 'sb_publishable_synthetic_test_only';
describe('optional server Supabase configuration', () => {
  it('supports a credential-free offline demo', () => {
    expect(readSupabaseConfig({})).toEqual({ configured: false, reason: 'not-configured' });
  });
  it('does not call partial settings a configured connection', () => {
    expect(readSupabaseConfig({ SUPABASE_URL: 'https://example.supabase.co' }).reason).toBe('incomplete');
  });
  it('accepts an HTTPS publishable-key configuration', () => {
    expect(readSupabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: key }).configured).toBe(true);
  });
  it('accepts a local HTTP endpoint for later local integration', () => {
    expect(readSupabaseConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY: key }).configured).toBe(true);
  });
  it.each(['http://example.supabase.co', 'javascript:alert(1)', 'not-a-url', 'https://user:password@example.com'])('rejects unsafe endpoint %s', (url) => {
    expect(readSupabaseConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key }).configured).toBe(false);
  });
  it.each(['sb_secret_example', 'eyJlegacyJWT', ''])('rejects secret or unsupported key %s', (value) => {
    expect(readSupabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: value }).configured).toBe(false);
  });
});
