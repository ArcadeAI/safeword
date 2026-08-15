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
} from './helpers/permission-simulation.js';

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const SCANNED_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx']);
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.project',
  '.safeword',
  'dist',
  'fixtures',
  'node_modules',
]);

function testFiles(directory: string): string[] {
  const found: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      found.push(...testFiles(full));
    } else if (
      SCANNED_EXTENSIONS.has(nodePath.extname(entry.name)) &&
      (full.includes(`${nodePath.sep}tests${nodePath.sep}`) || entry.name.includes('.test.'))
    ) {
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
    'ignores calls in comments: %j',
    source => {
      expect(permissionSimulations(source)).toEqual([]);
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

  it('waives a call under a chained root guard', () => {
    const source = [
      'it.skipIf(process.getuid?.() === 0).each([1, 2])("guarded", () => {',
      '  chmodSync(path, 0o444);',
      '});',
    ].join('\n');
    expect(permissionSimulations(source)).toEqual([]);
  });

  it('waives a call under a root-guarded suite', () => {
    const source = [
      'describe.skipIf(process.getuid?.() === 0)("guarded", () => {',
      '  it("fails", () => chmodSync(path, 0o444));',
      '});',
    ].join('\n');
    expect(permissionSimulations(source)).toEqual([]);
  });

  it('still flags the same call with no root guard in reach', () => {
    expect(permissionSimulations('chmodSync(path, 0o444);')).toEqual(['chmodSync(…, 0o444)']);
  });

  it('does not let a guarded test waive a neighboring unguarded test', () => {
    const source = [
      'it.skipIf(process.getuid?.() === 0)("guarded", () => {',
      '  chmodSync(guardedPath, 0o444);',
      '});',
      'it("unguarded", () => {',
      '  chmodSync(unguardedPath, 0o444);',
      '});',
    ].join('\n');

    expect(permissionSimulations(source)).toEqual(['chmodSync(…, 0o444)']);
  });

  it('does not treat an unrelated getuid reference as a root-skip waiver', () => {
    const source =
      'it("unguarded", () => { expect(process.getuid?.()).toBe(501); chmodSync(p, 0o444); });';
    expect(permissionSimulations(source)).toEqual(['chmodSync(…, 0o444)']);
  });

  it('does not accept an inverted root guard as a waiver', () => {
    const source = 'it.skipIf(process.getuid?.() !== 0)("root only", () => chmodSync(p, 0o444));';
    expect(permissionSimulations(source)).toEqual(['chmodSync(…, 0o444)']);
  });

  it.each([`chmodSync(p, 0o755)`, `chmodSync(p, 0o644)`, `chmodSync(p, '700')`])(
    'allows %s',
    source => {
      expect(permissionSimulations(source)).toEqual([]);
    },
  );

  // Review found these four ways to remove access that the first detector did
  // not see. Every one is a form someone reaches for without trying to evade
  // anything: a recursive chmod, a symbolic mode, chmod as a subprocess, and
  // the promise API.
  it.each([
    ['a flag between chmod and its mode', 'const command = "chmod -R a-w dir";'],
    ['a symbolic mode that assigns away write', 'const command = "chmod u=r file";'],
    ['a four-digit numeric mode', 'const command = "chmod 4000 file";'],
    ['a compound symbolic mode', 'const command = "chmod u=r,go= file";'],
    ['chmod invoked as a subprocess with an argv array', `execFileSync('chmod', ['000', p])`],
    ['chmod invoked by absolute path', `execFileSync('/bin/chmod', ['000', p])`],
    ['the promise API rather than the sync one', 'await fs.promises.chmod(p, 0o000)'],
    ['a renamed import', `import { chmodSync as lockDown } from 'node:fs';\nlockDown(p, 0o000);`],
    ['a literal mode bound to a constant', 'const mode = 0o000; chmodSync(p, mode);'],
  ])('flags %s', (_label, source) => {
    expect(permissionSimulations(source)).not.toEqual([]);
  });

  it('flags chmod in a shell template with substitutions', () => {
    const source = 'const script = String.raw`echo ${value}; chmod 000 file`;';
    expect(permissionSimulations(source)).toEqual(['chmod 000']);
  });

  // A regex literal after `return` or `=>` used to read as division, because
  // the character before the slash is `n` or `>`. The quote inside it then
  // opened a "string" that ran to the next quote anywhere later in the file —
  // and if that landed before a URL, the `//` in `https://` read as a comment
  // and took the rest of its line, call included. Two independent mistakes
  // compounding into a false clean, which is the one direction this must not
  // fail in.
  it.each([
    ['a return statement', 'function f() { return /(["\'])/u; }\nchmodSync(p, 0o000);'],
    ['an arrow body', 'const f = () => /(["\'])/u;\nchmodSync(p, 0o000);'],
    [
      'a return, with a comment after it',
      'function f() { return /(["\'])/u; }\n// note\nchmodSync(p, 0o000);',
    ],
    [
      'an arrow body, with the call sharing a line with a URL',
      'const f = () => /(["\'])/u;\nconst u = "https://x.com"; chmodSync(p, 0o000);',
    ],
    // `)` cannot join the list that `>` joined — `(a + b) / c` is division and
    // far more common than a regex here — so this one stays mis-read. It is
    // caught because a `//` directly after a colon is a URL scheme rather than
    // a comment, which holds however the scan arrived there.
    [
      'a condition, where the slash is genuinely ambiguous',
      'if (x) /(["\'])/u.test(s);\nconst u = "https://x.com"; chmodSync(p, 0o000);',
    ],
  ])('still sees a violation after a regex literal in %s', (_label, source) => {
    expect(permissionSimulations(source)).toEqual(['chmodSync(…, 0o000)']);
  });

  // The mode is the second argument of every fs chmod. Reading the last one
  // instead works until the async form puts a callback after it.
  it('reads the mode past a trailing callback', () => {
    expect(permissionSimulations('chmod(p, 0o000, done);')).toEqual(['chmod(…, 0o000)']);
  });

  // Widening the detector must not start flagging chmods that grant access —
  // an over-eager tripwire gets waived, and then it guards nothing.
  it.each([
    ['a recursive grant', 'const command = "chmod -R u+w dir";'],
    ['a symbolic mode that keeps read and write', 'const command = "chmod u=rw file";'],
    ['a compound symbolic mode that keeps owner access', 'const command = "chmod u=rw,go= file";'],
    ['a subprocess chmod granting access', `execFileSync('chmod', ['755', p])`],
    ['a promise-API grant', 'await fs.promises.chmod(p, 0o755)'],
  ])('allows %s', (_label, source) => {
    expect(permissionSimulations(source)).toEqual([]);
  });
});

describe('uid-dependent permission simulations', () => {
  it('no test removes owner read or write to simulate an I/O failure', () => {
    const offenders: string[] = [];

    for (const file of testFiles(REPOSITORY_ROOT)) {
      if (file.endsWith('uid-dependent-permission-tripwire.test.ts')) continue;
      const relative = nodePath.relative(REPOSITORY_ROOT, file);
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
