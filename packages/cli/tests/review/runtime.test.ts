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
  inspectReviewRoute,
  parseProcessStat,
  parseReviewerOutput,
  planReviewRubric,
  procGroupHasRunningMember,
  qualityReviewRubric,
  reviewerArguments,
  reviewTimeoutMilliseconds,
  runBoundMs,
  runHeadlessReviewer,
  scenarioReviewRubric,
} from '../../src/review/runtime.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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

describe('scenario review rubric', () => {
  it('uses the generated canonical quality-review severity contract', () => {
    const rubric = qualityReviewRubric();
    const normalized = rubric.replaceAll(/\s+/gu, ' ');
    expect(normalized).toContain('Shared adversarial-review severity foundation');
    expect(normalized).toContain('Check correctness, regressions, edge cases');
    expect(normalized).toContain('concrete, release-relevant failure');
    expect(normalized).toContain('violated requirement, regression, established invariant');
    expect(normalized).toContain('triggering conditions and the observable consequence');
    expect(normalized).toContain('Speculative future-proofing');
    expect(normalized).toContain('inside a trusted boundary');
    expect(normalized).toContain('Do not expand the accepted scope');
    expect(normalized).toContain('supplied proof is non-discriminating');
    expect(normalized).toContain('future unsupported host or version');
    expect(normalized).toContain('actor inside an explicitly trusted boundary');
  });

  it('uses a non-empty reviewer-only generated rubric', () => {
    const rubric = scenarioReviewRubric();
    expect(rubric).toContain('Shared adversarial-review severity foundation');
    expect(rubric).toContain('## Shared scenario-quality rubric');
    expect(rubric).toContain('**Must Fix** for correctness or structural');
    expect(rubric).toContain('and `info`, respectively');
    expect(rubric).not.toContain('run-review.ts');
    expect(rubric).not.toContain('Authoring mode');
    expect(rubric).not.toContain('Review mode');
  });

  it('uses the generated canonical implementation-plan rubric', () => {
    const rubric = planReviewRubric();
    expect(rubric).toContain('Shared adversarial-review severity foundation');
    expect(rubric).toContain('## Shared implementation-plan judgment standard');
    expect(rubric).toContain('Apply the deletion test');
    expect(rubric).not.toContain('run-review.ts');
  });
});

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

