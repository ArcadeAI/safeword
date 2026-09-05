import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

afterAll(cleanupTrustedReviewerDirectories);

/** The default model times out before the alternate exposes expired auth. */
function installTimedOutPrimaryWithUnauthenticatedAlternate(host: string): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });

  writeFileSync(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi
printf 'codex\n' >> "$SAFEWORD_REVIEW_ROUTE_LOG"
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
printf 'claude\n' >> "$SAFEWORD_REVIEW_ROUTE_LOG"
printf 'not-a-review\n'
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'claude'), 0o755);
  return bin;
}

describe('when an alternate independent route exposes expired authentication', () => {
  it('returns a reauthentication handoff without launching the author fallback', async () => {
    const directory = createTemporaryDirectory();
    const host = createTrustedReviewerDirectory('safeword-alternate-auth-');
    const routeLog = nodePath.join(directory, 'routes.log');
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewAlternateModel: { codex: 'vendor-model-2' } }),
    );
    const bin = installTimedOutPrimaryWithUnauthenticatedAlternate(host);

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
          SAFEWORD_REVIEW_ROUTE_LOG: routeLog,
          SAFEWORD_REVIEW_TIMEOUT_MS: '800',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '6000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const payload = JSON.parse(result.stdout) as {
      findings: { code: string; message: string }[];
      recovery: { command: string }[];
      data: Record<string, unknown>;
    };
    const explanation = payload.findings.map(finding => finding.message).join(' ');

    expect(result.exitCode, result.stdout).toBe(2);
    expect(payload.findings[0]?.code).toBe('REVIEW_AUTHENTICATION_REQUIRED');
    expect(explanation).toMatch(/reauthenticate Codex/iu);
    expect(payload.recovery).toEqual([expect.objectContaining({ command: 'codex login' })]);
    expect(payload.data).toMatchObject({
      preferred_failure: 'timed_out',
      alternate_model: 'vendor-model-2',
      alternate_model_failure: 'not_authenticated',
    });
    expect(payload.data).not.toHaveProperty('fallback_failure');
    expect(payload.data.independence).toBe('none');
    expect(readFileSync(routeLog, 'utf8')).toBe('codex\ncodex\n');
  }, 30_000);
});
