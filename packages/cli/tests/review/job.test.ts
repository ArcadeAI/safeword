import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResult } from '../../src/cli-protocol/result.js';
import {
  cancelReviewJob,
  completeReviewJob,
  relayManagedWorkerStderr,
  reviewJobStatus,
  startReviewJob,
} from '../../src/review/job.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../review-fixtures.js';

const COMPLETE_WORKER = String.raw`
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync, openSync, closeSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
`;

const REQUEST_CHANGES_WORKER = COMPLETE_WORKER.replace(
  "const record = JSON.parse(readFileSync(path, 'utf8'));",
  "await new Promise(resolve => setTimeout(resolve, 50));\nconst record = JSON.parse(readFileSync(path, 'utf8'));",
)
  .replace("state: 'healthy'", "state: 'action_required'")
  .replace("status: 'approved'", "status: 'changes_requested'")
  .replace("verdict: 'approve'", "verdict: 'request_changes'")
  .replace('findings: []', "findings: [{ severity: 'error', message: 'Unsafe retry' }]");

function project(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-job-test-'));
  const keyPrefix = nodePath.join(tmpdir(), 'safeword-review-key-test-');
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', mkdtempSync(keyPrefix));
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

function signRecord(cwd: string, record: Record<string, unknown>): string {
  const keyRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
  if (keyRoot === undefined) throw new Error('test key root is unavailable');
  const key = Buffer.from(
    readFileSync(nodePath.join(keyRoot, 'safeword', 'review-integrity.key'), 'utf8').trim(),
    'hex',
  );
  const { integrity: _integrity, ...unsigned } = record;
  return createHmac('sha256', key)
    .update(realpathSync.native(cwd))
    .update('\0')
    .update(JSON.stringify(unsigned))
    .digest('hex');
}

function delayedReviewer(): { bin: string; log: string } {
  // Reviewer executables inside the reviewed project are deliberately rejected:
  // project code could replace them after validation. Model a trusted host tool
  // by placing this process-boundary fixture outside the untrusted project root.
  const host = createTrustedReviewerDirectory('safeword-reviewer-host-');
  const bin = nodePath.join(host, 'bin');
  const log = nodePath.join(host, 'reviewer.log');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema'
  exit 0
fi
printf 'called\n' >> '${log}'
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
/bin/sleep 1
printf '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"schema_version\\":1,\\"dispatch_id\\":\\"%s\\",\\"reviewer_agent\\":\\"codex\\",\\"verdict\\":\\"approve\\",\\"summary\\":\\"reviewed after caller exit\\",\\"findings\\":[]}"}}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  return { bin, log };
}

afterEach(() => {
  vi.unstubAllEnvs();
  cleanupTrustedReviewerDirectories();
});

describe('durable review jobs', () => {
  it('contains managed child-stderr errors and removes the scoped listener on close', async () => {
    const stderr = new PassThrough();
    const child = { stderr } as unknown as ChildProcess;
    const closeRelay = relayManagedWorkerStderr(child, true);

    expect(() => stderr.emit('error', new Error('child pipe reset'))).not.toThrow();
    expect(stderr.listenerCount('error')).toBe(1);

    const closed = new Promise<void>(resolve => stderr.once('close', resolve));
    closeRelay();
    await closed;

    expect(stderr.listenerCount('error')).toBe(0);
  });

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

  it('gives a detached worker its configured background run bound', async () => {
    const cwd = project();
    disableCrossAgentReview(cwd);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    vi.stubEnv('SAFEWORD_REVIEW_RUN_BOUND_MS', '600000');

    await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });

    const jobs = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    const recordPath = readdirSync(jobs)
      .filter(name => name.endsWith('.json'))
      .map(name => nodePath.join(jobs, name))[0];
    if (recordPath === undefined) throw new Error('review job record was not written');
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
      deadline_at: string;
      started_at: string;
    };
    expect(Date.parse(record.deadline_at) - Date.parse(record.started_at)).toBeGreaterThanOrEqual(
      600_000,
    );
  });

  it('collects a detached review after the initiating CLI process exits', async () => {
    const cwd = project();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      '{"crossAgentReview":"require"}\n',
    );
    const reviewer = delayedReviewer();
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const started = spawnSync(
      process.execPath,
      [cli, '--json', 'review', 'run', 'quality-review', '--', 'input.md'],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${reviewer.bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_FOREGROUND_MS: '0',
          SAFEWORD_REVIEW_PROGRESS: '1',
          SAFEWORD_PROGRESS_HEARTBEAT_MS: '100',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );
    expect(started.error).toBeUndefined();
    expect(started.status).toBe(2);
    expect(started.stderr).toBe('');
    const pending = JSON.parse(started.stdout) as { data: { review_id: string } };

    await vi.waitFor(
      () => {
        const collected = reviewJobStatus(cwd, pending.data.review_id);
        expect(collected, JSON.stringify(collected)).toMatchObject({
          state: 'healthy',
          data: { status: 'approved' },
        });
      },
      // The detached worker competes with the full CI suite for CPU. Its own
      // reviewer only sleeps for one second, but process startup can take
      // materially longer under the Node matrix's peak load.
      { timeout: 20_000 },
    );
    expect(readFileSync(reviewer.log, 'utf8').trim().split('\n')).toEqual(['called']);
  });

  it('emits only managed lifecycle lines without disclosing reviewer bytes', () => {
    const cwd = project();
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      '{"crossAgentReview":"require"}\n',
    );
    const reviewer = delayedReviewer();
    const cli = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
    const completed = spawnSync(
      process.execPath,
      [cli, '--json', 'review', 'run', 'quality-review', '--', 'input.md'],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${reviewer.bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_PROGRESS: '1',
          SAFEWORD_REVIEW_FOREGROUND_MS: '3000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
        timeout: 10_000,
      },
    );

    expect(completed.error).toBeUndefined();
    expect(completed.status).toBe(0);
    expect(completed.stderr).toBe('Requesting an independent Codex review…\n');
    expect(completed.stderr).not.toContain('reviewed after caller exit');
    expect(JSON.parse(completed.stdout)).toMatchObject({
      state: 'healthy',
      data: { status: 'approved' },
    });
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

  it('preserves a quick changes-requested reviewer result inline', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, REQUEST_CHANGES_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');

    const result = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });

    expect(result).toMatchObject({
      state: 'action_required',
      data: {
        status: 'changes_requested',
        reviewer_output: {
          verdict: 'request_changes',
          findings: [{ message: 'Unsafe retry' }],
        },
      },
    });
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
    expect(next !== undefined && 'command' in next ? next.command : undefined).toBe(
      `${process.execPath} ${process.env.SAFEWORD_CLI_ENTRYPOINT} review status ${(result.data as { review_id: string }).review_id}`,
    );
  });

  it('shell-quotes the proven CLI entrypoint in the status action', async () => {
    const cwd = project();
    const entrypoint = nodePath.join(cwd, 'worker entrypoint.mjs');
    writeFileSync(entrypoint, 'setTimeout(() => {}, 1000);');
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', entrypoint);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

    const result = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (result.data as { review_id: string }).review_id;

    expect(result.nextActions).toContainEqual({
      command: `${process.execPath} '${entrypoint}' review status ${id}`,
      mutates: false,
      requiresHuman: false,
    });
    cancelReviewJob(cwd, id);
  });

  it('reports a blocked review pending before its absolute deadline', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;

    expect(reviewJobStatus(cwd, id)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_PENDING' }],
      nextActions: [
        {
          command: `${process.execPath} ${process.env.SAFEWORD_CLI_ENTRYPOINT} review status ${id}`,
        },
      ],
    });
    cancelReviewJob(cwd, id);
  });

  it('preserves a detached changes-requested reviewer result after collection', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, REQUEST_CHANGES_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;

    await vi.waitFor(() => {
      expect(reviewJobStatus(cwd, id)).toMatchObject({
        state: 'action_required',
        data: {
          status: 'changes_requested',
          reviewer_output: {
            verdict: 'request_changes',
            findings: [{ message: 'Unsafe retry' }],
          },
        },
      });
    });
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

  it('recognizes a long-running worker even when its command line is long', async () => {
    const cwd = project();
    const longDirectory = nodePath.join(cwd, `worker-${'x'.repeat(180)}`);
    mkdirSync(longDirectory);
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(longDirectory, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

    const first = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const second = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });

    expect((second.data as { review_id: string }).review_id).toBe(
      (first.data as { review_id: string }).review_id,
    );
    cancelReviewJob(cwd, (first.data as { review_id: string }).review_id);
  });

  it.runIf(process.platform !== 'win32')(
    'keeps a live review pending when worker inspection is unavailable',
    async () => {
      const cwd = project();
      const bin = nodePath.join(cwd, 'bin');
      mkdirSync(bin);
      const ps = nodePath.join(bin, 'ps');
      writeFileSync(ps, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
      vi.stubEnv('SAFEWORD_REVIEW_PS_PATH', ps);
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
      vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

      const pending = await startReviewJob({
        cwd,
        kind: 'quality-review',
        targets: ['input.md'],
      });
      const id = (pending.data as { review_id: string }).review_id;
      const duplicate = await startReviewJob({
        cwd,
        kind: 'quality-review',
        targets: ['input.md'],
      });

      expect(pending.findings[0]?.code).toBe('REVIEW_PENDING');
      expect((duplicate.data as { review_id: string }).review_id).toBe(id);
      expect(reviewJobStatus(cwd, id).findings[0]?.code).toBe('REVIEW_PENDING');
      cancelReviewJob(cwd, id);
    },
  );

  it.runIf(process.platform !== 'win32')(
    'bounds synchronous worker inspection during the courtesy wait',
    async () => {
      const cwd = project();
      const bin = nodePath.join(cwd, 'bin');
      const inspectionLog = nodePath.join(cwd, 'ps.log');
      mkdirSync(bin);
      writeFileSync(
        nodePath.join(bin, 'ps'),
        `#!/bin/sh\nprintf 'inspected\\n' >> ${JSON.stringify(inspectionLog)}\nexec /bin/ps "$@"\n`,
        { mode: 0o755 },
      );
      vi.stubEnv('SAFEWORD_REVIEW_PS_PATH', nodePath.join(bin, 'ps'));
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
      vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '450');

      const pending = await startReviewJob({
        cwd,
        kind: 'quality-review',
        targets: ['input.md'],
      });

      expect(readFileSync(inspectionLog, 'utf8').trim().split('\n')).toHaveLength(2);
      cancelReviewJob(cwd, (pending.data as { review_id: string }).review_id);
    },
  );

  it('launches a managed worker in JSON mode', async () => {
    const cwd = project();
    const argumentsPath = nodePath.join(cwd, 'worker-arguments.json');
    vi.stubEnv(
      'SAFEWORD_CLI_ENTRYPOINT',
      worker(
        cwd,
        `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(argumentsPath)}, JSON.stringify(process.argv)); setTimeout(() => {}, 10_000);`,
      ),
    );
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

    const result = await startReviewJob({
      cwd,
      kind: 'quality-review',
      progress: { managed: true, start: vi.fn() },
      targets: ['input.md'],
    });
    await vi.waitFor(() => {
      expect(existsSync(argumentsPath)).toBe(true);
    });

    expect(JSON.parse(readFileSync(argumentsPath, 'utf8'))).toContain('--json');
    cancelReviewJob(cwd, (result.data as { review_id: string }).review_id);
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
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    const startedAt = Date.now();
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(pending.errors[0]?.code).toBe('REVIEW_WORKER_EXITED');
    expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_EXITED');
  });

  it('terminates a wedged worker and records timeout when status observes its deadline', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
      pid: number;
      deadline_at: string;
      integrity?: string;
    };
    record.deadline_at = new Date(0).toISOString();
    record.integrity = signRecord(cwd, record);
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, id);

    expect(result.errors[0]?.code).toBe('REVIEW_WORKER_TIMED_OUT');
    await vi.waitFor(() => {
      expect(() => process.kill(record.pid, 0)).toThrow();
    });
  });

  it.runIf(process.platform !== 'win32')(
    'does not terminate a recycled pid when a stored review deadline expires',
    async () => {
      const cwd = project();
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
      vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
      const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
      const id = (pending.data as { review_id: string }).review_id;
      const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
        pid: number;
        deadline_at: string;
        integrity?: string;
      };
      const workerPid = record.pid;
      const unrelated = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
      if (unrelated.pid === undefined) throw new Error('unrelated fixture process did not start');
      const unrelatedPid = unrelated.pid;
      record.pid = unrelatedPid;
      record.deadline_at = new Date(0).toISOString();
      record.integrity = signRecord(cwd, record);
      writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

      try {
        expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_TIMED_OUT');
        expect(() => process.kill(unrelatedPid, 0)).not.toThrow();
      } finally {
        for (const pid of [workerPid, unrelatedPid]) {
          try {
            process.kill(-pid, 'SIGTERM');
          } catch {
            // The fixture process may already have exited.
          }
        }
      }
    },
  );

  it('preserves a timed-out result when its former worker completes late', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 1_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    record.state = 'failed';
    record.result = createResult({
      state: 'failed',
      errors: [{ code: 'REVIEW_WORKER_TIMED_OUT', message: 'timed out', retryable: true }],
      data: { command: 'review status', status: 'failed', review_id: id },
    });
    record.integrity = signRecord(cwd, record);
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_TIMED_OUT');
    completeReviewJob(
      cwd,
      id,
      createResult({ state: 'healthy', data: { command: 'review run', status: 'approved' } }),
    );
    expect(reviewJobStatus(cwd, id).errors[0]?.code).toBe('REVIEW_WORKER_TIMED_OUT');
  });

  it('refuses a traversal-shaped review id even when a record exists outside the review store', () => {
    const cwd = project();
    const escaped = nodePath.join(cwd, '.safeword', 'state', 'outside-the-review-store.json');
    mkdirSync(nodePath.dirname(escaped), { recursive: true });
    writeFileSync(escaped, '{"planted":"record"}\n');

    expect(reviewJobStatus(cwd, '../outside-the-review-store').errors[0]?.code).toBe(
      'REVIEW_JOB_NOT_FOUND',
    );
  });

  it('does not let cancellation resolve a traversal-shaped review id outside the review store', () => {
    const cwd = project();
    const escaped = nodePath.join(cwd, '.safeword', 'state', 'outside-the-review-store.json');
    mkdirSync(nodePath.dirname(escaped), { recursive: true });
    writeFileSync(escaped, '{"planted":"record"}\n');

    expect(cancelReviewJob(cwd, '../outside-the-review-store').errors[0]?.code).toBe(
      'REVIEW_JOB_NOT_FOUND',
    );
    expect(readFileSync(escaped, 'utf8')).toBe('{"planted":"record"}\n');
  });

  it('rejects a running job record without its worker pid', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    delete record.pid;
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
  });

  it('collects a completed result after an unrelated source changes without rerunning', async () => {
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
    writeFileSync(nodePath.join(cwd, 'unreviewed.md'), 'unrelated change\n');
    const result = reviewJobStatus(cwd, id);

    expect(result.state, JSON.stringify(result)).toBe('healthy');
    expect(result.findings[0]?.message).toBe('Independent review complete.');
  });

  it('collects a completed result while its reviewed source is unchanged', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    const completed = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const id = (completed.data as { review_id: string }).review_id;

    expect(reviewJobStatus(cwd, id)).toMatchObject({
      state: 'healthy',
      data: { status: 'approved' },
    });
  });

  it('rejects a repo-local edit to a worker-produced completed result', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    const completed = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
    });
    const records = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    const recordName = readdirSync(records).find(candidate => candidate.endsWith('.json'));
    expect(recordName).toBeDefined();
    if (recordName === undefined) throw new Error('completed job record was not written');
    const recordPath = nodePath.join(records, recordName);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
      id: string;
      result: { findings: { message: string }[] };
    };
    const finding = record.result.findings[0];
    if (finding === undefined) throw new Error('completed job result has no finding');
    finding.message = 'planted approval';
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, record.id);

    expect(completed.state, JSON.stringify(completed)).toBe('healthy');
    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
  });

  it('rejects an approved completed result relabeled as failed to bypass integrity', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const records = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    const recordName = readdirSync(records).find(candidate => candidate.endsWith('.json'));
    if (recordName === undefined) throw new Error('completed job record was not written');
    const recordPath = nodePath.join(records, recordName);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    record.state = 'failed';
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, String(record.id));

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
  });

  it('rejects tampered review inputs before computing staleness or retry guidance', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const records = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    const recordName = readdirSync(records).find(candidate => candidate.endsWith('.json'));
    if (recordName === undefined) throw new Error('completed job record was not written');
    const recordPath = nodePath.join(records, recordName);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    record.targets = ['attacker-controlled.md'];
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, String(record.id));

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
    expect(result.findings).toEqual([]);
    expect(result.nextActions).toEqual([]);
  });

  it('preserves completed history beyond 128 reviews with one host key', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
    await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const records = nodePath.join(cwd, '.safeword', 'state', 'reviews');
    const originalName = readdirSync(records).find(candidate => candidate.endsWith('.json'));
    if (originalName === undefined) throw new Error('completed job record was not written');
    const original = JSON.parse(
      readFileSync(nodePath.join(records, originalName), 'utf8'),
    ) as Record<string, unknown>;

    for (let index = 0; index < 129; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      const clone: Record<string, unknown> = { ...original, id, integrity: undefined };
      clone.integrity = signRecord(cwd, clone);
      writeFileSync(nodePath.join(records, `${id}.json`), `${JSON.stringify(clone)}\n`);
    }

    expect(reviewJobStatus(cwd, String(original.id)).state).toBe('healthy');
    const keyRoot = process.env.SAFEWORD_REVIEW_KEY_ROOT;
    if (keyRoot === undefined) throw new Error('test key root is unavailable');
    expect(readdirSync(nodePath.join(keyRoot, 'safeword'))).toEqual(['review-integrity.key']);
  });

  it.runIf(process.platform !== 'win32')(
    'validates a completed job through a canonical project path alias',
    async () => {
      const cwd = project();
      const alias = `${cwd}-alias`;
      symlinkSync(cwd, alias);
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
      vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');
      await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
      const recordName = readdirSync(nodePath.join(cwd, '.safeword', 'state', 'reviews')).find(
        candidate => candidate.endsWith('.json'),
      );
      if (recordName === undefined) throw new Error('completed job record was not written');

      expect(reviewJobStatus(alias, recordName.slice(0, -5)).state).toBe('healthy');
    },
  );

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

  it('keeps a completed result when a reviewed source is restored to identical content', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    await vi.waitFor(() => {
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { state: string };
      expect(record.state).toBe('completed');
    });
    writeFileSync(nodePath.join(cwd, 'input.md'), 'changed temporarily\n');
    writeFileSync(nodePath.join(cwd, 'input.md'), 'review me\n');

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('healthy');
    expect(result.findings[0]?.message).toBe('Independent review complete.');
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
    const releasePath = nodePath.join(cwd, 'release-worker');
    writeFileSync(nodePath.join(cwd, 'context.md'), 'review context\n');
    writeFileSync(nodePath.join(cwd, 'other context.md'), 'more review context\n');
    vi.stubEnv(
      'SAFEWORD_CLI_ENTRYPOINT',
      worker(
        cwd,
        `import { existsSync } from 'node:fs';
while (!existsSync(${JSON.stringify(releasePath)})) await new Promise(resolve => setTimeout(resolve, 10));
${COMPLETE_WORKER}`,
      ),
    );
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({
      cwd,
      kind: 'quality-review',
      targets: ['input.md'],
      context: ['context.md', 'other context.md'],
    });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    writeFileSync(releasePath, 'go\n');
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
  });

  it('preserves a canceled result when its former worker completes late', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    cancelReviewJob(cwd, id);

    completeReviewJob(
      cwd,
      id,
      createResult({ state: 'healthy', data: { command: 'review run', status: 'approved' } }),
    );
    expect(reviewJobStatus(cwd, id).findings[0]?.code).toBe('REVIEW_CANCELED');
  });

  it('preserves a completed result when cancellation is requested afterward', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, COMPLETE_WORKER));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    await vi.waitFor(() => {
      expect(reviewJobStatus(cwd, id).state).toBe('healthy');
    });
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown> & {
      result: ReturnType<typeof createResult>;
    };
    record.result = {
      ...record.result,
      effects: {
        ...record.result.effects,
        network: [{ kind: 'review', target: 'codex', operation: 'request' }],
      },
    };
    record.integrity = signRecord(cwd, record);
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const canceled = cancelReviewJob(cwd, id);

    expect(canceled.state).toBe('healthy');
    expect(canceled.findings[0]?.message).toBe('Independent review complete.');
    expect(canceled.effects.network).toEqual([]);
    expect(canceled.data).toMatchObject({ command: 'review cancel', status: 'approved' });
    expect(reviewJobStatus(cwd, id).state).toBe('healthy');
  });

  it('stops the running reviewer when an active review is canceled', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as { pid: number };

    const result = cancelReviewJob(cwd, id);

    expect(result.findings[0]?.code).toBe('REVIEW_CANCELED');
    await vi.waitFor(() => {
      expect(() => process.kill(record.pid, 0)).toThrow();
    });
  });

  it('rejects a tampered canceled record before using its payload', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    cancelReviewJob(cwd, id);
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    record.targets = ['attacker-controlled.md'];
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    const result = reviewJobStatus(cwd, id);

    expect(result.state).toBe('failed');
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
  });

  it('rejects a tampered running record before cancellation terminates its reviewer', async () => {
    const cwd = project();
    vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');
    const pending = await startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
    const id = (pending.data as { review_id: string }).review_id;
    const recordPath = nodePath.join(cwd, '.safeword', 'state', 'reviews', `${id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
      pid: number;
      targets: string[];
    };
    record.targets = ['attacker-controlled.md'];
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`);

    expect(cancelReviewJob(cwd, id).errors[0]?.code).toBe('REVIEW_JOB_INVALID');
    expect(() => process.kill(record.pid, 0)).not.toThrow();
    process.kill(record.pid, 'SIGKILL');
  });

  it.runIf(process.platform !== 'win32')(
    'does not leak a child when cancellation wins during launch',
    async () => {
      const cwd = project();
      vi.stubEnv('SAFEWORD_CLI_ENTRYPOINT', worker(cwd, 'setTimeout(() => {}, 10_000);'));
      vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '0');

      const starting = startReviewJob({ cwd, kind: 'quality-review', targets: ['input.md'] });
      const records = nodePath.join(cwd, '.safeword', 'state', 'reviews');
      const recordName = readdirSync(records).find(candidate => candidate.endsWith('.json'));
      expect(recordName).toBeDefined();
      if (recordName === undefined) throw new Error('launching job record was not written');
      const record = JSON.parse(readFileSync(nodePath.join(records, recordName), 'utf8')) as {
        id: string;
        pid: number;
        state: string;
      };
      expect(record.state).toBe('running');

      const canceled = cancelReviewJob(cwd, record.id);
      const result = await starting;

      expect(canceled.findings[0]?.code).toBe('REVIEW_CANCELED');
      expect(result.findings[0]?.code).toBe('REVIEW_CANCELED');
      await vi.waitFor(() => {
        expect(() => process.kill(record.pid, 0)).toThrow();
      });
    },
  );

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

  it('rejects an unsigned launch record before trusting its initiating pid', () => {
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
    expect(result.errors[0]?.code).toBe('REVIEW_JOB_INVALID');
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

  it('rejects a malformed review id', () => {
    const cwd = project();

    expect(reviewJobStatus(cwd, 'not-a-uuid').errors[0]?.code).toBe('REVIEW_JOB_NOT_FOUND');
  });

  it('rejects an unknown well-formed review id', () => {
    const cwd = project();

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
