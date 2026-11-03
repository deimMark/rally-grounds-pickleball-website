import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { localSettings, projectRoot } from './local-settings.mjs';
const path = `${projectRoot}/.env.local`;
try {
  const settings = localSettings(); // Exact designated localhost DB/API only.
  let contents = readFileSync(path, 'utf8');
  const previous = parseEnv(contents);
  const key = previous.GUEST_RATE_HMAC_KEY || randomBytes(32).toString('hex');
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Invalid local key binding');
  const fixture = JSON.parse(readFileSync(`${projectRoot}/supabase/guest-security.local.json`, 'utf8'));
  const client = new pg.Client({ connectionString: settings.DB_URL });
  await client.connect();
  try {
    await client.query(`update private.guest_security_config set enabled=true, purpose=$1,
      create_ttl_seconds=$2,access_ttl_seconds=$3,window_seconds=$4,max_requests=$5,
      max_active_intents=$6,max_cookie_count=$7,retention_seconds=$8,key_fingerprint=$9 where singleton`,
    [fixture.purpose,fixture.create_ttl_seconds,fixture.access_ttl_seconds,fixture.window_seconds,fixture.max_requests,
      fixture.max_active_intents,fixture.max_cookie_count,fixture.retention_seconds,createHash('sha256').update(Buffer.from(key,'hex')).digest('hex')]);
  } finally { await client.end(); }
  const values = { GUEST_INTENTS_ENABLED: 'true', GUEST_NETWORK_MODE: 'local-shared', GUEST_RATE_HMAC_KEY: key, SUPABASE_GUEST_SERVICE_KEY: settings.adminKey };
  for (const [name,value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    contents = pattern.test(contents) ? contents.replace(pattern, `${name}=${value}`) : contents.trimEnd()+`\n${name}=${value}\n`;
  }
  writeFileSync(path,contents,{mode:0o600});chmodSync(path,0o600);
  console.log('Synthetic local guest admission configured; private bindings were not printed. No guest booking enabled.');
} catch {
  console.error('Local guest configuration failed; verify local migrations and private bindings.');process.exitCode=1;
}
