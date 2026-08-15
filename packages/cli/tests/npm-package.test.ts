/**
 * Test Suite: NPM Package Distribution
 *
 * Tests that the npm package is correctly structured and would work
 * when installed via `npm install` or `npx`.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { testCliRoot } from './helpers.js';

const require = createRequire(import.meta.url);

function installedDependencyRoot(dependency: string): string {
  const searchPaths = require.resolve.paths(dependency) ?? [];
  for (const searchPath of searchPaths) {
    const candidate = nodePath.join(searchPath, dependency);
    const manifestPath = nodePath.join(candidate, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: unknown };
      if (manifest.name === dependency) return candidate;
    }
  }
  throw new Error(`could not locate installed package root for runtime dependency: ${dependency}`);
}

function packageJson(): {
  dependencies?: Record<string, string>;
  exports?: unknown;
  files?: string[];
} {
  return JSON.parse(readFileSync(nodePath.join(testCliRoot, 'package.json'), 'utf8'));
}

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  return Object.values(value).flatMap(exportTargets);
}

function copyPublishedPackage(destination: string): void {
  const manifest = packageJson();
  mkdirSync(destination, { recursive: true });
  cpSync(nodePath.join(testCliRoot, 'package.json'), nodePath.join(destination, 'package.json'));
  const publishedFiles = manifest.files ?? [];
  for (const entry of publishedFiles) {
    const matches = globSync(entry, { cwd: testCliRoot });
    if (matches.length === 0) throw new Error(`published files entry matched nothing: ${entry}`);
    for (const match of matches) {
      const target = nodePath.join(destination, match);
      mkdirSync(nodePath.dirname(target), { recursive: true });
      cpSync(nodePath.join(testCliRoot, match), target, {
        recursive: true,
      });
    }
  }
}

function installOlderDependencyBase(fixture: string): {
  binaryDirectory: string;
  codexHome: string;
  homeDirectory: string;
  installedPackage: string;
  projectDirectory: string;
} {
  const installedModules = nodePath.join(fixture, 'node_modules');
  const installedPackage = nodePath.join(installedModules, 'safeword');
  const binaryDirectory = nodePath.join(fixture, 'bin');
  const projectDirectory = nodePath.join(fixture, 'project');
  const codexHome = nodePath.join(fixture, 'codex-home');
  const homeDirectory = nodePath.join(fixture, 'home');
  mkdirSync(installedModules);
  mkdirSync(binaryDirectory);
  mkdirSync(projectDirectory);
  mkdirSync(codexHome);
  mkdirSync(homeDirectory);
  copyPublishedPackage(installedPackage);

  const runtimeDependencies = Object.keys(packageJson().dependencies ?? {});
  for (const dependency of runtimeDependencies) {
    if (dependency === 'smol-toml') continue;
    const destination = nodePath.join(installedModules, dependency);
    mkdirSync(nodePath.dirname(destination), { recursive: true });
    symlinkSync(installedDependencyRoot(dependency), destination, 'dir');
  }

  const codex = nodePath.join(binaryDirectory, 'codex');
  writeFileSync(codex, '#!/bin/sh\nprintf \'{"installed":[]}\\n\'\n');
  chmodSync(codex, 0o755);
  return { binaryDirectory, codexHome, homeDirectory, installedPackage, projectDirectory };
}

function runIsolatedDoctor(
  fixture: string,
  installation: ReturnType<typeof installOlderDependencyBase>,
) {
  const { binaryDirectory, codexHome, homeDirectory, installedPackage, projectDirectory } =
    installation;
  return spawnSync(
    process.execPath,
    [nodePath.join(installedPackage, 'dist/cli.js'), 'doctor', '--json', '--no-input'],
    {
      cwd: projectDirectory,
      encoding: 'utf8',
      env: {
        CODEX_HOME: codexHome,
        HOME: homeDirectory,
        NO_COLOR: '1',
        PATH: `${binaryDirectory}${nodePath.delimiter}/usr/bin${nodePath.delimiter}/bin`,
        XDG_CACHE_HOME: nodePath.join(fixture, 'xdg-cache'),
        XDG_CONFIG_HOME: nodePath.join(fixture, 'xdg-config'),
        XDG_DATA_HOME: nodePath.join(fixture, 'xdg-data'),
      },
    },
  );
}

describe('NPM Package Structure', () => {
  it('should have package.json with correct files array', () => {
    const manifest = packageJson();

    expect(manifest.files).toBeDefined();
    expect(manifest.files).toContain('dist');
    expect(manifest.files).toContain('templates');
    const publishedFiles = manifest.files ?? [];
    for (const entry of publishedFiles) {
      expect(existsSync(nodePath.join(testCliRoot, entry)), entry).toBe(true);
    }
    for (const target of exportTargets(manifest.exports)) {
      expect(existsSync(nodePath.resolve(testCliRoot, target)), target).toBe(true);
    }
  });

  it('should have dist directory with CLI entry point', () => {
    const distributionPath = nodePath.join(testCliRoot, 'dist');
    expect(existsSync(distributionPath)).toBe(true);
    expect(existsSync(nodePath.join(distributionPath, 'cli.js'))).toBe(true);
  });

  it('publishes only the documented runtime API and package subpaths', async () => {
    const manifest = packageJson();
    expect(Object.keys(manifest.exports ?? {})).toEqual([
      '.',
      './schemas/cli-result-v1.json',
      './eslint',
    ]);
    const publicApi = await import(
      `${pathToFileURL(nodePath.join(testCliRoot, 'dist', 'index.js')).href}?api-surface-test`
    );
    const documentedRuntimeExports = ['VERSION', 'detect', 'eslint'];
    expect(Object.keys(publicApi).toSorted((left, right) => left.localeCompare(right))).toEqual(
      documentedRuntimeExports.toSorted((left, right) => left.localeCompare(right)),
    );
  });

  it('should have templates directory with all required subdirectories', () => {
    const templatesPath = nodePath.join(testCliRoot, 'templates');
    expect(existsSync(templatesPath)).toBe(true);

    const required = [
      'SAFEWORD.md',
      'guides',
      'doc-templates',
      'hooks',
      'prompts',
      'skills',
      'commands',
    ];
    for (const item of required) {
      expect(existsSync(nodePath.join(templatesPath, item))).toBe(true);
    }
  });

  it('should have templates/hooks with all hook scripts', () => {
    const hooksPath = nodePath.join(testCliRoot, 'templates', 'hooks');
    const files = readdirSync(hooksPath);

    // Session hooks
    expect(files).toContain('session-safeword-context.ts');
    expect(files).toContain('session-codex-start.ts');
    expect(files).toContain('session-cursor-auto-upgrade.ts');
    expect(files).toContain('session-version.ts');
    expect(files).toContain('session-lint-check.ts');

    // Prompt hooks
    expect(files).toContain('prompt-timestamp.ts');
    expect(files).toContain('prompt-questions.ts');

    // Stop hook
    expect(files).toContain('stop-quality.ts');

    // Post-tool hooks
    expect(files).toContain('post-tool-lint.ts');
    expect(files).toContain('post-tool-quality.ts');
    expect(files).toContain('post-tool-bypass-warn.ts');

    // Pre-tool hooks
    expect(files).toContain('pre-tool-quality.ts');
    expect(files).toContain('pre-tool-config-guard.ts');

    // Shared lib
    expect(files).toContain('lib');
    expect(readdirSync(nodePath.join(hooksPath, 'lib'))).toContain('auto-upgrade-lock.ts');
  });

  it('should have templates/guides with methodology files', () => {
    const guidesPath = nodePath.join(testCliRoot, 'templates', 'guides');
    const files = readdirSync(guidesPath);

    // Should have multiple guide files
    const mdFiles = files.filter(f => f.endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThan(5);
  });

  it('should have templates/skills with quality review', () => {
    const skillPath = nodePath.join(testCliRoot, 'templates', 'skills', 'quality-review');
    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(nodePath.join(skillPath, 'SKILL.md'))).toBe(true);
  });

  it('should have templates/commands with slash commands', () => {
    const commandsPath = nodePath.join(testCliRoot, 'templates', 'commands');
    const files = readdirSync(commandsPath);

    expect(files).toContain('quality-review.md');
    expect(files).toContain('audit.md');
    expect(files).toContain('lint.md');
  });

  it('should resolve templates from dist context', () => {
    // Simulate the path resolution that getTemplatesDirectory() does
    const distributionDirectory = nodePath.join(testCliRoot, 'dist');
    const templatesFromDistribution = nodePath.join(distributionDirectory, '..', 'templates');

    expect(existsSync(templatesFromDistribution)).toBe(true);
    expect(existsSync(nodePath.join(templatesFromDistribution, 'SAFEWORD.md'))).toBe(true);
  });

  it('runs default doctor when an older dependency base lacks smol-toml', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-older-base-'));
    try {
      const result = runIsolatedDoctor(fixture, installOlderDependencyBase(fixture));

      expect(result.status).toBe(2);
      expect(result.error).toBeUndefined();
      expect(`${result.stderr}\n${result.stdout}`).not.toMatch(/ERR_MODULE_NOT_FOUND|smol-toml/u);
      const output = JSON.parse(result.stdout);
      expect(output.state).toBe('action_required');
      expect(output.errors).toEqual([]);
      expect(output.data.command).toBe('doctor');
    } finally {
      rmSync(fixture, { force: true, recursive: true });
    }
  });
});
