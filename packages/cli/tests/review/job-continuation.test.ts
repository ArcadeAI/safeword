import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CliResult, createResult } from '../../src/cli-protocol/result.js';
import * as jobs from '../../src/review/job.js';
import type * as runtime from '../../src/review/runtime.js';
import { trustedReviewerExecutable } from '../../src/review/runtime.js';

vi.mock('../../src/review/runtime.js', async importOriginal => ({
  ...(await importOriginal<typeof runtime>()),
  trustedReviewerExecutable: vi.fn(),
}));

const continuation = jobs as typeof jobs & {
  resumeReviewAfterAuthentication(
    cwd: string,
    id: string,
    reviewer: 'claude' | 'codex',
    signal: AbortSignal,
  ): Promise<CliResult>;
};
const roots: string[] = [];
const workerPids = new Set<number>();

afterEach(() => {
  for (const pid of workerPids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* Worker already exited. */
    }
  }
  workerPids.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function authResult(): CliResult {
  return createResult({
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
  });
}

async function original(options: { retryAuth?: boolean; holdRetry?: boolean } = {}) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-job-continuation-'));
  roots.push(root);
  mkdirSync(nodePath.join(root, '.safeword'));
  writeFileSync(nodePath.join(root, '.safeword/config.json'), '{}');
  writeFileSync(nodePath.join(root, 'input.md'), 'original request\n');
  writeFileSync(nodePath.join(root, 'context.md'), 'original context\n');
  const keyRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-continuation-key-'));
  roots.push(keyRoot);
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keyRoot);
  vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
  vi.stubEnv('SAFEWORD_AGENT_RUNTIME', 'codex');
  const executable = nodePath.join(keyRoot, 'reviewer');
  writeFileSync(executable, 'trusted vendor executable\n');
  vi.mocked(trustedReviewerExecutable).mockReturnValue(executable);
  const waitingWorker = nodePath.join(keyRoot, 'waiting.mjs');
  writeFileSync(waitingWorker, 'setInterval(() => {}, 1000);');
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', waitingWorker);
  const pending = await jobs.startReviewJob({
    cwd: root,
    kind: 'quality-review',
    targets: ['input.md'],
    context: ['context.md'],
  });
  const id = (pending.data as { review_id: string }).review_id;
  const directory = nodePath.join(root, '.safeword/state/reviews');
  const receipt = nodePath.join(directory, `${id}.json`);
  const record = JSON.parse(readFileSync(receipt, 'utf8')) as { pid: number };
  workerPids.add(record.pid);
  jobs.completeReviewJob(root, id, authResult());
  const originalBytes = readFileSync(receipt);
  const worker = nodePath.join(keyRoot, 'completed.mjs');
  writeFileSync(
    worker,
    String.raw`
import {readFileSync,writeFileSync,appendFileSync,renameSync,existsSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {realpathSync} from 'node:fs';
import path from 'node:path';
const id=process.env.SAFEWORD_REVIEW_JOB_ID;
const file=path.join(process.cwd(),'.safeword/state/reviews',id+'.json');
const record=JSON.parse(readFileSync(file,'utf8'));
appendFileSync(${JSON.stringify(nodePath.join(keyRoot, 'dispatches'))},id+'\n');
${options.holdRetry ? `while (!existsSync(${JSON.stringify(nodePath.join(keyRoot, 'release-retry'))})) await new Promise(resolve => setTimeout(resolve, 10));` : ''}
record.state='completed';record.updated_at=new Date().toISOString();
record.result=${JSON.stringify(options.retryAuth ? authResult() : createResult({ state: 'healthy', data: { command: 'review run', status: 'approved' } }))};
delete record.integrity;
const key=Buffer.from(readFileSync(${JSON.stringify(nodePath.join(keyRoot, 'safeword/review-integrity.key'))},'utf8').trim(),'hex');
record.integrity=createHmac('sha256',key).update(realpathSync.native(process.cwd())).update('\0').update(JSON.stringify(record)).digest('hex');
writeFileSync(file+'.tmp',JSON.stringify(record)+'\n');renameSync(file+'.tmp',file);
`,
  );
  vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
  return {
    root,
    id,
    receipt,
    originalBytes,
    directory,
    keyRoot,
    executable,
    signal: new AbortController().signal,
  };
}

