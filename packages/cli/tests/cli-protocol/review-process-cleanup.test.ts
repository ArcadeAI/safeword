import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../review-fixtures.js';

afterAll(cleanupTrustedReviewerDirectories);

const CODEX_CAPABILITIES =
  '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --model --output-schema';

/**
 * A reviewer that leaves a grandchild behind. The grandchild inherits stdout —
 * which is what holds the parent's pipes open after a bare kill — records its
 * own pid, and then sleeps far longer than the run. Cleanup that reaches the
 * whole process group ends it; cleanup that only kills the direct child does
 * not.
 */
function installReviewerWithSurvivingChild(host: string, pidFile: string): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${CODEX_CAPABILITIES}'
  exit 0
fi
/bin/sh -c 'printf "%s" "$$" > "${pidFile}"; exec /bin/sleep 3600' &
exec /bin/sleep 3600
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function installReviewerThatExitsAfterAnswering(host: string, pidFile: string): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '${CODEX_CAPABILITIES}'
  exit 0
fi
/bin/sleep 3600 >/dev/null 2>&1 &
printf '%s' "$!" > "${pidFile}"
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{\"schema_version\":1,\"dispatch_id\":\"daemon-test\",\"reviewer_agent\":\"codex\",\"verdict\":\"approve\",\"summary\":\"Looks good.\",\"findings\":[]}"}}'
exit 0
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('stopping a reviewer', () => {
  it('reaches the descendants it left behind, and does not wait on them', async () => {
    const directory = createTemporaryDirectory();
    const host = createTrustedReviewerDirectory('safeword-process-cleanup-');
    const pidFile = nodePath.join(host, 'grandchild.pid');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installReviewerWithSurvivingChild(host, pidFile);

    const startedAt = Date.now();
    await runCli(
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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_TIMEOUT_MS: '1600',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '3000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    // A grandchild holding the pipes open must not have held up the run.
    expect(Date.now() - startedAt).toBeLessThan(4500);

    expect(existsSync(pidFile)).toBe(true);
    const grandchild = Number(readFileSync(pidFile, 'utf8').trim());
    expect(Number.isSafeInteger(grandchild)).toBe(true);

    // Poll the observable condition: the descendant is gone.
    await expect.poll(() => isRunning(grandchild), { timeout: 8000 }).toBe(false);
  }, 30_000);

  it('reaps descendants even when the reviewer leader exits after answering', async () => {
    const directory = createTemporaryDirectory();
    const host = createTrustedReviewerDirectory('safeword-process-cleanup-answer-');
    const pidFile = nodePath.join(host, 'daemon.pid');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installReviewerThatExitsAfterAnswering(host, pidFile);

    await runCli(
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
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_REVIEW_TIMEOUT_MS: '2000',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '4000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(existsSync(pidFile)).toBe(true);
    const descendant = Number(readFileSync(pidFile, 'utf8').trim());
    await expect.poll(() => isRunning(descendant), { timeout: 8000 }).toBe(false);
  }, 30_000);
});
