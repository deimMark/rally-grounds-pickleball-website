import { before, beforeEach, after, test } from 'node:test';
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
  await pool.query('truncate public.idempotency_requests,public.audit_events,public.court_occupancies,public.booking_items,public.booking_revisions,public.bookings,public.customers,public.court_config_versions,public.policy_versions,public.club_settings_versions,public.courts cascade');
  await pool.query(readFileSync('supabase/seed.sql', 'utf8'));
  await pool.query("update public.staff_profiles set active=true where user_id=$1", [identities.TEST_STAFF_ID]);
});
after(async () => { await pool.end(); });

test('seed: five stable courts, Manila, integer centavos and explicit undecided values', async () => {
  assert.equal(await count('courts'), 5);
  const policy = (await pool.query('select * from public.policy_versions')).rows[0];
  assert.equal(policy.minimum_minutes, 60); assert.equal(policy.partial_refund_bps, null);
  assert.equal(policy.payment_cutoff_minutes, null); assert.equal(policy.guest_cutoff_inclusive, null);
  assert.equal(policy.booking_horizon_days, null); assert.equal(policy.provisional, true);
  assert.equal((await pool.query('show timezone')).rows[0].TimeZone, 'UTC');
});
test('real Auth identities resolve database roles, not user metadata', async () => {
  assert.equal(await success(rpc('owner', 'current_staff_role')), 'owner');
  assert.equal(await success(rpc('staff', 'current_staff_role')), 'staff');
  assert.equal(await success(rpc('inactive', 'current_staff_role')), null);
  assert.equal(await success(rpc('outsider', 'current_staff_role')), null);
  await success(clients.staff.auth.updateUser({ data: { role: 'owner' } }));
  assert.equal(await success(rpc('staff', 'current_staff_role')), 'staff');
  await failure(rpc('staff', 'publish_policy', { p_effective: null, p_changes: {}, p_note: 'forged role' }), '42501');
});
test('anonymous availability is a bounded, privacy-safe projection', async () => {
  const rows = await success(rpc('anon', 'availability', { p_day: day }));
  assert.equal(rows.length, 75);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['court_id', 'court_number', 'ends_at', 'starts_at', 'status', 'timezone']);
  assert.equal(rows[0].timezone, 'Asia/Manila');
  assert.equal(new Date(rows[0].starts_at).toISOString(), at(8));
  await failure(rpc('anon', 'create_reservation', reservation()), '42501');
  await failure(rpc('anon', 'availability', { p_day: '1999-01-01' }), '22023');
});
test('availability uses Manila hours even with another database session timezone', async () => {
  const connection = await pool.connect();
  try {
    await connection.query("set timezone='America/New_York'");
    const result = await connection.query('select * from public.availability($1) order by court_number,starts_at', [day]);
    assert.equal(result.rows.length, 75);
    assert.equal(result.rows[0].starts_at.toISOString(), at(8));
  } finally { await connection.query("set timezone='UTC'"); connection.release(); }
});
test('quotes enforce local operating hours, start alignment and minimum duration', async () => {
  const quote = (start, end) => rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: start, p_end: end });
  assert.equal((await success(quote(at(8), at(10)))).total_centavos, 120000);
  for (const [start, end] of [[at(7), at(8)], [at(23), new Date(Date.parse(at(23)) + 3600000).toISOString()], [at(8).replace('00:00:00', '00:30:00'), at(9)], [at(8), new Date(Date.parse(at(8)) + 1800000).toISOString()]]) await failure(quote(start, end), '23514');
});
test('20 concurrent reservation attempts yield exactly one committed reservation', async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => rpc('staff', 'create_reservation', reservation())));
  assert.equal(results.filter((r) => !r.error).length, 1);
  assert.equal(results.filter((r) => r.error?.code === '23P01').length, 19);
  for (const table of ['bookings', 'booking_revisions', 'booking_items', 'court_occupancies', 'idempotency_requests', 'audit_events']) assert.equal(await count(table), 1, table);
});
test('half-open adjacent reservations succeed while overlapping requests fail', async () => {
  await success(rpc('staff', 'create_reservation', reservation()));
  await success(rpc('staff', 'create_reservation', reservation({ p_start: at(9), p_end: at(10) })));
  await failure(rpc('staff', 'create_reservation', reservation({ p_start: at(8), p_end: at(10), p_expected_total: 120000 })), '23P01');
  assert.equal(await count('bookings'), 2);
});
test('open play and maintenance share the database exclusion constraint', async () => {
  for (const kind of ['open_play', 'maintenance']) {
    await pool.query('truncate public.court_occupancies');
    await success(rpc('staff', 'block_courts', { p_court_ids: [court(1)], p_start: at(8), p_end: at(9), p_kind: kind, p_request_key: randomUUID() }));
    await failure(rpc('staff', 'create_reservation', reservation()), '23P01');
    assert.equal(await count('bookings'), 0);
  }
});
test('multi-court block rolls back earlier inserts and audits on later conflict', async () => {
  await success(rpc('staff', 'create_reservation', reservation({ p_court_id: court(2) })));
  await failure(rpc('staff', 'block_courts', { p_court_ids: [court(1), court(2)], p_start: at(8), p_end: at(9), p_kind: 'maintenance', p_request_key: randomUUID() }), '23P01');
  assert.equal(await count('court_occupancies'), 1); assert.equal(await count('audit_events'), 1);
});
test('concurrent identical retries are idempotent and changed payload is rejected', async () => {
  const params = reservation();
  const results = await Promise.all(Array.from({ length: 20 }, () => rpc('staff', 'create_reservation', params)));
  assert.ok(results.every((r) => !r.error)); assert.equal(new Set(results.map((r) => r.data.id)).size, 1);
  await failure(rpc('staff', 'create_reservation', { ...params, p_players: 5 }), '22023');
  const otherActor = await success(rpc('owner', 'create_reservation', { ...params, p_court_id: court(2) }));
  assert.notEqual(otherActor.id, results[0].data.id); assert.equal(await count('bookings'), 2);
});
test('expiry reads and racing release/create reconcile without resurrecting holds', async () => {
  const old = await success(rpc('staff', 'create_reservation', reservation({ p_hold_until: new Date(Date.now() + 1800).toISOString() })));
  await new Promise((resolve) => setTimeout(resolve, 1900));
  const rows = await success(rpc('anon', 'availability', { p_day: day }));
  assert.equal(rows.find((r) => r.court_id === court(1) && new Date(r.starts_at).toISOString() === at(8)).status, 'available');
  const results = await Promise.all([rpc('staff', 'release_reservation', { p_booking_id: old.id }), rpc('staff', 'create_reservation', reservation())]);
  assert.ok(results.every((r) => !r.error));
  assert.equal(Number((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count), 1);
  assert.equal((await pool.query('select status from public.bookings where id=$1', [old.id])).rows[0].status, 'expired');
});
test('release is idempotent, preserves agreements and cannot resurrect through retry', async () => {
  const params = reservation(); const booking = await success(rpc('staff', 'create_reservation', params));
  await success(rpc('staff', 'release_reservation', { p_booking_id: booking.id }));
  await success(rpc('staff', 'release_reservation', { p_booking_id: booking.id }));
  await success(rpc('staff', 'create_reservation', params));
  assert.equal(Number((await pool.query('select count(*) from public.court_occupancies where active')).rows[0].count), 0);
  assert.equal(await count('booking_revisions'), 1); assert.equal(await count('audit_events'), 2);
});
test('immediate and scheduled rates resolve at service time without rewriting agreements', async () => {
  const booking = await success(rpc('staff', 'create_reservation', reservation()));
  const original = (await pool.query('select agreement from public.booking_revisions where booking_id=$1', [booking.id])).rows[0].agreement;
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: null, p_changes: { rate_centavos: 70000 }, p_note: 'Synthetic immediate rate' }));
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: at(9), p_changes: { rate_centavos: 90000 }, p_note: 'Synthetic scheduled rate' }));
  const quote = await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(10) }));
  assert.equal(quote.total_centavos, 160000); assert.equal(quote.segments.length, 2);
  assert.equal((await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(9), p_end: at(10) }))).total_centavos, 90000);
  assert.deepEqual((await pool.query('select agreement from public.booking_revisions where booking_id=$1', [booking.id])).rows[0].agreement, original);
  assert.equal((await pool.query('select total_centavos from public.bookings where id=$1', [booking.id])).rows[0].total_centavos, 60000);
  await assert.rejects(pool.query("update public.booking_revisions set agreement='{}' where booking_id=$1", [booking.id]), { code: '23514' });
});
test('contract policy snapshots are creation-time and remain immutable', async () => {
  const booking = await success(rpc('staff', 'create_reservation', reservation()));
  await success(rpc('owner', 'publish_policy', { p_effective: null, p_changes: { guest_lead_minutes: 120 }, p_note: 'Synthetic immediate terms' }));
  const agreement = (await pool.query('select agreement from public.booking_revisions where booking_id=$1', [booking.id])).rows[0].agreement;
  assert.equal(agreement.policy.guest_lead_minutes, 60);
  assert.equal((await success(rpc('staff', 'quote_reservation', { p_court_id: court(2), p_start: at(8), p_end: at(9) }))).policy.guest_lead_minutes, 120);
});
test('future policy versions do not activate early; duplicates and backdating fail', async () => {
  const params = { p_effective: at(8), p_changes: { guest_lead_minutes: 240 }, p_note: 'Future terms' };
  await success(rpc('owner', 'publish_policy', params));
  const quote = await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(9) }));
  assert.equal(quote.policy.guest_lead_minutes, 60);
  await failure(rpc('owner', 'publish_policy', params), '23505');
  await failure(rpc('owner', 'publish_policy', { ...params, p_effective: '2020-01-01T00:00:00Z' }), '22023');
  await failure(rpc('owner', 'publish_policy', { ...params, p_effective: null, p_changes: { created_by: identities.TEST_STAFF_ID } }), '22023');
});
test('operational publication refuses disabling or closing an occupied court', async () => {
  await success(rpc('staff', 'create_reservation', reservation()));
  for (const changes of [{ enabled: false }, { opening_minute: 600 }]) await failure(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: null, p_changes: changes, p_note: 'Would invalidate booking' }), '23514');
  assert.equal(await count('court_config_versions'), 5);
});
test('club settings are owner-only, versioned and protect occupied timezone changes', async () => {
  await success(rpc('staff', 'create_reservation', reservation()));
  const params = { p_effective: null, p_name: 'Synthetic club', p_timezone: 'Asia/Manila', p_branding: { gold: '#D7AD6B' }, p_note: 'Synthetic brand' };
  await failure(rpc('staff', 'publish_club_settings', params), '42501');
  await success(rpc('owner', 'publish_club_settings', params));
  await failure(rpc('owner', 'publish_club_settings', { ...params, p_timezone: 'America/New_York' }), '23514');
});
test('deactivation denies an already signed-in staff user and last owner is protected', async () => {
  const quoted = await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(9) }));
  await success(rpc('owner', 'set_staff_role', { p_user_id: identities.TEST_STAFF_ID, p_role: 'staff', p_active: false }));
  await failure(clients.staff.rpc('create_reservation', reservation({ p_expected_versions: quoted.version_context })), '42501');
  assert.equal(await success(rpc('staff', 'current_staff_role')), null);
  assert.deepEqual(await success(clients.staff.from('bookings').select('*')), []);
  await failure(rpc('owner', 'set_staff_role', { p_user_id: identities.TEST_OWNER_ID, p_role: 'staff', p_active: true }), '23514');
  await failure(rpc('staff', 'set_staff_role', { p_user_id: identities.TEST_STAFF_ID, p_role: 'owner', p_active: true }), '42501');
});
test('RLS and grants deny anonymous/private access and direct app-role writes', async () => {
  await pool.query("insert into public.customers(display_name,contact) values('Synthetic guest','not-a-real-contact')");
  for (const table of ['customers', 'bookings', 'booking_revisions', 'booking_items', 'court_occupancies', 'policy_versions', 'court_config_versions', 'club_settings_versions', 'staff_profiles', 'audit_events', 'idempotency_requests']) {
    await failure(clients.anon.from(table).select('*'), '42501');
    assert.deepEqual(await success(clients.outsider.from(table).select('*')), [], table);
  }
  assert.deepEqual(await success(clients.staff.from('customers').select('*')), []);
  assert.equal((await success(clients.owner.from('customers').select('*'))).length, 1);
  await failure(clients.staff.from('staff_profiles').update({ role: 'owner' }).eq('user_id', identities.TEST_STAFF_ID), '42501');
  await failure(clients.owner.from('policy_versions').delete().neq('id', randomUUID()), '42501');
  await failure(clients.staff.from('court_occupancies').insert({ court_id: court(1) }), '42501');
});
test('audit is append-only, owner-readable, atomic and contains no customer contact', async () => {
  await success(rpc('staff', 'create_reservation', reservation()));
  assert.deepEqual(await success(clients.staff.from('audit_events').select('*')), []);
  const audits = await success(clients.owner.from('audit_events').select('*'));
  assert.equal(audits.length, 1); assert.equal(audits[0].actor_id, identities.TEST_STAFF_ID);
  assert.deepEqual(Object.keys(audits[0].metadata).sort(), ['court_id', 'source']);
  await failure(clients.owner.from('audit_events').delete().eq('id', audits[0].id), '42501');
  await assert.rejects(pool.query('delete from public.audit_events'), { code: '23514' });
});
test('database rejects malformed, infinite and wrong-bound occupancy ranges directly', async () => {
  for (const range of ['empty', '(,)', `[${at(8)},${at(9)}]`, `( ${at(8)},${at(9)})`, '[infinity,infinity]']) {
    await assert.rejects(pool.query('insert into public.court_occupancies(court_id,kind,occupied_during,created_by) values($1,$2,$3,$4)', [court(1), 'maintenance', range, identities.TEST_OWNER_ID]));
  }
  assert.equal(await count('court_occupancies'), 0);
});
test('invalid price, player count, source and deadline cannot leave partial records', async () => {
  for (const changes of [{ p_expected_total: 1 }, { p_players: 0 }, { p_source: 'forged' }, { p_hold_until: new Date(Date.now() - 1000).toISOString() }, { p_start: '2020-01-01T00:00:00Z', p_end: '2020-01-01T01:00:00Z' }]) await failure(rpc('staff', 'create_reservation', reservation(changes)));
  for (const table of ['bookings', 'booking_revisions', 'booking_items', 'court_occupancies', 'audit_events']) assert.equal(await count(table), 0);
});
test('concurrent rate publication and creation cannot commit a stale price', async () => {
  const [created, published] = await Promise.all([
    rpc('staff', 'create_reservation', reservation()),
    rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: null, p_changes: { rate_centavos: 70000 }, p_note: 'Racing update' }),
  ]);
  assert.equal(published.error, null);
  if (created.error) { assert.equal(created.error.code, '22023'); assert.equal(await count('bookings'), 0); }
  else { assert.equal(created.data.total_centavos, 60000); assert.equal(await count('bookings'), 1); }
});
test('policy resolver switches exactly at the scheduled activation instant', async () => {
  const id = await success(rpc('owner', 'publish_policy', { p_effective: at(8), p_changes: { guest_lead_minutes: 240 }, p_note: 'Boundary fixture' }));
  const before = (await pool.query('select (private.policy_at($1)).guest_lead_minutes as lead', [new Date(Date.parse(at(8)) - 1).toISOString()])).rows[0];
  const on = (await pool.query('select (private.policy_at($1)).id as id', [at(8)])).rows[0];
  const after = (await pool.query('select (private.policy_at($1)).guest_lead_minutes as lead', [new Date(Date.parse(at(8)) + 1).toISOString()])).rows[0];
  assert.equal(before.lead, 60); assert.equal(on.id, id); assert.equal(after.lead, 240);
});
test('scheduled disabled-court boundary affects availability and every quote segment', async () => {
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: at(9), p_changes: { enabled: false }, p_note: 'Synthetic future closure' }));
  await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(9) }));
  await failure(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(10) }), '23514');
  const rows = await success(rpc('anon', 'availability', { p_day: day }));
  assert.equal(rows.filter((row) => row.court_id === court(1)).length, 1);
  assert.equal(new Date(rows.find((row) => row.court_id === court(1)).starts_at).toISOString(), at(8));
});
test('every introduced table has RLS and private helpers are not executable by app roles', async () => {
  const tables = ['courts', 'club_settings_versions', 'policy_versions', 'court_config_versions', 'staff_profiles', 'customers', 'bookings', 'booking_revisions', 'booking_items', 'court_occupancies', 'idempotency_requests', 'audit_events'];
  const rows = (await pool.query("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname=any($1)", [tables])).rows;
  assert.equal(rows.length, tables.length); assert.ok(rows.every((row) => row.relrowsecurity));
  const grants = (await pool.query("select has_function_privilege('authenticated','private.quote(uuid,timestamptz,timestamptz)','execute') as quote, has_schema_privilege('anon','private','usage') as private_schema")).rows[0];
  assert.equal(grants.quote, false); assert.equal(grants.private_schema, false);
});
test('email password provider works but anonymous registration remains disabled', async () => {
  const { error } = await clients.anon.auth.signUp({ email: `not-created-${randomUUID()}@rally.test`, password: 'synthetic-registration-must-fail' });
  assert.ok(error); assert.equal(error.code, 'signup_disabled');
});
test('price-only publication does not reject off-hours maintenance occupancy', async () => {
  await success(rpc('staff', 'block_courts', { p_court_ids: [court(1)], p_start: at(7), p_end: at(8), p_kind: 'maintenance', p_request_key: randomUUID() }));
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: null, p_changes: { rate_centavos: 70000 }, p_note: 'Price only; maintenance is unchanged' }));
  assert.equal((await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(9) }))).total_centavos, 70000);
});
test('closure validation stops at a later restoration version before an existing booking', async () => {
  await success(rpc('staff', 'create_reservation', reservation({ p_start: at(10), p_end: at(11) })));
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: at(10), p_changes: { enabled: true }, p_note: 'Restore at ten' }));
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: at(9), p_changes: { enabled: false }, p_note: 'One-hour closure before restored booking' }));
  await failure(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(9), p_end: at(10) }), '23514');
  await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(10), p_end: at(11) }));
  const rows = await success(rpc('anon', 'availability', { p_day: day }));
  assert.equal(rows.filter((row) => row.court_id === court(1)).length, 14);
});
test('hours change validates just the affected segment of a spanning agreement', async () => {
  const booking = await success(rpc('staff', 'create_reservation', reservation({ p_end: at(10), p_expected_total: 120000 })));
  await success(rpc('owner', 'publish_court_config', { p_court_id: court(1), p_effective: at(9), p_changes: { opening_minute: 540 }, p_note: 'Nine AM opening effective at nine' }));
  await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(10) }));
  assert.equal((await pool.query('select total_centavos from public.bookings where id=$1', [booking.id])).rows[0].total_centavos, 120000);
});
test('creation rejects stale agreed policies even when the quoted total is unchanged', async () => {
  const quoted = await success(rpc('staff', 'quote_reservation', { p_court_id: court(1), p_start: at(8), p_end: at(9) }));
  await success(rpc('owner', 'publish_policy', { p_effective: null, p_changes: { no_refund_within_minutes: 2880 }, p_note: 'Synthetic changed terms, same rental price' }));
  await failure(rpc('staff', 'create_reservation', reservation({ p_expected_versions: quoted.version_context })), '22023');
  assert.equal(await count('bookings'), 0);
  await success(rpc('staff', 'create_reservation', reservation()));
});
test('missing accepted versions and the old RPC signature cannot bypass agreement checks', async () => {
  await failure(rpc('staff', 'create_reservation', reservation({ p_expected_versions: null })), '22023');
  const oldSignature = (await pool.query("select to_regprocedure('public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz)') as old")).rows[0].old;
  assert.equal(oldSignature, null);
  assert.equal((await pool.query("select has_function_privilege('anon','public.create_reservation(uuid,timestamptz,timestamptz,integer,text,uuid,integer,timestamptz,jsonb)','execute') as allowed")).rows[0].allowed, false);
});