describe('signed authentication continuation', () => {
  it('reuses the completed automatic attempt instead of paying for another review', async () => {
    const request = await original();
    const start = jobs.startReviewJob as (
      input: Parameters<typeof jobs.startReviewJob>[0] & {
        authenticationRetry: { parent: string; reviewer: 'claude'; signal: AbortSignal };
      },
    ) => Promise<CliResult>;
    const input = {
      cwd: request.root,
      kind: 'quality-review' as const,
      targets: ['input.md'],
      context: ['context.md'],
      authenticationRetry: {
        parent: request.id,
        reviewer: 'claude' as const,
        signal: request.signal,
      },
    };
    const first = await start(input);
    const firstId = (first.data as { review_id: string }).review_id;
    await vi.waitFor(() => {
      expect(
        (jobs.reviewJobStatus(request.root, firstId, true).data as { status: string }).status,
      ).toBe('approved');
    });
    const repeated = await start(input);
    expect(
      (repeated.data as { review_id: string }).review_id,
      'automatic retry completions must share one attempt',
    ).toBe(firstId);
  });

  it('observes the original before, during and after retry without writing receipts', async () => {
    const request = await original({ holdRetry: true });
    expect(
      (jobs.reviewJobStatus(request.root, request.id, true).data as { status: string }).status,
    ).toBe('blocked');
    const pending = await continuation.resumeReviewAfterAuthentication(
      request.root,
      request.id,
      'claude',
      request.signal,
    );
    const retryId = (pending.data as { review_id: string }).review_id;
    await vi.waitFor(() => {
      expect(existsSync(nodePath.join(request.keyRoot, 'dispatches'))).toBe(true);
    });
    const snapshot = () =>
      readdirSync(request.directory)
        .filter(name => name.endsWith('.json'))
        .map(name => [name, readFileSync(nodePath.join(request.directory, name), 'utf8')]);
    const before = snapshot();
    const status = jobs.reviewJobStatus(request.root, request.id, true);
    expect(status.data).toMatchObject({ status: 'pending', review_id: retryId });
    expect(snapshot()).toEqual(before);
    writeFileSync(nodePath.join(request.keyRoot, 'release-retry'), '');
    await vi.waitFor(() => {
      expect(
        (jobs.reviewJobStatus(request.root, request.id, true).data as { status: string }).status,
      ).toBe('approved');
    });
    const completed = snapshot();
    expect(jobs.reviewJobStatus(request.root, request.id, true).data).toMatchObject({
      status: 'approved',
      review_id: retryId,
    });
    expect(snapshot()).toEqual(completed);
  });

  it('claims one linked attempt for concurrent and sequential completion, preserving the original', async () => {
    const request = await original();
    const attempts = await Promise.all(
      [1, 2].map(() =>
        continuation.resumeReviewAfterAuthentication(
          request.root,
          request.id,
          'claude',
          request.signal,
        ),
      ),
    );
    const ids = attempts.map(result => (result.data as { review_id: string }).review_id);
    expect(new Set(ids).size, 'confirmed request must create exactly one linked retry').toBe(1);
    expect(ids[0]).not.toBe(request.id);
    await vi.waitFor(() => {
      expect(
        (jobs.reviewJobStatus(request.root, request.id, true).data as { status: string }).status,
      ).toBe('approved');
    });
    const repeated = await continuation.resumeReviewAfterAuthentication(
      request.root,
      request.id,
      'claude',
      request.signal,
    );
    expect((repeated.data as { review_id: string }).review_id).toBe(ids[0]);
    expect(readFileSync(request.receipt)).toEqual(request.originalBytes);
    expect(
      readFileSync(nodePath.join(request.keyRoot, 'dispatches'), 'utf8').trim().split('\n'),
    ).toEqual([ids[0]]);
    const retry = JSON.parse(
      readFileSync(nodePath.join(request.directory, `${ids[0]}.json`), 'utf8'),
    ) as { retry_of: string };
    expect(retry.retry_of).toBe(request.id);
  });

  it.each(['target', 'context', 'policy', 'executable', 'receipt', 'profile'] as const)(
    'rejects %s drift without creating a retry',
    async change => {
      const request = await original();
      const paths = { target: 'input.md', context: 'context.md', policy: '.safeword/config.json' };
      if (Object.hasOwn(paths, change))
        writeFileSync(nodePath.join(request.root, paths[change as keyof typeof paths]), 'changed');
      else if (change === 'executable') writeFileSync(request.executable, 'updated vendor');
      else if (change === 'receipt') writeFileSync(request.receipt, '{}');
      else vi.stubEnv('CLAUDE_CONFIG_DIR', request.root);
      await expect(
        continuation.resumeReviewAfterAuthentication(
          request.root,
          request.id,
          'claude',
          request.signal,
        ),
      ).rejects.toThrow();
      expect(readdirSync(request.directory).filter(name => name.endsWith('.json'))).toHaveLength(1);
      expect(existsSync(nodePath.join(request.keyRoot, 'dispatches'))).toBe(false);
    },
  );

  it('rejects cancelled continuation and second authentication failure', async () => {
    const request = await original({ retryAuth: true });
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      continuation.resumeReviewAfterAuthentication(
        request.root,
        request.id,
        'claude',
        cancelled.signal,
      ),
    ).rejects.toThrow();
    const child = await continuation.resumeReviewAfterAuthentication(
      request.root,
      request.id,
      'claude',
      request.signal,
    );
    const childId = (child.data as { review_id: string }).review_id;
    await vi.waitFor(() => {
      expect(
        (jobs.reviewJobStatus(request.root, request.id, true).data as { status: string }).status,
      ).toBe('blocked');
    });
    await expect(
      continuation.resumeReviewAfterAuthentication(request.root, childId, 'claude', request.signal),
    ).rejects.toThrow();
  });
});
