import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

afterAll(cleanupTrustedReviewerDirectories);

/**
 * Installs one `codex` per directory, each either hanging forever or answering
 * at once, so a test can see how a route's deadline is divided between them.
 * `exec` keeps the process directly killable — surviving descendants are a
 * separate concern.
 */
function installCandidate(directory: string, name: string, behaviour: 'hang' | 'answer'): string {
  const bin = nodePath.join(directory, name);
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  const body =
    behaviour === 'hang'
      ? 'exec /bin/sleep 3600'
      : String.raw`payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
escaped=$(printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}' "$dispatch_id" | sed 's/"/\\"/g')
printf '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"%s"}}\n' "$escaped"`;
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'
  exit 0
fi
printf '${name}\n' >> "$SAFEWORD_REVIEW_CANDIDATE_LOG"
${body}
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installHangingProbe(directory: string): string {
  const bin = nodePath.join(directory, 'hanging-probe');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    `#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  trap '' TERM
  exec /bin/sleep 3
fi
exit 1
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installTermResistantCandidate(directory: string): string {
  const bin = nodePath.join(directory, 'term-resistant');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'
  exit 0
fi
printf 'term-resistant\n' >> "$SAFEWORD_REVIEW_CANDIDATE_LOG"
printf '%s\n' "$$" > "$SAFEWORD_REVIEW_STUBBORN_PID"
trap '' TERM
while :; do :; done
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

describe('dividing a route between its candidates', () => {
  it('leaves a later candidate a real turn when an earlier one hangs', async () => {
    const directory = createTemporaryDirectory();
    const candidateLog = nodePath.join(directory, 'candidates.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    // Outside the reviewed project, so candidate selection keeps them.
    const host = createTrustedReviewerDirectory('safeword-candidate-');
    const stale = installCandidate(host, 'stale', 'hang');
    const working = installCandidate(host, 'working', 'answer');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${stale}:${working}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_CANDIDATE_LOG: candidateLog,
          SAFEWORD_REVIEW_TIMEOUT_MS: '4000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const tried = existsSync(candidateLog)
      ? readFileSync(candidateLog, 'utf8').split('\n').filter(Boolean)
      : [];
    // Both are asked; the stale one must not have eaten the whole route.
    expect(tried).toEqual(['stale', 'working']);
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: {
        assigned_reviewer: 'codex',
        actual_reviewer: 'codex',
        independence: 'cross-agent',
      },
    });
  });

  it('bounds a capability probe that ignores its termination signal', async () => {
    const directory = createTemporaryDirectory();
    const candidateLog = nodePath.join(directory, 'candidates.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const host = createTrustedReviewerDirectory('safeword-candidate-');
    const stale = installHangingProbe(host);
    const working = installCandidate(host, 'working-after-probe', 'answer');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${stale}:${working}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_CANDIDATE_LOG: candidateLog,
          SAFEWORD_REVIEW_TIMEOUT_MS: '4000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
        timeout: 6000,
      },
    );

    expect(result.timedOut).toBe(false);
    expect(readFileSync(candidateLog, 'utf8').trim()).toBe('working-after-probe');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: { actual_reviewer: 'codex', independence: 'cross-agent' },
    });
  });

  it('terminates a timed-out reviewer process group before a later candidate continues', async () => {
    const directory = createTemporaryDirectory();
    const target = nodePath.join(directory, 'review-input.md');
    const candidateLog = nodePath.join(directory, 'candidates.log');
    const pidLog = nodePath.join(directory, 'stubborn.pid');
    writeFileSync(target, 'bounded review input\n');
    const host = createTrustedReviewerDirectory('safeword-candidate-');
    const stale = installTermResistantCandidate(host);
    const working = installCandidate(host, 'working-after-stubborn', 'answer');

    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        'review-input.md',
        '--json',
        '--no-input',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${stale}:${working}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_CANDIDATE_LOG: candidateLog,
          SAFEWORD_REVIEW_STUBBORN_PID: pidLog,
          SAFEWORD_REVIEW_TIMEOUT_MS: '4000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
        timeout: 6000,
      },
    );

    expect(result.timedOut).toBe(false);
    expect(readFileSync(candidateLog, 'utf8').trim().split('\n')).toEqual([
      'term-resistant',
      'working-after-stubborn',
    ]);
    const stubbornPid = Number(readFileSync(pidLog, 'utf8').trim());
    expect(() => process.kill(-stubbornPid, 0)).toThrow();
    expect(readFileSync(target, 'utf8')).toBe('bounded review input\n');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: { actual_reviewer: 'codex', independence: 'cross-agent' },
    });
  });
});
