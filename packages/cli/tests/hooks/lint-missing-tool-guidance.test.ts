/**
 * The lint hook resolves non-JavaScript tools off PATH, and hooks run
 * non-interactively — so a host whose shell rc runs `mise activate` reaches the
 * hook with no shims on PATH even though the tool works in their terminal. The
 * remedy handed to the agent must not tell that host to install a second copy:
 * two versions of a formatter disagree, and the churn lands in their diffs.
 *
 * lint.ts imports Bun's `$`, so it runs in a `bun` subprocess (as in
 * lint-sql-branch.test.ts). The subprocess keeps its inherited environment —
 * `bun` on a mise-managed host is itself a shim and needs a real PATH to start —
 * and narrows HOME and PATH in-process before importing the hook, which is when
 * the hook reads them.
 */

import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const LINT_MODULE = path.resolve(__dirname, '../../templates/hooks/lib/lint.ts');

describe('lint hook guidance for a tool it cannot reach', () => {
  let projectDirectory: string;
  let home: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(path.join(tmpdir(), 'lint-guidance-project-'));
    home = mkdtempSync(path.join(tmpdir(), 'lint-guidance-home-'));
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  /** Lint a Python file with `ruff` unreachable, and return the warnings. */
  const lintPythonWithoutRuff = async (extraPath = ''): Promise<string> => {
    const pythonFile = path.join(projectDirectory, 'main.py');
    writeFileSync(pythonFile, 'x = 1\n');
    const script = `
      process.env.HOME = ${JSON.stringify(home)};
      process.env.CLAUDE_PROJECT_DIR = ${JSON.stringify(projectDirectory)};
      // Enough to resolve \`which\`, not enough to resolve ruff.
      process.env.PATH = ${JSON.stringify(`${extraPath}${extraPath ? ':' : ''}/usr/bin:/bin`)};
      const { lintFile } = await import(${JSON.stringify(LINT_MODULE)});
      const result = await lintFile(${JSON.stringify(pythonFile)}, ${JSON.stringify(projectDirectory)});
      console.log(JSON.stringify(result.warnings));
    `;
    const { stdout } = await execFileAsync('bun', ['-e', script], { cwd: projectDirectory });
    return stdout;
  };

  it('points at the unreachable mise shim rather than a second install', async () => {
    const shims = path.join(home, '.local/share/mise/shims');
    mkdirSync(shims, { recursive: true });
    writeFileSync(path.join(shims, 'ruff'), '#!/bin/sh\nexit 0\n');
    chmodSync(path.join(shims, 'ruff'), 0o755);

    const warnings = await lintPythonWithoutRuff();

    expect(warnings).toContain(shims);
    expect(warnings).not.toContain('pip install');
  });

  it('installs through mise when mise governs the project', async () => {
    writeFileSync(path.join(projectDirectory, 'mise.toml'), '[tools]\npython = "3.13"\n');

    const warnings = await lintPythonWithoutRuff();

    expect(warnings).toContain('mise use ruff');
    expect(warnings).not.toContain('pip install');
  });

  // Installing through mise drops the tool into the shims directory, so install
  // guidance alone leaves the hook exactly as blind as it was.
  it('also repairs PATH when the shims directory is unreachable', async () => {
    writeFileSync(path.join(projectDirectory, 'mise.toml'), '[tools]\npython = "3.13"\n');

    const warnings = await lintPythonWithoutRuff();

    expect(warnings).toContain(path.join(home, '.local/share/mise/shims'));
  });

  it('omits the PATH step when the shims directory is already reachable', async () => {
    writeFileSync(path.join(projectDirectory, 'mise.toml'), '[tools]\npython = "3.13"\n');
    const shims = path.join(home, '.local/share/mise/shims');
    mkdirSync(shims, { recursive: true });

    const warnings = await lintPythonWithoutRuff(shims);

    expect(warnings).toContain('mise use ruff');
    expect(warnings).not.toContain('login PATH');
  });

  it('keeps the package-manager hint when nothing indicates mise', async () => {
    writeFileSync(path.join(projectDirectory, 'uv.lock'), '');

    const warnings = await lintPythonWithoutRuff();

    expect(warnings).toContain('uv add --dev ruff');
    expect(warnings).not.toContain('mise');
  });
});
