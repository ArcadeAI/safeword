import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import {
  cancelReviewJob,
  completeReviewJob,
  reviewJobStatus,
  startReviewJob,
} from '../../src/review/job.js';

const COMPLETE_WORKER = String.raw`
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const id = process.env.SAFEWORD_REVIEW_JOB_ID;
const path = join(process.cwd(), '.safeword', 'state', 'reviews', id + '.json');
const record = JSON.parse(readFileSync(path, 'utf8'));
record.state = 'completed';
record.updated_at = new Date().toISOString();
record.result = {
  schemaVersion: 1, ok: true, state: 'healthy', changed: false,
  findings: [{ code: 'REVIEWER_SUMMARY', message: 'Independent review complete.', severity: 'info' }],
  effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
  errors: [], recovery: [], nextActions: [],
  data: { command: 'review run', status: 'approved' }
};
writeFileSync(path + '.worker.tmp', JSON.stringify(record) + '\n', { mode: 0o600 });
import { renameSync } from 'node:fs';
renameSync(path + '.worker.tmp', path);
`;

function project(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-job-test-'));
  writeFileSync(nodePath.join(directory, 'input.md'), 'review me\n');
  return directory;
}

function disableCrossAgentReview(cwd: string): void {
  const directory = nodePath.join(cwd, '.safeword');
  mkdirSync(directory, { recursive: true });
  writeFileSync(nodePath.join(directory, 'config.json'), '{"crossAgentReview":"off"}\n');
}

