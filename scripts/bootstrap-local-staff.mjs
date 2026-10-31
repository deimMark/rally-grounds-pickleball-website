import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { localSettings, projectRoot } from './local-settings.mjs';
const settings = localSettings();
const admin = createClient(settings.API_URL, settings.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: settings.DB_URL });
await db.connect();
try {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error('Local Auth user listing failed');
  const output = ['# Synthetic local test identities. Never commit.'];
  for (const [label, role, active] of [['owner', 'owner', true], ['staff', 'staff', true], ['inactive', 'staff', false], ['outsider', null, true], ['revocable', 'staff', true]]) {
    const email = `${label}@rally.test`;
    const password = `${randomBytes(24).toString('base64url')}aA1!`;
    let user = data.users.find((item) => item.email === email);
    const result = user
      ? await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true })
      : await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw new Error('Synthetic local identity setup failed');
    user = result.data.user;
    if (role) {
      await db.query('insert into public.staff_profiles(user_id,role,active) values($1,$2,$3) on conflict(user_id) do update set role=excluded.role,active=excluded.active', [user.id, role, active]);
    }
    output.push(`TEST_${label.toUpperCase()}_EMAIL=${email}`, `TEST_${label.toUpperCase()}_PASSWORD=${password}`, `TEST_${label.toUpperCase()}_ID=${user.id}`);
  }
  await db.query("insert into public.audit_events(action,entity_type,metadata) values('local.bootstrap','staff_profile','{\"synthetic\":true}')");
  writeFileSync(`${projectRoot}/.env.test.local`, output.join('\n') + '\n', { mode: 0o600 });
  console.log('Synthetic local staff created; credentials saved only to ignored .env.test.local.');
} finally { await db.end(); }