describe('review route inspection', () => {
  it('distinguishes OpenCode catalogue presence from runtime-default routes', async () => {
    const bin = trustedTemporaryDirectory();
    const project = temporaryDirectory();
    const executable = nodePath.join(bin, 'opencode');
    writeFileSync(
      executable,
      `#!/bin/sh
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then echo '--format --pure --model'; exit 0; fi
if [ "\${1:-}" = "models" ]; then printf 'vendor/model-a\nvendor/model-b\n'; exit 0; fi
exit 9
`,
    );
    chmodSync(executable, 0o755);
    vi.stubEnv('PATH', bin);

    await expect(inspectReviewRoute('opencode', 'vendor/model-b', project)).resolves.toEqual({
      installed: true,
      compatibility: 'compatible',
      catalogue: 'catalogued',
    });
    await expect(inspectReviewRoute('opencode', undefined, project)).resolves.toEqual({
      installed: true,
      compatibility: 'compatible',
      catalogue: 'not_applicable',
    });
  });

  it('reports an installed runtime without model selection as incompatible', async () => {
    const bin = trustedTemporaryDirectory();
    const project = temporaryDirectory();
    const executable = nodePath.join(bin, 'codex');
    writeFileSync(
      executable,
      `#!/bin/sh
echo '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema'
`,
    );
    chmodSync(executable, 0o755);
    vi.stubEnv('PATH', bin);

    await expect(inspectReviewRoute('codex', 'model-a', project)).resolves.toEqual({
      installed: true,
      compatibility: 'not_compatible',
      catalogue: 'unavailable',
    });
  });

  it('treats empty OpenCode catalogue output as unavailable rather than absent', async () => {
    const bin = trustedTemporaryDirectory();
    const project = temporaryDirectory();
    const executable = nodePath.join(bin, 'opencode');
    writeFileSync(
      executable,
      `#!/bin/sh
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then echo '--format --pure --model'; exit 0; fi
if [ "\${1:-}" = "models" ]; then exit 0; fi
exit 9
`,
    );
    chmodSync(executable, 0o755);
    vi.stubEnv('PATH', bin);

    await expect(inspectReviewRoute('opencode', 'vendor/model-a', project)).resolves.toEqual({
      installed: true,
      compatibility: 'compatible',
      catalogue: 'unavailable',
    });
  });

  it.skipIf(process.platform === 'win32')(
    'does not report a stageable reviewer as missing during read-only inspection',
    async () => {
      const bin = trustedTemporaryDirectory();
      const project = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      chmodSync(bin, 0o775);
      vi.stubEnv('PATH', bin);

      await expect(inspectReviewRoute('claude', undefined, project)).resolves.toEqual({
        installed: true,
        compatibility: 'inspection_unavailable',
        catalogue: 'unavailable',
      });
    },
  );
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

  it('extracts one completed text result from OpenCode JSON events', () => {
    const opencodeOutput = { ...output, reviewer_agent: 'opencode' as const };
    const stdout = [
      JSON.stringify({ type: 'step_start', part: { type: 'step-start' } }),
      JSON.stringify({
        type: 'text',
        part: {
          type: 'text',
          text: JSON.stringify(opencodeOutput),
          time: { start: 1, end: 2 },
        },
      }),
    ].join('\n');

    expect(parseReviewerOutput('opencode', stdout)).toEqual(opencodeOutput);
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

  // Tripwire. `safeword codex status` tells users a stale Codex Desktop
  // catalogue leaves reviews unaffected. That promise is only true while the
  // Codex reviewer runs ephemeral with its hooks and user config disabled.
  // If these flags ever move, the status message becomes a lie — fix both.
  it('keeps the Codex reviewer insulated from the Codex app catalogue', () => {
    const args = reviewerArguments('codex', undefined, undefined);

    expect(args).toContain('--ephemeral');
    expect(args).toContain('--ignore-user-config');
    expect(args).toContain('--ignore-rules');
    expect(args.slice(args.indexOf('--disable'), args.indexOf('--disable') + 2)).toEqual([
      '--disable',
      'hooks',
    ]);
  });

  it('appends Claude model flags without adding a positional marker', () => {
    const args = reviewerArguments('claude', 'claude-test', undefined);

    expect(args.slice(-2)).toEqual(['--model', 'claude-test']);
    expect(args).not.toContain('-');
  });

  it('appends an explicitly configured Claude effort level', () => {
    const args = reviewerArguments('claude', 'sonnet', undefined, {
      SAFEWORD_REVIEW_EFFORT_CLAUDE: 'low',
    });

    expect(args.slice(-4)).toEqual(['--model', 'sonnet', '--effort', 'low']);
  });

  it.each(['', 'auto', '--help', 'LOW', ' low '])(
    'ignores an invalid Claude effort level: %s',
    effort => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const args = reviewerArguments('claude', undefined, undefined, {
        SAFEWORD_REVIEW_EFFORT_CLAUDE: effort,
      });

      expect(args).not.toContain('--effort');
    },
  );

  it.each(['auto', '--help', 'LOW', ' low '])(
    'warns that a misconfigured Claude effort level was ignored: %s',
    effort => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      reviewerArguments('claude', undefined, undefined, {
        SAFEWORD_REVIEW_EFFORT_CLAUDE: effort,
      });

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain(effort);
    },
  );

  it.each([undefined, '', ' '.repeat(3)])(
    'stays quiet when Claude effort is unset rather than mistyped: %s',
    effort => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      reviewerArguments('claude', undefined, undefined, {
        SAFEWORD_REVIEW_EFFORT_CLAUDE: effort,
      });

      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it('does not warn about Claude effort configuration when reviewing with Codex', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reviewerArguments('codex', undefined, '/tmp/schema.json', {
      SAFEWORD_REVIEW_EFFORT_CLAUDE: 'nonsense',
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never passes Claude effort configuration to Codex', () => {
    const args = reviewerArguments('codex', undefined, '/tmp/schema.json', {
      SAFEWORD_REVIEW_EFFORT_CLAUDE: 'low',
    });

    expect(args).not.toContain('--effort');
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
      // The staged copy must itself pass the ancestry check, so the cache needs
      // a private root — CI's shared /tmp is world-writable.
      const cacheDirectory = trustedTemporaryDirectory();
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
      // A cache directory the reviewed project controls is refused outright, so
      // staging cannot rescue this candidate and the trust rejection stands.
      vi.stubEnv('PATH', bin);
      vi.stubEnv('SAFEWORD_REVIEWER_CACHE_DIR', nodePath.join(untrustedRoot, 'cache'));

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

  // Staging moves the executable, so a shim that resolves siblings relative to
  // its own location stops working once copied. That is not silently accepted:
  // the capability probe rejects the staged copy like any other incompatible
  // candidate, so the run fails closed rather than reviewing with a broken
  // reviewer.
  it.skipIf(process.platform === 'win32')(
    'fails closed when a relocated location-dependent reviewer can no longer run',
    async () => {
      const bin = trustedTemporaryDirectory();
      // Staging must succeed here so the capability probe is what rejects it.
      const cacheDirectory = trustedTemporaryDirectory();
      const project = temporaryDirectory();
      const untrustedRoot = temporaryDirectory();
      const executable = nodePath.join(bin, 'claude');
      // Only advertises its capabilities when its install-dir sibling is present.
      writeFileSync(nodePath.join(bin, 'capabilities.txt'), REVIEWER_CAPABILITIES.claude);
      writeFileSync(
        executable,
        `#!/bin/sh
cat "$(dirname "$0")/capabilities.txt" || exit 3
`,
        { mode: 0o755 },
      );
      chmodSync(executable, 0o755);
      chmodSync(bin, 0o775);
      vi.stubEnv('PATH', bin);
      vi.stubEnv('SAFEWORD_REVIEWER_CACHE_DIR', cacheDirectory);

      await expect(
        runHeadlessReviewer(
          'claude',
          {
            schema_version: 1,
            dispatch_id: 'relocated-shim',
            kind: 'quality-review',
            logical_files: [],
          },
          project,
          untrustedRoot,
        ),
      ).rejects.toMatchObject({ failure: 'launch_failed' });
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
