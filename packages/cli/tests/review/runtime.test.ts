import { spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import {
  parseProcessStat,
  parseReviewerOutput,
  procGroupHasRunningMember,
  reviewerArguments,
  reviewTimeoutMilliseconds,
  runBoundMs,
  runHeadlessReviewer,
} from '../../src/review/runtime.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../review-fixtures.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of temporaryDirectories) rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
  cleanupTrustedReviewerDirectories();
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-runtime-'));
  temporaryDirectories.push(directory);
  return directory;
}

function trustedTemporaryDirectory(): string {
  return createTrustedReviewerDirectory('safeword-review-runtime-');
}

const output: ReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'reviewed',
  findings: [],
};

describe('headless reviewer timeout budgets', () => {
  // 91 real review runs put successful reviews at 47s median, 75s slowest, so
  // 120s leaves headroom while preserving a fallback inside the host deadline — see runtime.ts's
  // DEFAULT_ATTEMPT_DEADLINE_MS for the full evidence trail.
  it('gives a review attempt a two-minute default budget', () => {
    expect(reviewTimeoutMilliseconds({})).toBe(120_000);
  });

  it('honors the explicit timeout override', () => {
    expect(reviewTimeoutMilliseconds({ SAFEWORD_REVIEW_TIMEOUT_MS: '45000' })).toBe(45_000);
  });

  it('gives a detached review worker the larger absolute and attempt budgets', () => {
    vi.stubEnv('SAFEWORD_REVIEW_WORKER', '1');

    expect(runBoundMs()).toBe(1_800_000);
    expect(reviewTimeoutMilliseconds()).toBe(600_000);
  });

  it('lets worker overrides shorten but not extend the background budgets', () => {
    vi.stubEnv('SAFEWORD_REVIEW_WORKER', '1');
    vi.stubEnv('SAFEWORD_REVIEW_RUN_BOUND_MS', '900000');
    expect(runBoundMs()).toBe(900_000);
    vi.stubEnv('SAFEWORD_REVIEW_RUN_BOUND_MS', '3600000');
    expect(runBoundMs()).toBe(1_800_000);

    expect(
      reviewTimeoutMilliseconds({
        SAFEWORD_REVIEW_WORKER: '1',
        SAFEWORD_REVIEW_TIMEOUT_MS: '3600000',
      }),
    ).toBe(1_740_000);
  });

  it('reads every budget from an explicit environment snapshot', () => {
    const env = {
      SAFEWORD_REVIEW_RUN_BOUND_MS: '900000',
      SAFEWORD_REVIEW_TIMEOUT_MS: '45000',
      SAFEWORD_REVIEW_WORKER: '1',
    };

    expect(runBoundMs(env)).toBe(900_000);
    expect(reviewTimeoutMilliseconds(env)).toBe(45_000);
  });
});

describe('headless reviewer output adapters', () => {
  it('extracts a review result from the Claude JSON envelope', () => {
    const result = JSON.stringify(output);
    const envelope = JSON.stringify({ type: 'result', subtype: 'success', result });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('extracts Claude native structured output without trusting prose formatting', () => {
    const envelope = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '```json\nnot trusted\n```',
      structured_output: output,
    });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('falls back to Claude result JSON when structured output is unusable', () => {
    const envelope = JSON.stringify({ structured_output: 0, result: JSON.stringify(output) });

    expect(parseReviewerOutput('claude', envelope)).toEqual(output);
  });

  it('extracts the last agent message from Codex JSONL events', () => {
    const codexOutput = { ...output, reviewer_agent: 'codex' as const };
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
      'non-json diagnostic noise',
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item-0',
          type: 'agent_message',
          text: JSON.stringify({ ...codexOutput, summary: 'superseded' }),
        },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item-1', type: 'agent_message', text: JSON.stringify(codexOutput) },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');

    expect(parseReviewerOutput('codex', stdout)).toEqual(codexOutput);
  });

  it('retains the direct JSON test adapter contract', () => {
    expect(parseReviewerOutput('claude', JSON.stringify(output))).toEqual(output);
  });

  it.each([
    ['wrong schema version', { ...output, schema_version: 2 }],
    ['unknown verdict', { ...output, verdict: 'looks-good' }],
    ['missing summary', { ...output, summary: undefined }],
    ['non-array findings', { ...output, findings: 'none' }],
    ['malformed finding', { ...output, findings: [{ severity: 'critical', message: 'bad' }] }],
    ['extra output property', { ...output, unexpected: true }],
    [
      'extra finding property',
      { ...output, findings: [{ severity: 'info', message: 'noted', unexpected: true }] },
    ],
    [
      'approval with an error finding',
      { ...output, findings: [{ severity: 'error', message: 'must be resolved' }] },
    ],
    // A severity that merely stringifies to a known one used to validate, and
    // then compared unequal to 'error' in the approve-with-errors check — so
    // this exact shape let a reviewer approve while carrying an error finding.
    ['non-string severity', { ...output, findings: [{ severity: ['info'], message: 'noted' }] }],
    [
      'approval with an error finding wrapped in an array',
      { ...output, findings: [{ severity: ['error'], message: 'must be resolved' }] },
    ],
  ])('rejects structurally invalid output: %s', (_label, invalidOutput) => {
    expect(() => parseReviewerOutput('claude', JSON.stringify(invalidOutput))).toThrow(
      'invalid reviewer output',
    );
  });
});

