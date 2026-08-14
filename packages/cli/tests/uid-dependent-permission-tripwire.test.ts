/**
 * Tripwire: no test may simulate an I/O failure by removing permissions.
 *
 * Root holds CAP_DAC_OVERRIDE and bypasses every file permission bit, so such a
 * simulation silently does not happen under uid 0 — the code takes the SUCCESS
 * path and the test fails while asserting on that success output.
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
 *
 * The detection lives in `helpers/permission-simulation.ts` so its own evasions
 * are testable; the cases below are the ones review found in the first version.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  chmodModeArguments,
  literalMode,
  permissionSimulations,
  withoutComments,
} from './helpers/permission-simulation.js';

const TEST_ROOT = import.meta.dirname;
const SCANNED_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx']);

function testFiles(directory: string): string[] {
  const found: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'node_modules') continue;
      found.push(...testFiles(full));
    } else if (SCANNED_EXTENSIONS.has(nodePath.extname(entry.name))) {
      found.push(full);
    }
  }
  return found;
}

describe('permission-simulation detection', () => {
  it('keeps a call whose line also holds a URL', () => {
    // A naive `//` strip deletes the rest of this line, hiding the call.
    const source = `const u = "https://x.com"; chmodSync(p, 0o000);`;
    expect(permissionSimulations(source)).toEqual(['chmodSync(…, 0o000)']);
  });

  it.each(['a // chmodSync(p, 0o000)\nb', '/* chmodSync(p, 0o000) */ b'])(
    'blanks comment content while keeping offsets aligned: %j',
    source => {
      const stripped = withoutComments(source);
      // Content gone, so a documented example cannot be read as a violation…
      expect(stripped).not.toContain('chmodSync');
      // …but length and newlines preserved, so a reported offset still points
      // at the line it came from.
      expect(stripped).toHaveLength(source.length);
      expect(stripped.split('\n')).toHaveLength(source.split('\n').length);
    },
  );

  it('reads a mode wrapped onto its own line with a trailing comma', () => {
    expect(chmodModeArguments('chmodSync(\n  path,\n  0o000,\n)').map(c => c.mode)).toEqual([
      '0o000',
    ]);
  });

  it('reads a mode past a path argument containing its own comma', () => {
    expect(chmodModeArguments(`chmodSync(nodePath.join(a, b), 0o000)`).map(c => c.mode)).toEqual([
      '0o000',
    ]);
  });

  it.each([
    ['0o000', 0o000],
    ['0o200', 0o200],
    ['0o755', 0o755],
    ['0', 0],
    [`'000'`, 0],
    [`"600"`, 0o600],
  ])('evaluates the literal mode %s', (argument, expected) => {
    expect(literalMode(argument)).toBe(expected);
  });

  it('cannot evaluate a variable mode, and says so rather than guessing', () => {
    expect(literalMode('mode')).toBeUndefined();
  });

  it.each([`chmodSync(p, 0)`, `chmodSync(p, '000')`, `chmodSync(p, 0o200)`])(
    'flags %s as removing access',
    source => {
      expect(permissionSimulations(source)).toHaveLength(1);
    },
  );

  it('waives a call a root guard already covers', () => {
    // The established form in this repo: the test refuses to run as root, so the
    // simulation is never relied upon. Flagging it would push authors to delete
    // a correct guard.
    const source = [
      'it.skipIf(process.getuid?.() === 0)(',
      "  'fails when the file is not writable',",
      '  async () => {',
      '    chmodSync(path, 0o444);',
      '  },',
      ');',
    ].join('\n');
    expect(permissionSimulations(source)).toEqual([]);
  });

  it('still flags the same call with no root guard in reach', () => {
    expect(permissionSimulations('chmodSync(path, 0o444);')).toEqual(['chmodSync(…, 0o444)']);
  });

  it.each([`chmodSync(p, 0o755)`, `chmodSync(p, 0o644)`, `chmodSync(p, '700')`])(
    'allows %s',
    source => {
      expect(permissionSimulations(source)).toEqual([]);
    },
  );
});

describe('uid-dependent permission simulations', () => {
  it('no test removes owner read or write to simulate an I/O failure', () => {
    const offenders: string[] = [];

    for (const file of testFiles(TEST_ROOT)) {
      if (file.endsWith('uid-dependent-permission-tripwire.test.ts')) continue;
      const relative = nodePath.relative(TEST_ROOT, file);
      const found = permissionSimulations(readFileSync(file, 'utf8'));
      for (const offender of found) offenders.push(`${relative}: ${offender}`);
    }

    expect(
      offenders,
      'Root bypasses permission bits, so these simulate nothing under uid 0 — ' +
        'the test passes in CI (uid 1001) and fails in every root container. ' +
        'Use tests/helpers/io-failure.ts instead.',
    ).toEqual([]);
  });
});
