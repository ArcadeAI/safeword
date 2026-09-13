import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import type { RedExecutionAttestation } from '../../src/review/contract.js';
import { runReview } from '../../src/review/coordinator.js';
import { createTemporaryDirectory } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
} from '../review-fixtures.js';

afterAll(cleanupTrustedReviewerDirectories);
afterEach(() => vi.unstubAllEnvs());

function attestation(): RedExecutionAttestation {
  return {
    schema_version: 1,
    argv: ['bun', 'run', 'proof'],
    cwd: '.',
    evidence_class: 'pure-contract',
    expected_failure: { literal: 'missing behavior', matched: true },
    timeout_ms: 1000,
    source_fingerprint: 'a'.repeat(64),
    environment: {
      sha256: 'b'.repeat(64),
      variable_count: 1,
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    started_at: '2026-09-13T00:00:00.000Z',
    finished_at: '2026-09-13T00:00:01.000Z',
    duration_ms: 1000,
    // eslint-disable-next-line unicorn/no-null -- persisted process termination uses JSON null.
    termination: { exit_code: 1, signal: null, timed_out: false },
    stdout: { excerpt: '', bytes: 0, sha256: 'c'.repeat(64), truncated: false },
    stderr: {
      excerpt: 'missing behavior\n',
      bytes: 17,
      sha256: 'd'.repeat(64),
      truncated: false,
    },
  };
}

describe('executable RED alternate-model review', () => {
  it('keeps the trusted execution attestation after the primary model fails', async () => {
    const directory = createTemporaryDirectory();
    const bin = nodePath.join(createTrustedReviewerDirectory('safeword-alt-red-'), 'bin');
    const log = nodePath.join(directory, 'review.log');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword/config.json'),
      JSON.stringify({
        crossAgentReviewPrimaryModel: { codex: 'vendor-model-1' },
        crossAgentReviewAlternateModel: { codex: 'vendor-model-2' },
      }),
    );
    writeFileSync(nodePath.join(directory, 'proof.md'), 'actor-boundary proof\n');
    const reviewer = nodePath.join(bin, 'codex');
    writeFileSync(
      reviewer,
      String.raw`#!/bin/sh
set -eu
if [ "\${1:-}" = "--version" ]; then printf 'codex 1.0.0\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\n' '--json --sandbox --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --disable --config --output-schema --model'
  exit 0
fi
printf '%s\n' "$*" >> "$SAFEWORD_REVIEW_LOG"
payload=$(cat)
if printf '%s' "$*" | /usr/bin/grep -q -- 'vendor-model-1'; then exit 7; fi
printf '%s' "$payload" | /usr/bin/grep -q 'execution_attestation'
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}\n' "$dispatch_id"
`,
    );
    chmodSync(reviewer, 0o755);
    vi.stubEnv('PATH', `${bin}:/usr/bin:/bin`);
    vi.stubEnv('SAFEWORD_AGENT_RUNTIME', 'claude');
    vi.stubEnv('SAFEWORD_REVIEW_LOG', log);

    const result = await runReview({
      cwd: directory,
      kind: 'executable-red',
      targets: ['proof.md'],
      executionAttestation: attestation(),
    });

    expect(result).toMatchObject({
      state: 'healthy',
      data: { status: 'approved', reviewer_model: 'vendor-model-2' },
    });
  });
});
