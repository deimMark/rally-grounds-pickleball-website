import { readFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
// Compare actual local bindings without printing them. This scans browser artifacts only.
try {
  const env = { ...parseEnv(readFileSync('.env.local', 'utf8')), ...process.env };
  const values = ['SUPABASE_GUEST_SERVICE_KEY', 'GUEST_RATE_HMAC_KEY'].map(name => env[name]);
  if (values.some(value => !value || value.length < 32)) throw new Error('Private bindings unavailable');
  const files = [];
  const visit = path => { for (const entry of readdirSync(path, { withFileTypes: true })) { const file = join(path, entry.name); if (entry.isDirectory()) visit(file); else if (/\.(js|map)$/.test(entry.name)) files.push(file); } };
  visit('.next/static');
  if (!files.length) throw new Error('No browser assets');
  if (files.some(file => values.some(value => readFileSync(file, 'utf8').includes(value)))) throw new Error('Private binding in browser artifact');
  console.log(`Client bundle scan passed for ${files.length} JS/map artifacts; actual private binding values suppressed. Scoped evidence, not proof of every secret format.`);
} catch { console.error('Client bundle secret scan failed; inspect local bindings/artifacts privately. No values printed.'); process.exitCode = 1; }
