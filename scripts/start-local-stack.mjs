import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, chmodSync } from 'node:fs';
import { cliEnvironment, assertLocalProject, projectRoot } from './local-settings.mjs';
// BusyBox wget ignores no_proxy in the cloud's injected proxy environment. Keep the
// real health check, routing ONLY its exact loopback URL directly. All external
// destinations keep the normal proxy and TLS behavior. Applied to this local Auth
// container only; no production/remote container is touched.
const healthWrapper = `#!/bin/sh
case "$*" in
  *http://127.0.0.1:9999/health*) exec /usr/bin/wget -Y off "$@" ;;
  *) exec /usr/bin/wget "$@" ;;
esac
`;
export async function startLocalStack() {
  assertLocalProject();
  const child = spawn(process.execPath, ['node_modules/supabase/dist/supabase.js', 'start', '-x', 'studio,storage-api,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta,mailpit'], { cwd: projectRoot, env: cliEnvironment, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let patched = false;
  child.stdout.on('data', (value) => { output += value; });
  child.stderr.on('data', (value) => { output += value; });
  const timer = setInterval(() => {
    if (patched) return;
    try {
      execFileSync('docker', ['exec', 'supabase_auth_rally-grounds-local', 'wget', '-q', '--spider', 'http://127.0.0.1:9999/health'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 1000 });
    } catch (error) {
      if (!error.stderr?.toString().includes('403')) return;
      try {
        writeFileSync('/tmp/rally-local-health-wget', healthWrapper, { mode: 0o755 });
        chmodSync('/tmp/rally-local-health-wget', 0o755);
        execFileSync('docker', ['cp', '/tmp/rally-local-health-wget', 'supabase_auth_rally-grounds-local:/usr/local/bin/wget'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 2000 });
        patched = true;
      } catch { /* A container may be recreated while startup is polling. Retry. */ }
    }
  }, 500);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    writeFileSync('/tmp/rally-local-stack.log', output, { mode: 0o600 });
    if (code !== 0) throw new Error('Local stack startup failed; see private /tmp/rally-local-stack.log');
    console.log(`Local stack health checks passed${patched ? ' (loopback-only BusyBox proxy correction applied)' : ''}.`);
  } finally { clearInterval(timer); }
}
