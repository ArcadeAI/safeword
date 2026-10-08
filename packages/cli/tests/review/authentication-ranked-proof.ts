import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  resumeReviewAfterAuthentication,
  reviewJobStatus,
  startReviewJob,
} from '../../src/review/job.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

// A later configured route must retain both its reviewer and model after sign-in.
const root = mkdtempSync(path.join(tmpdir(), 'safeword-ranked-auth-proof-'));
const host = createTrustedReviewerDirectory('ranked-auth-proof-');
const nodeExecutable = spawnSync('node', ['-p', 'process.execPath'], {
  encoding: 'utf8',
}).stdout.trim();
const environment = { ...process.env };
const pids = new Set<number>();
try {
  mkdirSync(path.join(root, '.safeword'));
  mkdirSync(path.join(host, 'profile'));
  mkdirSync(path.join(host, 'user'));
  writeFileSync(
    path.join(root, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReviewRoutes: {
        codex: [{ reviewer: 'opencode' }, { reviewer: 'claude', model: 'chosen-model' }],
      },
    }),
  );
  writeFileSync(path.join(root, 'input.md'), 'Ranked review input\n');
  writeFileSync(path.join(host, 'opencode'), `#!${nodeExecutable}\nprocess.exit(1);`, {
    mode: 0o755,
  });
  writeFileSync(
    path.join(host, 'claude'),
    String.raw`#!${nodeExecutable}
import {existsSync,appendFileSync} from 'node:fs';
const args=process.argv.slice(2);
if(args.includes('--help')){console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)});process.exit(0)}
let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{
if(!existsSync(${JSON.stringify(path.join(host, 'authenticated'))})){console.error('Not logged in. Please run /login');process.exit(1)}
appendFileSync(${JSON.stringify(path.join(host, 'dispatches'))},JSON.stringify(args)+'\n');
const dispatch= /"dispatch_id"\s*:\s*"([^"]+)"/.exec(input)?.[1];
console.log(JSON.stringify({structured_output:{schema_version:1,dispatch_id:dispatch,reviewer_agent:'claude',verdict:'approve',summary:'Ranked fixture.',findings:[]}}));
});`,
    { mode: 0o755 },
  );
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SAFEWORD_AGENT_RUNTIME: 'codex',
    SAFEWORD_REVIEW_FOREGROUND_MS: '0',
    SAFEWORD_REVIEW_KEY_ROOT: host,
    SAFEWORD_CLI_ENTRYPOINT: path.resolve(import.meta.dirname, '../../src/cli.ts'),
    PATH: `${host}:/usr/bin:/bin`,
    HOME: path.join(host, 'user'),
    XDG_CONFIG_HOME: path.join(host, 'user'),
    CLAUDE_CONFIG_DIR: path.join(host, 'profile'),
    ANTHROPIC_API_KEY: '',
    CLAUDE_CODE_OAUTH_TOKEN: '',
    OPENAI_API_KEY: '',
    CODEX_API_KEY: '',
  });
  const started = await startReviewJob({
    cwd: root,
    kind: 'quality-review',
    targets: ['input.md'],
  });
  const id = (started.data as { review_id: string }).review_id;
  const file = path.join(root, '.safeword/state/reviews', `${id}.json`);
  pids.add(JSON.parse(readFileSync(file, 'utf8')).pid);
  const terminal = async () => {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const result = reviewJobStatus(root, id, true);
      const data = result.data as { status: string; review_id: string };
      if (data.status !== 'pending') return result;
      if (Date.now() >= deadline)
        throw new Error(`ranked worker must settle: ${readFileSync(file, 'utf8')}`);
      await delay(10);
    }
  };
  const original = await terminal();
  if (
    (original.data as { assigned_reviewer: string }).assigned_reviewer !== 'claude' ||
    original.findings.every(item => item.code !== 'REVIEW_AUTHENTICATION_REQUIRED')
  )
    throw new Error('later route must require Claude sign-in');
  const originalBytes = readFileSync(file);
  writeFileSync(path.join(host, 'authenticated'), '');
  const retry = await resumeReviewAfterAuthentication(
    root,
    id,
    'claude',
    new AbortController().signal,
  );
  const retryId = (retry.data as { review_id: string }).review_id;
  const retryFile = path.join(root, '.safeword/state/reviews', `${retryId}.json`);
  const retryRecord = JSON.parse(readFileSync(retryFile, 'utf8')) as { pid: number };
  pids.add(retryRecord.pid);
  const final = await terminal();
  if ((final.data as { status: string }).status !== 'approved')
    throw new Error(
      `later authenticated route must resume on its assigned model: ${JSON.stringify(final)}`,
    );
  const dispatches = readFileSync(path.join(host, 'dispatches'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as string[]);
  if (
    dispatches.length !== 1 ||
    dispatches[0]?.[dispatches[0].indexOf('--model') + 1] !== 'chosen-model'
  )
    throw new Error('one assigned-model dispatch must occur');
  if (!readFileSync(file).equals(originalBytes))
    throw new Error('original ranked receipt must stay unchanged');
  console.log('PASS: later route resumes once on its assigned reviewer and model');
} finally {
  for (const pid of pids) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* Owned worker may already have exited. */
    }
  }
  for (const key of Object.keys(process.env))
    if (!Object.hasOwn(environment, key)) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, environment);
  rmSync(root, { recursive: true, force: true });
  cleanupTrustedReviewerDirectories();
}
