/**
 * Integration tests for cleanup-zombies.sh script
 *
 * Tests the detection logic by running the script with --dry-run
 * in temp directories with mock config files.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

  function runScript(args: string[] = []): string {
    const command = `bash "${SCRIPT_PATH}" --dry-run ${args.join(' ')}`;
    return execSync(command, { cwd: temporaryDirectory, encoding: 'utf8' });
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
