import type * as ChildProcess from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { cancelReviewJob, reviewJobStatus, startReviewJob } from '../../src/review/job.js';

const inspection = vi.hoisted(() => ({ budgets: [] as number[], pids: [] as number[] }));
// Replace only OS process inspection. Git, worker launch, job storage and signing stay real.
vi.mock('node:child_process', async original => {
  const actual = await original<typeof ChildProcess>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      const child = actual.spawn(...args);
      const workerArguments = args[1];
      if (
        child.pid !== undefined &&
        Array.isArray(workerArguments) &&
        workerArguments[0] === process.env.SAFEWORD_CLI_ENTRYPOINT &&
        args[2]?.detached === true
      )
        inspection.pids.push(child.pid);
      return child;
    },
    spawnSync: (...args: Parameters<typeof actual.spawnSync>) => {
      if (args[0] === 'safeword-fixture-inspector') {
        const options = args[2];
        inspection.budgets.push(options?.timeout ?? Infinity);
        return { status: 1, stdout: '', stderr: '' };
      }
      return actual.spawnSync(...args);
    },
  };
});

const directories: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  inspection.budgets.length = 0;
  for (const pid of inspection.pids.splice(0)) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      /* The owned worker may already have exited. */
    }
  }
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

it.runIf(process.platform !== 'win32').each([0, 450])(
  'returns a cancellable pending review after a %i ms courtesy budget',
  async courtesyMs => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-inspection-budget-'));
    directories.push(cwd);
    writeFileSync(nodePath.join(cwd, 'input.md'), 'review this\n');
    mkdirSync(nodePath.join(cwd, 'keys'));
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', nodePath.join(cwd, 'keys'));
    const worker = nodePath.join(cwd, 'worker.mjs');
    writeFileSync(worker, 'setTimeout(() => {}, 60_000);');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker);
    vi.stubEnv('SAFEWORD_REVIEW_PS_PATH', 'safeword-fixture-inspector');
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', String(courtesyMs));
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    let finished = false;
    const job = startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    void job.then(() => {
      finished = true;
      return finished;
    });
    // Advance the courtesy clock without depending on executable launch latency.
    await vi.waitFor(
      () => {
        expect(finished).toBe(true);
      },
      { timeout: courtesyMs + 5000, interval: 100 },
    );
    const pending = await job;
    const id = (pending.data as { review_id: string }).review_id;
    expect(pending.findings[0]?.code).toBe('REVIEW_PENDING');
    expect(reviewJobStatus(cwd, id).findings[0]?.code).toBe('REVIEW_PENDING');
    expect(inspection.budgets.length).toBeGreaterThan(0);
    expect(inspection.budgets.every(budget => budget > 0 && budget <= 1000)).toBe(true);
    expect(cancelReviewJob(cwd, id).data).toMatchObject({ status: 'canceled' });
    expect(reviewJobStatus(cwd, id).data).toMatchObject({ status: 'canceled' });
  },
);
