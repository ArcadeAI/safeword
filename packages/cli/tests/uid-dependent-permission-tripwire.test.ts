/**
 * Tripwire: no test may simulate an I/O failure with a restrictive chmod.
 *
 * Root holds CAP_DAC_OVERRIDE and bypasses every file permission bit, so a
 * chmod-based simulation silently does not happen under uid 0 — the code takes
 * the SUCCESS path and the test fails while asserting on that success output.
 *
 * The damage is that the failure is environment-split and therefore invisible
 * to the author. GitHub Actions runs as `runner` (uid 1001), so the test is
 * green in CI and red in every root container: agent sessions, devcontainers,
 * plain `docker run`. A reader in a container sees a broken suite and cannot
 * tell which failures are real.
 *
 * Use `tests/helpers/io-failure.ts` instead — it induces failures through
 * filesystem structure (EISDIR / ENOTDIR / ELOOP, or a /dev/null sink), which
 * no uid can override.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const TEST_ROOT = import.meta.dirname;

/** Owner read+write. A mode missing either bit is a permission simulation. */
const OWNER_READ_WRITE = 0o600;

/** `chmodSync(target, 0o___)` — captures the octal literal. */
const CHMOD_OCTAL = /chmodSync\([^,]+,\s*(0o[0-7]{3,4})\s*\)/gu;

/** `chmod a-w`, `chmod -w`, `chmod 000`, `chmod u-w` inside shell fixtures. */
const SHELL_CHMOD_REMOVING_ACCESS = /chmod\s+(?:[augo]*-[rw]|0?[0-5][0-7][0-7]\b)/gu;

/**
 * Drops line and block comments so prose ABOUT this rule — including the
 * comments the fixes left behind explaining why chmod was replaced — is not
 * mistaken for a violation.
 */
function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/\/\/[^\n]*/gu, '');
}

function testFiles(directory: string): string[] {
  const found: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'node_modules') continue;
      found.push(...testFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('uid-dependent permission simulations', () => {
  it('no test chmods away owner read or write to simulate an I/O failure', () => {
    const offenders: string[] = [];

    for (const file of testFiles(TEST_ROOT)) {
      if (file.endsWith('uid-dependent-permission-tripwire.test.ts')) continue;
      const source = withoutComments(readFileSync(file, 'utf8'));
      const relative = nodePath.relative(TEST_ROOT, file);

      const octalModes = source
        .matchAll(CHMOD_OCTAL)
        .map(match => match[1] ?? '0o600')
        .toArray();
      for (const literal of octalModes) {
        const mode = Number.parseInt(literal.slice(2), 8);
        if ((mode & OWNER_READ_WRITE) !== OWNER_READ_WRITE) {
          offenders.push(`${relative}: chmodSync(…, ${literal})`);
        }
      }

      for (const match of source.matchAll(SHELL_CHMOD_REMOVING_ACCESS)) {
        offenders.push(`${relative}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      'Root bypasses permission bits, so these simulate nothing under uid 0 — ' +
        'the test passes in CI (uid 1001) and fails in every root container. ' +
        'Use tests/helpers/io-failure.ts instead.',
    ).toEqual([]);
  });
});
