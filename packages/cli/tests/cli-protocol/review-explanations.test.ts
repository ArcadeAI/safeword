import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const SECRET = 'sk-live-do-not-leak-9f3a';

/**
 * `codex` never answers; `claude` fails loudly with a credential in its
 * diagnostic output and an off-contract answer. Together they produce the
 * failure pair seen most often in the field: the assigned reviewer times out
 * and the fallback's answer is refused.
 */
function installFailingReviewers(host: string): string {
  const bin = nodePath.join(host, 'bin');
  mkdirSync(bin, { recursive: true });

  writeFileSync(
    nodePath.join(bin, 'codex'),
    String.raw`#!/bin/sh
set -eu
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi
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
printf 'internal trace token=${SECRET}\n' >&2
printf '{"verdict":"looks fine","severity":"high"}\n'
`,
    { mode: 0o755 },
  );
  chmodSync(nodePath.join(bin, 'claude'), 0o755);
  return bin;
}

describe('explaining an exhausted run', () => {
  it('names each route its own cause, offers one next step, and leaks nothing', async () => {
    const directory = createTemporaryDirectory();
    const host = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'review-input.md'), 'bounded review input\n');
    const bin = installFailingReviewers(host);

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
          // Leave enough fallback budget under full-suite CPU contention: this
          // fixture owns the failure classes, not scheduler timing.
          SAFEWORD_REVIEW_TIMEOUT_MS: '2000',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '6000',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    const payload = JSON.parse(result.stdout) as {
      findings: { message: string }[];
      recovery: { description: string }[];
      data: Record<string, unknown>;
    };
    const explanation = payload.findings.map(finding => finding.message).join(' ');

    // Each route's own cause, not one generic failure.
    expect(explanation).toMatch(/ran out of time/i);
    expect(explanation).toMatch(/could not be accepted|not in the form|could not use/i);
    // Names the agents plainly so a reader knows which is which.
    expect(explanation).toMatch(/Codex/);
    expect(explanation).toMatch(/Claude/);

    // Exactly one thing to do next.
    expect(payload.recovery).toHaveLength(1);

    // Nothing the reviewers emitted reaches the reader.
    const rendered = JSON.stringify(payload);
    expect(rendered).not.toContain(SECRET);
    expect(rendered).not.toContain('internal trace');
    expect(rendered).not.toContain('looks fine');

    // And the run never claims a verdict it does not have.
    expect(payload.data).not.toHaveProperty('reviewer_output');
    expect(payload.data.independence).toBe('none');
  }, 30_000);
});
