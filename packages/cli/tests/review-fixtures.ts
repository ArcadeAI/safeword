import { chmodSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

const trustedReviewerDirectories = new Set<string>();

export function cleanupTrustedReviewerDirectories(): void {
  for (const directory of trustedReviewerDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  trustedReviewerDirectories.clear();
}

/**
 * What a compatible reviewer advertises when asked what it supports.
 *
 * Fake reviewers must advertise every flag the runtime requires, or candidate
 * selection discards them and a test fails as `not_installed` for reasons that
 * have nothing to do with what it is testing. Adding a required capability
 * used to mean editing nine copies of these strings; it is one edit here.
 *
 * `--model` is included because the alternate-model route asks for it, even
 * though the runtime does not require it for selection.
 */
export const REVIEWER_CAPABILITIES = {
  claude: [
    '--output-format',
    '--json-schema',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--setting-sources',
    '--strict-mcp-config',
    '--tools',
    '--model',
  ].join(' '),
  codex: [
    '--json',
    '--sandbox',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--disable',
    '--config',
    '--model',
    '--output-schema',
  ].join(' '),
  opencode: ['--format', '--pure', '--model'].join(' '),
} as const satisfies Record<'claude' | 'codex' | 'opencode', string>;

/**
 * Reviewer discovery deliberately rejects executables beneath writable
 * ancestry such as /tmp. Put positive-path fake binaries under a private,
 * current-user-owned directory so tests exercise the real trust policy instead
 * of bypassing it. Rejection tests should continue to use ordinary temp roots.
 */
export function createTrustedReviewerDirectory(prefix: string): string {
  const root = nodePath.join(homedir(), '.cache', 'safeword-test-reviewers');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  chmodSync(root, 0o700);
  const directory = mkdtempSync(nodePath.join(root, prefix));
  trustedReviewerDirectories.add(directory);
  return directory;
}

// Models the trusted host worker in simulated contract tests, never live review proof.
export const SIGNED_REVIEW_COMPLETION_WORKER = String.raw`
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, openSync, closeSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const id = process.env.SAFEWORD_REVIEW_JOB_ID;
const path = join(process.cwd(), '.safeword', 'state', 'reviews', id + '.json');
// The simulated worker must serialize completion with the real parent's writes.
const lock = path + '.lock';
const deadline = Date.now() + 10000;
let lockDescriptor;
while (lockDescriptor === undefined) {
  try { lockDescriptor = openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
}
try {
writeFileSync(lockDescriptor, String(process.pid));
const record = JSON.parse(readFileSync(path, 'utf8'));
record.state = 'completed';
record.updated_at = new Date().toISOString();
record.result = {
  schemaVersion: 1, ok: true, state: 'healthy', changed: false,
  findings: [{ code: 'REVIEWER_SUMMARY', message: 'Independent review complete.', severity: 'info' }],
  effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
  errors: [], recovery: [], nextActions: [],
  data: {
    command: 'review run', status: 'approved', author_agent: 'claude',
    actual_reviewer: 'codex', independence: 'cross-agent',
    reviewer_output: {
      schema_version: 1, dispatch_id: 'fixture-dispatch', reviewer_agent: 'codex',
      verdict: 'approve', summary: 'Independent review complete.', findings: []
    }
  }
};
const canonicalProject = realpathSync.native(process.cwd());
const keyPath = join(process.env.SAFEWORD_REVIEW_KEY_ROOT, 'safeword', 'review-integrity.key');
mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
let key;
try { key = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex'); }
catch {
  key = randomBytes(32);
  try { const descriptor = openSync(keyPath, 'wx', 0o600); writeFileSync(descriptor, key.toString('hex') + '\n'); closeSync(descriptor); }
  catch { key = Buffer.from(readFileSync(keyPath, 'utf8').trim(), 'hex'); }
}
delete record.integrity;
record.integrity = createHmac('sha256', key)
  .update(canonicalProject).update('\0').update(JSON.stringify(record)).digest('hex');
writeFileSync(path + '.worker.tmp', JSON.stringify(record) + '\n', { mode: 0o600 });
renameSync(path + '.worker.tmp', path);
} finally {
  closeSync(lockDescriptor);
  unlinkSync(lock);
}
`;
