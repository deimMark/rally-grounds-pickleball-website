import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const cliEnvironment = { ...process.env, SUPABASE_HOME: process.env.SUPABASE_HOME || '/tmp/rally-supabase-home', SUPABASE_TELEMETRY_DISABLED: 'true', SUPABASE_USE_SLIM_IMAGES: 'true' };
export function assertLocalProject() {
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  if (!config.includes('project_id = "rally-grounds-local"')) throw new Error('Expected the designated local project');
}
export function runCLI(args) {
  assertLocalProject();
  try {
    return execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { cwd: projectRoot, env: cliEnvironment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    writeFileSync('/tmp/rally-local-cli-error.log', error.stderr || 'Local command failed', { mode: 0o600 });
    throw new Error('Local Supabase command failed; private diagnostics: /tmp/rally-local-cli-error.log');
  }
}
export function localSettings() {
  const settings = JSON.parse(runCLI(['status', '-o', 'json']));
  const api = new URL(settings.API_URL);
  const db = new URL(settings.DB_URL);
  if (api.hostname !== '127.0.0.1' || api.port !== '54321' || db.hostname !== '127.0.0.1' || db.port !== '54322' || db.pathname !== '/postgres') throw new Error('Refusing nonlocal database or Auth administration');
  return { ...settings, publicKey: settings.PUBLISHABLE_KEY || settings.ANON_KEY, adminKey: settings.SECRET_KEY || settings.SERVICE_ROLE_KEY };
}
