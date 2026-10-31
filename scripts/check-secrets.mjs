import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const staged = process.argv.includes('--staged');
const paths = staged
  ? execFileSync('git', ['diff', '--cached', '--diff-filter=ACMR', '--name-only', '-z']).toString().split('\0').filter(Boolean)
  : [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean))];
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})/,
  /sb_secret_[A-Za-z0-9_-]{24,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/,
];
let checked = 0; const failures = [];
for (const path of paths) {
  if ((!staged && !existsSync(path)) || /\.(png|jpg|jpeg|webp)$/.test(path)) continue;
  const content = staged ? execFileSync('git', ['show', `:${path}`]).toString() : readFileSync(path, 'utf8');
  checked++;
  if (patterns.some((pattern) => pattern.test(content))) failures.push(path);
  if (path === '.env.example' && content.split('\n').some((line) => /^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=.+/.test(line))) failures.push(path);
  if (path !== '.env.example' && /(^|\/)\.env(?:\.|$)/.test(path)) failures.push(path);
}
if (failures.length) { console.error('Review credential candidates (values suppressed):', [...new Set(failures)]); process.exitCode = 1; }
else console.log(`Credential-pattern check passed for ${checked} ${staged ? 'staged' : 'source'} text files. This is a scoped scan, not proof of every possible secret format.`);
