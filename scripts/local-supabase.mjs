import { writeFileSync } from 'node:fs';
import { runCLI, localSettings } from './local-settings.mjs';
import { startLocalStack } from './start-local-stack.mjs';
const operation = process.argv[2];
try {
  if (operation === 'start') {
    await startLocalStack();
  } else if (operation === 'reset') {
    runCLI(['db', 'reset', '--local', '--yes']);
  } else if (operation === 'stop') {
    runCLI(['stop']);
  } else if (operation !== 'configure') throw new Error('Use start, reset, configure or stop');
  if (operation !== 'stop') {
    const settings = localSettings();
    writeFileSync('.env.local', `# Generated local-only connection; never commit.\nSUPABASE_URL=${settings.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${settings.publicKey}\nAPP_ORIGIN=http://127.0.0.1:3000\n`, { mode: 0o600 });
  }
  console.log(`Local Supabase ${operation} completed. Credentials were not printed.`);
} catch (error) {
  // CLI status/start output may contain credentials; retain it only in a private local log.
  writeFileSync('/tmp/rally-local-supabase-error.log', error.stderr || error.message, { mode: 0o600 });
  console.error('Local Supabase operation failed. Private diagnostics: /tmp/rally-local-supabase-error.log');
  process.exitCode = 1;
}
