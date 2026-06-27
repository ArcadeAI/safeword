/**
 * Unit tests for the `safeword architecture` command (ticket QD5DTT, Slice 1).
 * Proves the CLI entry actually invokes selfHeal at the configured location —
 * the wiring the SessionStart hook depends on.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { architecture } from '../../src/commands/architecture.js';
import { selfHeal } from '../../src/utils/architecture-document.js';
import { resolveGeneratedArchitecturePath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory, runCli } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function writeEnforcementConfig(directory: string, enabled: boolean): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    JSON.stringify({ architectureDocEnforcement: enabled }),
  );
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('architecture command', () => {
  it('refreshes the architecture document at the configured location', async () => {
    await architecture(context.directory);

    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(true);
  });
});

describe('architecture --check — CI staleness backstop (FPV0E4 Slice 2)', () => {
  it('exits non-zero when modules exist but no doc was committed (uncreated)', async () => {
    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).not.toBe(0);
  });

  it('exits non-zero when the committed doc is behind the current shape (stale)', async () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).not.toBe(0);
  });

  it('exits non-zero when the owned doc is missing its fingerprint (corrupt)', async () => {
    selfHeal(context.directory);
    writeFileSync(
      resolveGeneratedArchitecturePath(context.directory),
      '---\ngenerator: safeword-architecture\n---\n\n# fingerprint gone\n',
    );

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).not.toBe(0);
  });

  it('defaults to on when no config file is present (stale doc still fails)', async () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    // No .safeword/config.json written: default-on must still apply.

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).not.toBe(0);
  });

  it('exits zero when the committed doc matches the current shape (fresh)', async () => {
    selfHeal(context.directory);

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
  });

  it('exits zero for a project with no modules and no doc (noop)', async () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
  });

  it('exits zero for a foreign hand-written doc (not ours to enforce)', async () => {
    mkdirSync(nodePath.dirname(resolveGeneratedArchitecturePath(context.directory)), {
      recursive: true,
    });
    writeFileSync(
      resolveGeneratedArchitecturePath(context.directory),
      '# Our Architecture\n\nHand-written, no marker.\n',
    );

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
  });

  it('exits zero on a stale doc when enforcement is opted out', async () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    writeEnforcementConfig(context.directory, false);

    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).toBe(0);
  });

  it('does not write the doc in check mode (dry-run)', async () => {
    const result = await runCli(['architecture', '--check'], { cwd: context.directory });

    expect(result.exitCode).not.toBe(0);
    expect(existsSync(resolveGeneratedArchitecturePath(context.directory))).toBe(false);
  });
});
