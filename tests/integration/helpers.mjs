import { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { localSettings } from '../../scripts/local-settings.mjs';
const settings = localSettings(); // Refuses any nonlocal administration target.
const identities = parseEnv(readFileSync('.env.test.local', 'utf8'));
const pool = new pg.Pool({ connectionString: settings.DB_URL, max: 25 });
const clients = {};
const court = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const at = (hour) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+08:00`).toISOString();
async function rpc(who, name, params) {
  if (name === 'create_reservation' && !Object.hasOwn(params, 'p_expected_versions')) {
    if (who === 'anon') params = { ...params, p_expected_versions: {} };
    else {
      const quoted = await clients[who].rpc('quote_reservation', { p_court_id: params.p_court_id, p_start: params.p_start, p_end: params.p_end });
      if (quoted.error) return quoted;
      params = { ...params, p_expected_versions: quoted.data.version_context };
    }
  }
  return clients[who].rpc(name, params);
}
function reservation(overrides = {}) {
  return { p_court_id: court(1), p_start: at(8), p_end: at(9), p_players: 4, p_source: 'staff', p_request_key: randomUUID(), p_expected_total: 60000, p_hold_until: new Date(Date.now() + 3600000).toISOString(), ...overrides };
}
async function success(result) { const { data, error } = await result; assert.equal(error, null, error?.code + ': ' + error?.message); return data; }
async function failure(result, code) { const { error } = await result; assert.ok(error, 'Expected rejection'); if (code) assert.equal(error.code, code); return error; }
async function count(table) { return Number((await pool.query(`select count(*) from public.${table}`)).rows[0].count); }

before(async () => {
  clients.anon = createClient(settings.API_URL, settings.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const who of ['owner', 'staff', 'inactive', 'outsider']) {
    const client = createClient(settings.API_URL, settings.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await success(client.auth.signInWithPassword({ email: identities[`TEST_${who.toUpperCase()}_EMAIL`], password: identities[`TEST_${who.toUpperCase()}_PASSWORD`] }));
    clients[who] = client;
  }
});
beforeEach(async () => {
  await pool.query('truncate private.guest_booking_policies,private.guest_operation_buckets,private.guest_rate_buckets,private.guest_intents,public.idempotency_requests,public.audit_events,public.court_occupancies,public.booking_items,public.booking_revisions,public.bookings,public.customers,public.court_config_versions,public.policy_versions,public.club_settings_versions,public.courts cascade');
  await pool.query(readFileSync('supabase/seed.sql', 'utf8'));
  await pool.query("update public.staff_profiles set active=true where user_id=$1", [identities.TEST_STAFF_ID]);
});
after(async () => { await pool.end(); });


export { settings, identities, pool, clients, court, day, at, rpc, reservation, success, failure, count };

export async function created(result) {
 const data=await success(result);
 assert.deepEqual(Object.keys(data).sort(),['current','receipt','replayed']);
 assert.equal(typeof data.receipt.id,'string');
 assert.equal(data.current.id,data.receipt.id);
 return data.receipt;
}
