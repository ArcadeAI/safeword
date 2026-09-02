import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../helpers.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

/**
 * When the assigned reviewer fails and the author's own runtime completes the
 * review, the reader is told the check was not independent. They should also be
 * told *why* it fell back — the coordinator already classifies the cause, and
 * `causePhrase` already renders every class in plain words.
 *
 * This matters most for `timed_out`: it was 13 of 15 observed field failures,
 * and it is the class a reader is most likely to act on by retrying.
 */
const directories: string[] = [];
type ReviewerFailure = 'hang' | 'process';

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function scratch(trusted = false): string {
  const directory = trusted
    ? createTrustedReviewerDirectory('safeword-degraded-reviewer-')
    : mkdtempSync(nodePath.join(tmpdir(), 'safeword-degraded-'));
  directories.push(directory);
  return directory;
}

function reviewerBody(failure: ReviewerFailure): string {
  switch (failure) {
    case 'hang': {
      return 'exec /bin/sleep 3600';
    }
    case 'process': {
      return 'exit 3';
    }
  }
}

/** Installs a reviewer that fails a given way, plus an author runtime that answers. */
function installReviewers(host: string, assignedFails: ReviewerFailure): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });

  const codexBody = reviewerBody(assignedFails);
  writeFileSync(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi
${codexBody}
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'codex'), 0o755);

  writeFileSync(
    nodePath.join(bin, 'claude'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.claude}'; exit 0; fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'claude'), 0o755);
  return bin;
}

async function degradedMessage(assignedFails: ReviewerFailure): Promise<string> {
  const directory = scratch();
  writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
  const bin = installReviewers(scratch(true), assignedFails);

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
        PATH: `${bin}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: 'claude',
        SAFEWORD_REVIEW_TIMEOUT_MS: '2000',
        SAFEWORD_REVIEW_RUN_BOUND_MS: '10000',
        SAFEWORD_NO_UPDATE_CHECK: '1',
      },
    },
  );
  const payload = JSON.parse(result.stdout) as {
    findings: { code: string; message: string }[];
    data: Record<string, unknown>;
  };
  expect(payload.data.independence, result.stdout).toBe('degraded');
  return payload.findings.map(finding => finding.message).join(' ');
}

describe('a degraded review explains why it fell back', () => {
  it('names a timed-out reviewer, the commonest field failure', async () => {
    const message = await degradedMessage('hang');

    expect(message).toMatch(/ran out of time/iu);
    // And still says what happened instead, and that it was isolated.
    expect(message).toMatch(/not independent/iu);
    expect(message).toMatch(/separate headless process/iu);
  }, 30_000);

  it('explains when a reviewer process exits without a review', async () => {
    const message = await degradedMessage('process');

    expect(message).toMatch(/exited before returning a review/iu);
    expect(message).toMatch(/not independent/iu);
  }, 30_000);
});
