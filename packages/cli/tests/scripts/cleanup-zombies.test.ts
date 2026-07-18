/**
 * Integration tests for cleanup-zombies.sh script
 *
 * Tests the detection logic by running the script with --dry-run
 * in temp directories with mock config files.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = nodePath.join(__dirname, '../../templates/scripts/cleanup-zombies.sh');

describe('cleanup-zombies.sh', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'cleanup-zombies-test-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  /** Run the real script with the args exactly as given. */
  function runScriptRaw(args: string[] = []): string {
    const command = `bash "${SCRIPT_PATH}" ${args.join(' ')}`;
    return execSync(command, { cwd: temporaryDirectory, encoding: 'utf8' });
  }

  /** Detection-suite default: always preview explicitly. */
  function runScript(args: string[] = []): string {
    return runScriptRaw(['--dry-run', ...args]);
  }

  function createFile(relativePath: string, content = ''): void {
    const fullPath = nodePath.join(temporaryDirectory, relativePath);
    const dir = fullPath.slice(0, Math.max(0, fullPath.lastIndexOf('/')));
    if (dir && dir !== temporaryDirectory) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  describe('framework detection (root)', () => {
    it('detects Vite project → port 5173, pattern vite', () => {
      createFile('vite.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 5173');
      expect(output).toContain('Pattern: vite');
    });

    it('detects Next.js project → port 3000, pattern next', () => {
      createFile('next.config.js');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: next');
    });

    it('detects Nuxt project → port 3000, pattern nuxt', () => {
      createFile('nuxt.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: nuxt');
    });

    it('detects Astro project → port 4321', () => {
      createFile('astro.config.mjs');

      const output = runScript();

      expect(output).toContain('Port: 4321');
    });

    it('detects Angular project → port 4200', () => {
      createFile('angular.json');

      const output = runScript();

      expect(output).toContain('Port: 4200');
    });

    it('detects SvelteKit project → port 5173', () => {
      createFile('svelte.config.js');

      const output = runScript();

      expect(output).toContain('Port: 5173');
    });
  });

  describe('monorepo detection (packages/*/, apps/*/)', () => {
    it('detects Vite in packages/app/', () => {
      createFile('packages/app/vite.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 5173');
      expect(output).toContain('Pattern: vite');
    });

    it('detects Next.js in apps/web/', () => {
      createFile('apps/web/next.config.mjs');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: next');
    });

    it('detects Nuxt in packages/frontend/', () => {
      createFile('packages/frontend/nuxt.config.ts');

      const output = runScript();

      expect(output).toContain('Port: 3000');
      expect(output).toContain('Pattern: nuxt');
    });
  });

  describe('no framework detected', () => {
    it('shows no port/pattern when no config files exist', () => {
      // Empty directory
      const output = runScript();

      expect(output).not.toContain('Port:');
      expect(output).not.toContain('Pattern:');
    });
  });

  describe('explicit port override', () => {
    it('uses provided port instead of auto-detection', () => {
      createFile('vite.config.ts'); // Would normally detect 5173

      const output = runScript(['8080']);

      expect(output).toContain('Port: 8080');
      // Pattern still auto-detected
      expect(output).toContain('Pattern: vite');
    });

    it('uses provided port and pattern', () => {
      const output = runScript(['9000', 'custom']);

      expect(output).toContain('Port: 9000');
      expect(output).toContain('Pattern: custom');
    });
  });

  describe('--dry-run behavior', () => {
    it('shows DRY RUN message', () => {
      const output = runScript();

      expect(output).toContain('DRY RUN');
    });

    it('does not actually kill processes', () => {
      // This test verifies --dry-run is safe by checking output message
      const output = runScript();

      expect(output).toContain('no processes will be killed');
    });
  });

  // 2KG1JW (#773 rung 4): the skill's "run --dry-run first, then re-run" ritual
  // is script-enforced — bare invocation previews, killing needs explicit consent.
  describe('Rule: killing requires an explicit --yes (deny-by-default)', () => {
    it('Scenario: a bare invocation is a preview that names the consent flag', () => {
      const output = runScriptRaw();

      expect(output).toContain('no processes will be killed');
      expect(output).toContain('--yes');
    });

    it('Scenario: --yes enters kill mode (no preview banner)', () => {
      // Empty temp dir: no detected port, no project-scoped matches — kill mode
      // runs safely and reports clean. The mode flip is what's under test.
      const output = runScriptRaw(['--yes']);

      expect(output).not.toContain('no processes will be killed');
      expect(output).toContain('already clean');
    });

    it('Scenario: -y is the short form of consent', () => {
      const output = runScriptRaw(['-y']);

      expect(output).not.toContain('no processes will be killed');
    });

    it('Scenario: --dry-run stays an explicit preview (back-compat)', () => {
      const output = runScriptRaw(['--dry-run']);

      expect(output).toContain('no processes will be killed');
    });

    it('Scenario: a preview with findings tells the reader how to proceed', () => {
      createFile('vite.config.ts');

      const output = runScriptRaw();

      // Bare preview still runs the full detection pass (port + pattern shown).
      expect(output).toContain('Port: 5173');
      expect(output).toContain('--yes');
    });

    it('Scenario: preview wins a contradictory flag mix, regardless of order', () => {
      for (const args of [
        ['--yes', '--dry-run'],
        ['--dry-run', '--yes'],
      ]) {
        expect(runScriptRaw(args)).toContain('no processes will be killed');
      }
    });
  });

  // The behavioral pin for kill mode: a real project-scoped process survives the
  // bare preview and dies under --yes. Everything above proves messaging; this
  // proves the mode flip reaches kill(1).
  describe('Rule: --yes kills what the preview showed (behavioral pin)', () => {
    let victim: ChildProcess | undefined;

    afterEach(() => {
      if (victim?.pid && victim.exitCode === null) {
        try {
          process.kill(victim.pid, 'SIGKILL');
        } catch {
          // already dead — the desired end state
        }
      }
      victim = undefined;
    });

    function spawnVictim(): number {
      // The script path gives pgrep a stable argv containing both the marker
      // ("swzombie") and temp project path. A shell comment is not stable across
      // process-list implementations.
      const victimScript = nodePath.join(realpathSync(temporaryDirectory), 'swzombie-victim.sh');
      writeFileSync(victimScript, '#!/usr/bin/env bash\nsleep 60\n');
      victim = spawn('bash', [victimScript], {
        detached: true,
        stdio: 'ignore',
      });
      if (victim.pid === undefined) throw new Error('failed to spawn victim');
      return victim.pid;
    }

    function isAlive(pid: number): boolean {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    }

    it('Scenario: the victim survives a bare preview and dies under --yes', async () => {
      const pid = spawnVictim();
      await expect.poll(() => isAlive(pid)).toBe(true);

      const preview = runScriptRaw(['swzombie']);
      expect(preview).toContain('swzombie');
      expect(preview).toContain('Re-run with --yes to kill them');
      expect(isAlive(pid)).toBe(true); // preview never kills

      runScriptRaw(['--yes', 'swzombie']);
      await expect.poll(() => isAlive(pid)).toBe(false); // consent kills
    });
  });

  describe('test port convention', () => {
    it('shows test port = dev port + 1000', () => {
      createFile('vite.config.ts');

      const output = runScript();

      // Output format: "Port: 5173 (+ test port 6173)"
      expect(output).toContain('Port: 5173');
      expect(output).toContain('test port 6173');
    });
  });
});
