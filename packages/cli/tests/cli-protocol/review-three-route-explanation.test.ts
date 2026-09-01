import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
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
 * Four routes, four different causes: the reviewer's default model never
 * answers, its alternate model is not signed in, OpenCode is unavailable, and
 * the author's own runtime answers off-contract.
 */
function installThreeFailures(host: string): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });

  writeFileSync(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--model'; then
  printf 'not logged in\n' >&2
  exit 1
fi
exec /bin/sleep 3600
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'codex'), 0o755);

  writeFileSync(
    nodePath.join(bin, 'claude'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.claude}'; exit 0; fi
printf 'not-a-review\n'
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'claude'), 0o755);
  return bin;
}

describe('when all four routes fail', () => {
  it('keeps each route its own cause, including the alternate model', async () => {
    const directory = createTemporaryDirectory();
    const host = createTrustedReviewerDirectory('safeword-three-route-');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } }),
    );
    const bin = installThreeFailures(host);

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
          SAFEWORD_REVIEW_TIMEOUT_MS: '2500',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '12000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const payload = JSON.parse(result.stdout) as {
      findings: { message: string }[];
      data: Record<string, unknown>;
    };
    const explanation = payload.findings.map(finding => finding.message).join(' ');

    // Four attempts, four distinct causes.
    expect(explanation).toMatch(/ran out of time/i);
    expect(explanation).toMatch(/not signed in/i);
    expect(explanation).toMatch(/OpenCode.*not found on PATH/i);
    expect(explanation).toMatch(/could not be accepted/i);
    // The alternate-model attempt names the selected model so operators can
    // distinguish a failed override from the primary route.
    expect(explanation).toMatch(/alternate model/i);
    expect(explanation).toContain('vendor-model-2');
    expect(payload.data).toMatchObject({
      alternate_model: 'vendor-model-2',
      alternate_model_failure: 'not_authenticated',
    });
    expect(payload.data.independence).toBe('none');
  }, 30_000);
});