describe('reviewer arguments', () => {
  it('places Codex model and schema flags before the trailing stdin marker', () => {
    const args = reviewerArguments('codex', 'gpt-test', '/tmp/schema.json');

    expect(args.slice(-5)).toEqual([
      '--model',
      'gpt-test',
      '--output-schema',
      '/tmp/schema.json',
      '-',
    ]);
  });

  it('appends Claude model flags without adding a positional marker', () => {
    const args = reviewerArguments('claude', 'claude-test', undefined);

    expect(args.slice(-2)).toEqual(['--model', 'claude-test']);
    expect(args).not.toContain('-');
  });
});

describe('reviewer process-group liveness', () => {
  // A group holding only zombies answers "yes" to kill(-pgid, 0), so cleanup
  // used to report failure for a tree it had already stopped, and a timed-out
  // review surfaced as process_failed. Reading state from /proc is what
  // separates "already dead, not yet reaped" from "still running".
  it('reads state and process group from a stat line', () => {
    expect(parseProcessStat('42 (sleep) S 1 7 0 0 -1 0')).toEqual({ state: 'S', group: 7 });
  });

  it('reports a zombie by its state rather than its presence', () => {
    expect(parseProcessStat('42 (sleep) Z 1 7 0 0 -1 0')?.state).toBe('Z');
  });

  it('reads past a comm containing spaces and parentheses', () => {
    // comm is the only field that can hold the delimiters, so the fixed fields
    // are taken after its LAST closing paren, not its first.
    expect(parseProcessStat('42 (odd (name) here) R 1 99 0')).toEqual({ state: 'R', group: 99 });
  });

  it.each(['', 'no parens here', '42 (sleep)'])('rejects an unparseable line: %s', line => {
    expect(parseProcessStat(line)).toBeUndefined();
  });

  // The parser cases above are pure. These drive the helper the cleanup path
  // actually calls, against a real process group, so the motivating behaviour
  // is shown at the boundary rather than inferred from a stat line.
  it.skipIf(process.platform !== 'linux')('sees a live process group as running', async () => {
    const child = spawn('/bin/sleep', ['30'], { detached: true, stdio: 'ignore' });
    try {
      const group = child.pid;
      expect(group).toBeDefined();
      if (group === undefined) return;
      expect(procGroupHasRunningMember(group)).toBe(true);
    } finally {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
      await new Promise(resolve => child.once('exit', resolve));
    }
  });

  it.skipIf(process.platform !== 'linux')(
    'sees a group whose members are gone as not running',
    async () => {
      const child = spawn('/bin/true', [], { detached: true, stdio: 'ignore' });
      const group = child.pid;
      expect(group).toBeDefined();
      if (group === undefined) return;
      // Wait for Node to reap it, so the group holds nothing at all.
      await new Promise(resolve => child.once('exit', resolve));
      expect(procGroupHasRunningMember(group)).toBe(false);
    },
  );

  // The stat layout parsed here is Linux's; a readable but differently shaped
  // /proc elsewhere would parse as "no live members" and call a running group
  // stopped. Undefined is what makes the caller fall back to the kill probe.
  // Only assertable off Linux — on Linux the guard is covered by the two cases
  // above returning a definite answer at all.
  it.skipIf(process.platform === 'linux')('declines to answer off Linux', () => {
    expect(procGroupHasRunningMember(process.pid)).toBeUndefined();
  });
});

