import { writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { runCLI, localSettings, projectRoot } from './local-settings.mjs';
import { startLocalStack } from './start-local-stack.mjs';
const operation = process.argv[2];
const environmentFile = `${projectRoot}/.env.local`;
try {
  if (operation === 'start') {
    await startLocalStack();
  } else if (operation === 'reset') {
    runCLI(['db', 'reset', '--local', '--yes']);
  } else if (operation === 'migrate') {
    runCLI(['migration', 'up', '--local']);
  } else if (operation === 'stop') {
    runCLI(['stop']);
  } else if (operation !== 'configure') throw new Error('Use start, reset, migrate, configure or stop');
  if (operation !== 'stop') {
    const settings = localSettings();
    let contents = existsSync(environmentFile) ? readFileSync(environmentFile, 'utf8') : '# Generated local-only connection; never commit.\n';
    const previous = parseEnv(contents);
    if (previous.SUPABASE_URL && previous.SUPABASE_URL !== settings.API_URL) throw new Error('Refusing to replace an existing different Supabase connection');
    const values = { SUPABASE_URL: settings.API_URL, SUPABASE_PUBLISHABLE_KEY: settings.publicKey, APP_ORIGIN: previous.APP_ORIGIN || 'http://127.0.0.1:3000' };
    for (const [name, value] of Object.entries(values)) {
      const pattern = new RegExp(`^${name}=.*$`, 'm');
      contents = pattern.test(contents) ? contents.replace(pattern, `${name}=${value}`) : contents.trimEnd() + `\n${name}=${value}\n`;
    }
    writeFileSync(environmentFile, contents, { mode: 0o600 });
    chmodSync(environmentFile, 0o600);
  }
  console.log(`Local Supabase ${operation} completed. Credentials were not printed.`);
} catch (error) {
  // CLI status/start output may contain credentials; retain it only in a private local log.
  writeFileSync('/tmp/rally-local-supabase-error.log', error.stderr || error.message, { mode: 0o600 });
  console.error('Local Supabase operation failed. Private diagnostics: /tmp/rally-local-supabase-error.log');
  process.exitCode = 1;
}
