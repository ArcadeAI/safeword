import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { createResult } from '../../src/cli-protocol/result.js';
import { completeReviewJob, reviewJobStatus, startReviewJob } from '../../src/review/job.js';

// Standalone signed-job contract proof. Synthetic workers isolate the provider boundary.
const root = mkdtempSync(path.join(tmpdir(), 'safeword-auth-retry-proof-'));
const keyRoot = mkdtempSync(path.join(tmpdir(), 'safeword-auth-retry-proof-key-'));
const pids = new Set<number>();
process.env.NODE_ENV = 'test';
process.env.SAFEWORD_AGENT_RUNTIME = 'codex';
process.env.SAFEWORD_REVIEW_FOREGROUND_MS = '0';
process.env.SAFEWORD_REVIEW_KEY_ROOT = keyRoot;
mkdirSync(path.join(root, '.safeword'));
writeFileSync(path.join(root, '.safeword/config.json'), '{}');
writeFileSync(path.join(root, 'input.md'), 'Original signed request\n');
const waiting = path.join(keyRoot, 'waiting.mjs');
writeFileSync(waiting, 'setInterval(() => {}, 1000);');
process.env.SAFEWORD_CLI_ENTRYPOINT = waiting;
const request = { cwd: root, kind: 'quality-review' as const, targets: ['input.md'] };
const idOf = (result: { data?: unknown }) => (result.data as { review_id: string }).review_id;
try {
  const parentId = idOf(await startReviewJob(request));
  const receipt = path.join(root, '.safeword/state/reviews', `${parentId}.json`);
  pids.add(JSON.parse(readFileSync(receipt, 'utf8')).pid);
  completeReviewJob(
    root,
    parentId,
    createResult({
      state: 'action_required',
      findings: [
        { code: 'REVIEW_AUTHENTICATION_REQUIRED', severity: 'warning', message: 'Sign in.' },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        assigned_reviewer: 'claude',
        author_agent: 'codex',
      },
    }),
  );
  const original = readFileSync(receipt);
  const worker = path.join(keyRoot, 'completed.mjs');
  const verdict = createResult({
    state: 'healthy',
    data: {
      command: 'review run',
      status: 'approved',
      reviewer_output: {
        dispatch_id: 'synthetic-worker',
        reviewer_agent: 'claude',
        verdict: 'approve',
        summary: 'Synthetic worker contract.',
        findings: [],
      },
    },
  });
  writeFileSync(
    worker,
    String.raw`
import {readFileSync,writeFileSync,renameSync,appendFileSync,realpathSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const id=process.env.SAFEWORD_REVIEW_JOB_ID;
const file=path.join(process.cwd(),'.safeword/state/reviews',id+'.json');
const record=JSON.parse(readFileSync(file,'utf8'));
appendFileSync(${JSON.stringify(path.join(keyRoot, 'dispatches'))},id+'\n');
record.state='completed';record.updated_at=new Date().toISOString();record.result=${JSON.stringify(verdict)};
delete record.integrity;
const key=Buffer.from(readFileSync(${JSON.stringify(path.join(keyRoot, 'safeword/review-integrity.key'))},'utf8').trim(),'hex');
record.integrity=createHmac('sha256',key).update(realpathSync.native(process.cwd())).update('\0').update(JSON.stringify(record)).digest('hex');
writeFileSync(file+'.tmp',JSON.stringify(record));renameSync(file+'.tmp',file);
`,
  );
  process.env.SAFEWORD_CLI_ENTRYPOINT = worker;
  const input = {
    ...request,
    authenticationRetry: {
      parent: parentId,
      reviewer: 'claude' as const,
      signal: new AbortController().signal,
    },
  };
  const first = idOf(await startReviewJob(input));
  const deadline = Date.now() + 5000;
  while ((reviewJobStatus(root, first, true).data as { status: string }).status !== 'approved') {
    if (Date.now() >= deadline)
      throw new Error('synthetic worker must produce a valid approved receipt');
    await delay(10);
  }
  const repeated = idOf(await startReviewJob(input));
  if (repeated !== first) throw new Error('automatic retry completions must share one attempt');
  if (!readFileSync(receipt).equals(original))
    throw new Error('original receipt must remain byte-identical');
  const child = JSON.parse(
    readFileSync(path.join(root, '.safeword/state/reviews', `${first}.json`), 'utf8'),
  );
  if (child.retry_of !== parentId) throw new Error('retry receipt must name the original');
  if (!existsSync(path.join(keyRoot, 'dispatches')))
    throw new Error('retry must dispatch a worker');
  if (readFileSync(path.join(keyRoot, 'dispatches'), 'utf8').trim().split('\n').length !== 1)
    throw new Error('one worker must dispatch');
  console.log('PASS: one linked attempt, unchanged original, valid signed verdict');
} finally {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* Owned worker already exited. */
    }
  }
  rmSync(root, { recursive: true, force: true });
  rmSync(keyRoot, { recursive: true, force: true });
}