describe('headless reviewer process lifecycle', () => {
  // The only real-process test of the SUCCESS path. Every other real-process
  // case here ends in a timeout, a rejected probe, or an uncleanable tree, so
  // without this one a break in the spawn → stdin → stdout → parse → cleanup
  // chain would only surface once a real reviewer ran. Cleanup in particular
  // runs on this path too, after the capability probe.
  it.skipIf(process.platform === 'win32')(
    'resolves a review that a real spawned process completed',
    async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const bin = trustedTemporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(
        executable,
        `#!/bin/sh
if [ "\${1:-}" = "--help" ]; then
  echo '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools'
  exit 0
fi
cat > /dev/null
printf '%s' '${JSON.stringify({ structured_output: output })}'
`,
      );
      chmodSync(executable, 0o755);
      vi.stubEnv('PATH', bin);

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'dispatch-1',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).resolves.toMatchObject({
        dispatch_id: 'dispatch-1',
        reviewer_agent: 'claude',
        verdict: 'approve',
      });
    },
  );

  it.skipIf(process.platform === 'win32').each([
    {
      name: 'unsupported capabilities',
      help: String.raw`printf '%s\n' '--output-format'`,
      failure: 'unsupported',
    },
    {
      name: 'capability probe launch failure',
      help: String.raw`printf '%s\n' 'probe failed' >&2; exit 7`,
      failure: 'launch_failed',
    },
  ])('classifies $name separately from a missing executable', async ({ help, failure }) => {
    const bin = trustedTemporaryDirectory();
    const project = temporaryDirectory();
    const untrustedRoot = temporaryDirectory();
    const executable = nodePath.join(bin, 'claude');
    writeFileSync(executable, `#!/bin/sh\n${help}\n`, { mode: 0o755 });
    chmodSync(executable, 0o755);
    vi.stubEnv('PATH', bin);

    await expect(
      runHeadlessReviewer(
        'claude',
        {
          schema_version: 1,
          dispatch_id: 'probe-classification',
          kind: 'quality-review',
          logical_files: [],
        },
        project,
        untrustedRoot,
      ),
    ).rejects.toMatchObject({ failure });
  });

  it.skipIf(process.platform === 'win32')(
    'stages a trusted copy of a reviewer found under a group-writable directory (e.g. Homebrew) instead of rejecting it',
    async () => {
      const bin = trustedTemporaryDirectory();
      const cacheDirectory = temporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(
        executable,
        `#!/bin/sh
if [ "\${1:-}" = "--help" ]; then
  echo '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools'
  exit 0
fi
cat > /dev/null
printf '%s' '${JSON.stringify({ structured_output: output })}'
`,
        { mode: 0o755 },
      );
      chmodSync(bin, 0o775);
      vi.stubEnv('PATH', bin);
      vi.stubEnv('SAFEWORD_REVIEWER_CACHE_DIR', cacheDirectory);

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'dispatch-1',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).resolves.toMatchObject({ dispatch_id: 'dispatch-1', verdict: 'approve' });

      const stagedEntries = readdirSync(cacheDirectory);
      expect(stagedEntries.some(entry => entry.startsWith('claude.'))).toBe(true);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'still rejects a reviewer whose ancestry is untrusted for a reason staging cannot fix',
    async () => {
      const bin = trustedTemporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      chmodSync(bin, 0o775);
      // A cache directory the process cannot write into (0o500, no write bit)
      // makes staging fail closed rather than silently granting trust.
      const unwritableCache = temporaryDirectory();
      chmodSync(unwritableCache, 0o500);
      vi.stubEnv('PATH', bin);
      vi.stubEnv('SAFEWORD_REVIEWER_CACHE_DIR', nodePath.join(unwritableCache, 'nested'));

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'untrusted-install',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).rejects.toMatchObject({ failure: 'untrusted_install' });
    },
  );

  it.skipIf(process.platform === 'win32')(
    'never stages a copy of a reviewer executable that is itself group-writable',
    async () => {
      const bin = trustedTemporaryDirectory();
      const cacheDirectory = temporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      chmodSync(executable, 0o775);
      vi.stubEnv('PATH', bin);
      vi.stubEnv('SAFEWORD_REVIEWER_CACHE_DIR', cacheDirectory);

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'writable-executable',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).rejects.toMatchObject({ failure: 'untrusted_install' });

      expect(existsSync(cacheDirectory) ? readdirSync(cacheDirectory) : []).toEqual([]);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'kills reviewer descendants after a timeout',
    async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const bin = trustedTemporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const childPidPath = nodePath.join(project, 'child.pid');
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(
        executable,
        `#!/bin/sh
if [ "\${1:-}" = "--help" ]; then
  echo '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools'
  exit 0
fi
/bin/sleep 30 &
echo $! > "$SAFEWORD_REVIEW_CHILD_PID"
wait
`,
      );
      chmodSync(executable, 0o755);
      vi.stubEnv('PATH', bin);
      // Leave the capability probe enough room under loaded CI; the reviewer
      // invocation itself still times out deterministically.
      vi.stubEnv('SAFEWORD_REVIEW_TIMEOUT_MS', '3000');
      vi.stubEnv('SAFEWORD_REVIEW_CHILD_PID', childPidPath);

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'timeout-tree',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).rejects.toMatchObject({ failure: 'timed_out' });

      await vi.waitFor(
        () => {
          expect(existsSync(childPidPath)).toBe(true);
        },
        { timeout: 2000 },
      );
      const childPid = Number(readFileSync(childPidPath, 'utf8'));
      await vi.waitFor(
        () => {
          expect(() => process.kill(childPid, 0)).toThrow();
        },
        { timeout: 2000 },
      );
    },
  );
});