function worker(directory: string, source: string): string {
  const path = nodePath.join(directory, 'worker.mjs');
  writeFileSync(path, source);
  return path;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('durable review jobs', () => {
  it('runs the detached CLI path through to a stored no-review result', async () => {
    const cwd = project();
    disableCrossAgentReview(cwd);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');

    const result = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });

    expect(result.state).toBe('healthy');
    expect(result.findings[0]?.code).toBe('REVIEW_NOT_REQUESTED');
  });

  it('collects a detached review after the initiating CLI process exits', async () => {
    const cwd = project();
    disableCrossAgentReview(cwd);
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const started = spawnSync(
      process.execPath,
      [cli, '--json', 'review', 'run', 'quality-review', '--', 'input.md'],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, SAFEWORD_REVIEW_FOREGROUND_MS: '0' },
      },
    );
    const pending = JSON.parse(started.stdout) as { data: { review_id: string } };

    await vi.waitFor(() => {
      expect(reviewJobStatus(cwd, pending.data.review_id).findings[0]?.code).not.toBe(
        'REVIEW_PENDING',
      );
    });

    expect(reviewJobStatus(cwd, pending.data.review_id).state).toBe('healthy');
  });
  it('returns a quick completed review inline', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');

    const result = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });

    expect(result.state).toBe('healthy');
    expect(result.findings[0]?.message).toBe('Independent review complete.');
  });

  it('returns a durable handle when the courtesy wait ends', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 1000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

    const result = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });

    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.code).toBe('REVIEW_PENDING');
    const next = result.nextActions[0];
    expect(next !== undefined && 'command' in next ? next.command : undefined).toMatch(
      /^safeword review status /u,
    );
  });

  it('reuses the running review for the same source', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const first = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const second = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });

    expect((second.data as { review_id: string }).review_id).toBe(
      (first.data as { review_id: string }).review_id,
    );
    cancelReviewJob(cwd, (first.data as { review_id: string }).review_id);
  });

  it('does not reuse a review when a context file becomes a target', async () => {
    const cwd = project();
    writeFileSync(nodePath.join(cwd, 'context.md'), 'supporting context\n');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const first = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
      context: ['context.md'],
    });
    const second = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md', 'context.md'],
    });
    const firstId = (first.data as { review_id: string }).review_id;
    const secondId = (second.data as { review_id: string }).review_id;

    expect(secondId).not.toBe(firstId);
    cancelReviewJob(cwd, firstId);
    cancelReviewJob(cwd, secondId);
  });

  it('reserves one worker for simultaneous starts of the same source', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

    const [first, second] = await Promise.all([
      startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] }),
      startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] }),
    ]);

    expect((second.data as { review_id: string }).review_id).toBe(
      (first.data as { review_id: string }).review_id,
    );
    cancelReviewJob(cwd, (first.data as { review_id: string }).review_id);
  });

  it('persists a typed failure when a worker exits without a result', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'process.exit(0);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;

    await vi.waitFor(() => {
      expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_EXITED');
    });

    expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_EXITED');
  });

  it('collects a completed result without rerunning the reviewer', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;

    await vi.waitFor(() => {
      expect(reviewJobStatus(cwd, id).findings[0]?.code).not.toBe('REVIEW_PENDING');
    });
    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('healthy');
    expect(result.findings[0]?.message).toBe('Independent review complete.');
  });

  it('refuses a completed result after its reviewed source changes', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    await vi.waitFor(() => {
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { state: string };
      expect(record.state).toBe('completed');
    });
    writeFileSync(nodePath.join(cwd, 'input.md'), 'changed after review\n');

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.code).toBe('REVIEW_STALE');
  });

  it('treats a deleted reviewed source as stale and offers a fresh review', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    await vi.waitFor(() => {
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { state: string };
      expect(record.state).toBe('completed');
    });
    unlinkSync(nodePath.join(cwd, 'input.md'));

    const result = reviewJobStatus(cwd, id);

    expect(result.findings[0]?.code).toBe('REVIEW_STALE');
    expect(result.nextActions[0]).toMatchObject({
      command: 'safeword review run quality-review -- input.md',
    });
  });

  it('binds detached reviews to their bounded context files', async () => {
    const cwd = project();
    writeFileSync(nodePath.join(cwd, 'context.md'), 'review context\n');
    writeFileSync(nodePath.join(cwd, 'other context.md'), 'more review context\n');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
      context: ['context.md', 'other context.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    await vi.waitFor(() => {
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { state: string };
      expect(record.state).toBe('completed');
    });
    writeFileSync(nodePath.join(cwd, 'context.md'), 'changed context\n');

    const result = reviewJobStatus(cwd, id);

    expect(result.findings[0]?.code).toBe('REVIEW_STALE');
    expect(result.nextActions[0]).toMatchObject({
      command:
        "safeword review run quality-review --context context.md --context 'other context.md' -- input.md",
    });
  });

  it('cancels a running review without deleting its record', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;

    const result = cancelReviewJob(cwd, id);

    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.code).toBe('REVIEW_CANCELED');
    expect(reviewJobStatus(cwd, id).findings[0]?.code).toBe('REVIEW_CANCELED');
    completeReviewJob(
      cwd,
      id,
      createResult({ state: 'healthy', data: { command: 'review run', status: 'approved' } }),
    );
    expect(reviewJobStatus(cwd, id).findings[0]?.code).toBe('REVIEW_CANCELED');
  });

  it('refuses a planted record with an arbitrary pid and result', () => {
    const cwd = project();
    const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const directory = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, `${id}.json`),
      JSON.stringify({
        schema_version: 1,
        id,
        state: 'completed',
        kind: 'quality-review',
        targets: ['input.md'],
        source_fingerprint: 'forged',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pid: '1',
        result: { state: 'healthy' },
      }),
    );

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
  });

  it('fails a launch record whose initiating process exited before persisting a worker', () => {
    const cwd = project();
    const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const directory = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, `${id}.json`),
      JSON.stringify({
        schema_version: 1,
        id,
        state: 'launching',
        kind: 'quality-review',
        targets: ['input.md'],
        source_fingerprint: 'reserved',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pid: 2_147_483_647,
      }),
    );

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_WORKER_EXITED');
    const stored = JSON.parse(readFileSync(nodePath.join(directory, `${id}.json`), 'utf8'));
    expect(stored).toMatchObject({
      id,
      state: 'failed',
    });
  });

  it('rejects a record whose embedded identity differs from its filename', () => {
    const cwd = project();
    const requestedId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const embeddedId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    const directory = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, `${requestedId}.json`),
      JSON.stringify({
        schema_version: 1,
        id: embeddedId,
        state: 'running',
        kind: 'quality-review',
        targets: ['input.md'],
        source_fingerprint: 'forged',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pid: process.pid,
      }),
    );

    expect(reviewJobStatus(cwd, requestedId).errors[0]?.code).toBe('REVIEW_JOB_INVALID');
    expect(cancelReviewJob(cwd, requestedId).errors[0]?.code).toBe('REVIEW_JOB_INVALID');
    expect(existsSync(nodePath.join(directory, `${embeddedId}.json`))).toBe(false);
  });

  it('returns typed failures for malformed and unknown review ids', () => {
    const cwd = project();

    expect(reviewJobStatus(cwd, 'not-a-uuid').errors[0]?.code).toBe('REVIEW_JOB_NOT_FOUND');
    expect(cancelReviewJob(cwd, 'not-a-uuid').errors[0]?.code).toBe('REVIEW_JOB_NOT_FOUND');
    expect(reviewJobStatus(cwd, 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa').errors[0]?.code).toBe(
      'REVIEW_JOB_NOT_FOUND',
    );
  });

  it('uses the newest valid record when status omits the review id', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const first = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    writeFileSync(nodePath.join(cwd, 'input.md'), 'newer source\n');
    const second = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const firstId = (first.data as { review_id: string }).review_id;
    const secondId = (second.data as { review_id: string }).review_id;

    const latest = cancelReviewJob(cwd);

    expect((latest.data as { review_id: string }).review_id).toBe(secondId);
    expect(cancelReviewJob(cwd, firstId).findings[0]?.code).toBe('REVIEW_CANCELED');
  });
});
