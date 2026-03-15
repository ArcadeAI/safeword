/**
 * Test Suite: NPM Package Distribution
 *
 * Tests that the npm package is correctly structured and would work
 * when installed via `npm install` or `npx`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;
const cliRoot = nodePath.join(__dirname, '..');

describe('NPM Package Structure', () => {
  it('should have package.json with correct files array', () => {
    const packageJson = JSON.parse(readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8'));

    expect(packageJson.files).toBeDefined();
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('templates');
  });

  it('should have dist directory with CLI entry point', () => {
    const distributionPath = nodePath.join(cliRoot, 'dist');
    expect(existsSync(distributionPath)).toBe(true);
    expect(existsSync(nodePath.join(distributionPath, 'cli.js'))).toBe(true);
  });

  it('should have templates directory with all required subdirectories', () => {
    const templatesPath = nodePath.join(cliRoot, 'templates');
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
    const hooksPath = nodePath.join(cliRoot, 'templates', 'hooks');
    const files = readdirSync(hooksPath);

    // Session hooks
    expect(files).toContain('session-verify-agents.ts');
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
  });

  it('should have templates/guides with methodology files', () => {
    const guidesPath = nodePath.join(cliRoot, 'templates', 'guides');
    const files = readdirSync(guidesPath);

    // Should have multiple guide files
    const mdFiles = files.filter(f => f.endsWith('.md'));
    expect(mdFiles.length).toBeGreaterThan(5);
  });

  it('should have templates/skills with quality review', () => {
    const skillPath = nodePath.join(cliRoot, 'templates', 'skills', 'quality-review');
    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(nodePath.join(skillPath, 'SKILL.md'))).toBe(true);
  });

  it('should have templates/commands with slash commands', () => {
    const commandsPath = nodePath.join(cliRoot, 'templates', 'commands');
    const files = readdirSync(commandsPath);

    expect(files).toContain('quality-review.md');
    expect(files).toContain('audit.md');
    expect(files).toContain('lint.md');
  });

  it('should resolve templates from dist context', () => {
    // Simulate the path resolution that getTemplatesDirectory() does
    const distributionDirectory = nodePath.join(cliRoot, 'dist');
    const templatesFromDistribution = nodePath.join(distributionDirectory, '..', 'templates');

    expect(existsSync(templatesFromDistribution)).toBe(true);
    expect(existsSync(nodePath.join(templatesFromDistribution, 'SAFEWORD.md'))).toBe(true);
  });
});
