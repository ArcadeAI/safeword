import {
  chmodSync,
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
import { setTimeout as delay } from 'node:timers/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CliResult, createResult } from '../../src/cli-protocol/result.js';
import {
  cancelAllReviewerLogins,
  startReviewerLogin,
} from '../../src/codex-plugin/reviewer-login.js';
import * as jobs from '../../src/review/job.js';
import type * as runtime from '../../src/review/runtime.js';
import { trustedReviewerExecutable } from '../../src/review/runtime.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

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
  cancelAllReviewerLogins();
  cleanupTrustedReviewerDirectories();
  vi.useRealTimers();
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
record.result=${JSON.stringify(options.retryAuth ? authResult() : createResult({ state: 'healthy', data: { command: 'review run', status: 'approved', reviewer_output: { dispatch_id: 'fixture-dispatch', reviewer_agent: 'claude', verdict: 'approve', summary: 'Reviewed.', findings: [] } } }))};
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
  it('rejects a structurally valid receipt whose signed request was tampered with', async () => {
    const request = await original();
    const record = JSON.parse(readFileSync(request.receipt, 'utf8')) as { targets: string[] };
    record.targets = ['context.md'];
    writeFileSync(request.receipt, JSON.stringify(record));
    await expect(
      continuation.resumeReviewAfterAuthentication(
        request.root,
        request.id,
        'claude',
        request.signal,
      ),
    ).rejects.toThrow('invalid review job record');
    expect(readdirSync(request.directory).filter(name => name.endsWith('.json'))).toHaveLength(1);
    expect(existsSync(nodePath.join(request.keyRoot, 'dispatches'))).toBe(false);
  });

  it.each(['model', 'vendor environment'] as const)(
    'rejects changed %s controls before dispatch',
    async control => {
      const request = await original();
      vi.stubEnv(
        control === 'model' ? 'SAFEWORD_REVIEW_PRIMARY_MODEL_CLAUDE' : 'HTTPS_PROXY',
        'changed-control',
      );
      await expect(
        continuation.resumeReviewAfterAuthentication(
          request.root,
          request.id,
          'claude',
          request.signal,
        ),
      ).rejects.toThrow(/execution context changed/u);
      expect(readdirSync(request.directory).filter(name => name.endsWith('.json'))).toHaveLength(1);
      expect(existsSync(nodePath.join(request.keyRoot, 'dispatches'))).toBe(false);
    },
  );

  it.each(['source', 'executable'] as const)(
    'rechecks %s after the real worker capability probe',
    async change => {
      const request = await original();
      const vendorRoot = createTrustedReviewerDirectory('continuation-worker-');
      const executable = nodePath.join(vendorRoot, 'claude');
      const held = nodePath.join(vendorRoot, 'probe-held');
      const release = nodePath.join(vendorRoot, 'release-probe');
      const dispatches = nodePath.join(vendorRoot, 'paid-dispatches');
      const source = `#!${process.execPath}
const fs=require('node:fs');
if(process.argv.includes('--help')) {
  fs.writeFileSync(${JSON.stringify(held)},'');
  const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)});process.exit(0)}},5);
} else {
  fs.writeFileSync(${JSON.stringify(dispatches)},'paid');
  process.stdin.resume();process.stdin.on('end',()=>process.exit(1));
}
`;
      writeFileSync(executable, source, { mode: 0o755 });
      vi.mocked(trustedReviewerExecutable).mockReturnValue(executable);
      vi.stubEnv('SAFEWORD_REVIEW_CLAUDE_PATH', executable);
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', nodePath.join(request.keyRoot, 'waiting.mjs'));
      const parent = await jobs.startReviewJob({
        cwd: request.root,
        kind: 'quality-review',
        targets: ['input.md'],
        context: ['context.md'],
      });
      const id = (parent.data as { review_id: string }).review_id;
      const parentRecord = JSON.parse(
        readFileSync(nodePath.join(request.directory, `${id}.json`), 'utf8'),
      ) as { pid: number };
      workerPids.add(parentRecord.pid);
      jobs.completeReviewJob(request.root, id, authResult());
      vi.stubEnv(
        'SAFEWORD_CLI_ENTRYPOINT',
        nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      );
      const resumed = await continuation.resumeReviewAfterAuthentication(
        request.root,
        id,
        'claude',
        request.signal,
      );
      const retryId = (resumed.data as { review_id: string }).review_id;
      await vi.waitFor(
        () => {
          expect(existsSync(held)).toBe(true);
        },
        { timeout: 10_000 },
      );
      if (change === 'source')
        writeFileSync(nodePath.join(request.root, 'input.md'), 'changed source');
      else writeFileSync(executable, `${source}\n// changed bytes\n`);
      writeFileSync(release, '');
      await vi.waitFor(
        () => {
          const record = JSON.parse(
            readFileSync(nodePath.join(request.directory, `${retryId}.json`), 'utf8'),
          ) as { state: string };
          expect(['completed', 'failed']).toContain(record.state);
        },
        { timeout: 10_000 },
      );
      expect(existsSync(dispatches)).toBe(false);
      expect(
        (jobs.reviewJobStatus(request.root, retryId, true).data as { status: string }).status,
      ).not.toBe('approved');
    },
  );

  it('leaves no receipt or dispatched worker when cancellation already won', async () => {
    const request = await original();
    const cancellation = new AbortController();
    cancellation.abort();
    await expect(
      continuation.resumeReviewAfterAuthentication(
        request.root,
        request.id,
        'claude',
        cancellation.signal,
      ),
    ).rejects.toThrow();
    expect(readdirSync(request.directory).filter(name => name.endsWith('.json'))).toHaveLength(1);
    expect(existsSync(nodePath.join(request.keyRoot, 'dispatches'))).toBe(false);
    expect(readFileSync(request.receipt)).toEqual(request.originalBytes);
  });

  it('follows a completed second authentication failure and never starts a third attempt', async () => {
    const request = await original({ retryAuth: true });
    const result = await continuation.resumeReviewAfterAuthentication(
      request.root,
      request.id,
      'claude',
      request.signal,
    );
    const childId = (result.data as { review_id: string }).review_id;
    await vi.waitFor(() => {
      expect(jobs.reviewJobStatus(request.root, childId, true).data).toMatchObject({
        status: 'blocked',
        review_id: childId,
      });
      const record = JSON.parse(
        readFileSync(nodePath.join(request.directory, `${childId}.json`), 'utf8'),
      ) as { state: string };
      expect(record.state).toBe('completed');
    });
    expect(jobs.reviewJobStatus(request.root, request.id, true).data).toMatchObject({
      status: 'blocked',
      review_id: childId,
    });
    const repeated = await continuation.resumeReviewAfterAuthentication(
      request.root,
      request.id,
      'claude',
      request.signal,
    );
    expect((repeated.data as { review_id: string }).review_id).toBe(childId);
    await expect(
      continuation.resumeReviewAfterAuthentication(request.root, childId, 'claude', request.signal),
    ).rejects.toThrow();
    expect(readdirSync(request.directory).filter(name => name.endsWith('.json'))).toHaveLength(2);
    expect(
      readFileSync(nodePath.join(request.keyRoot, 'dispatches'), 'utf8').trim().split('\n'),
    ).toEqual([childId]);
    expect(readFileSync(request.receipt)).toEqual(request.originalBytes);
  });

  it('finishes the real linked worker when sign-in completes at 9:59', async () => {
    const request = await original();
    const profile = nodePath.join(request.keyRoot, 'profile');
    mkdirSync(profile);
    vi.stubEnv('CLAUDE_CONFIG_DIR', profile);
    for (const variable of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'])
      vi.stubEnv(variable, '');
    const release = nodePath.join(request.keyRoot, 'release-login');
    writeFileSync(
      request.executable,
      `#!/usr/bin/env node
const fs=require('node:fs');
if(process.argv.includes('status')) {
  console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',configDirectory:process.env.CLAUDE_CONFIG_DIR}));
} else {
  console.log('Open https://claude.com/cai/oauth/authorize?state=fixture');
  const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);process.exit(0)}},5);
}
`,
    );
    chmodSync(request.executable, 0o755);
    // This request captures the final executable and profile before sign-in begins.
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', nodePath.join(request.keyRoot, 'waiting.mjs'));
    const started = await jobs.startReviewJob({
      cwd: request.root,
      kind: 'quality-review',
      targets: ['input.md'],
      context: ['context.md'],
    });
    const id = (started.data as { review_id: string }).review_id;
    const owned = JSON.parse(
      readFileSync(nodePath.join(request.directory, `${id}.json`), 'utf8'),
    ) as { pid: number };
    workerPids.add(owned.pid);
    jobs.completeReviewJob(request.root, id, authResult());
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', nodePath.join(request.keyRoot, 'completed.mjs'));
    const receipt = nodePath.join(request.directory, `${id}.json`);
    const bytes = readFileSync(receipt);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await startReviewerLogin(`${request.root}:${id}`, 'claude', request.root, {
      onAuthenticated: async signal => {
        await continuation.resumeReviewAfterAuthentication(request.root, id, 'claude', signal);
      },
    });
    await vi.advanceTimersByTimeAsync(599_000);
    writeFileSync(release, '');
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
      const result = jobs.reviewJobStatus(request.root, id, true);
      if ((result.data as { status: string }).status === 'approved') break;
      await delay(10);
    }
    expect(jobs.reviewJobStatus(request.root, id, true).data).toMatchObject({ status: 'approved' });
    expect(readFileSync(receipt)).toEqual(bytes);
  });

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
