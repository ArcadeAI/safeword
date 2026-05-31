/**
 * Tests for framework detection utilities
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detect } from './detect.js';

describe('findNextConfigPaths', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'detect-test-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('returns empty array when no next.config exists', () => {
    // Create a non-Next project
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    expect(paths).toEqual([]);
  });

  it('returns undefined for single-app Next.js project (no scoping needed)', () => {
    // Create a single Next.js app at root
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');
    writeFileSync(path.join(temporaryDirectory, 'next.config.js'), 'module.exports = {}');

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    // undefined means "don't scope, use full Next config"
    expect(paths).toBeUndefined();
  });

  it('returns scoped paths for monorepo with Next.js in apps/', () => {
    // Create monorepo structure
    mkdirSync(path.join(temporaryDirectory, 'apps', 'web'), { recursive: true });
    mkdirSync(path.join(temporaryDirectory, 'apps', 'admin'), { recursive: true });
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');
    writeFileSync(path.join(temporaryDirectory, 'apps', 'web', 'next.config.js'), '');
    writeFileSync(path.join(temporaryDirectory, 'apps', 'admin', 'package.json'), '{}'); // React app, no Next

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    expect(paths).toEqual(['apps/web/**/*.{ts,tsx}']);
  });

  it('returns scoped paths for monorepo with Next.js in packages/', () => {
    mkdirSync(path.join(temporaryDirectory, 'packages', 'website'), { recursive: true });
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');
    writeFileSync(path.join(temporaryDirectory, 'packages', 'website', 'next.config.mjs'), '');

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    expect(paths).toEqual(['packages/website/**/*.{ts,tsx}']);
  });

  it('returns multiple paths for monorepo with multiple Next.js apps', () => {
    mkdirSync(path.join(temporaryDirectory, 'apps', 'web'), { recursive: true });
    mkdirSync(path.join(temporaryDirectory, 'apps', 'docs'), { recursive: true });
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');
    writeFileSync(path.join(temporaryDirectory, 'apps', 'web', 'next.config.js'), '');
    writeFileSync(path.join(temporaryDirectory, 'apps', 'docs', 'next.config.ts'), '');

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    expect(paths).toContain('apps/web/**/*.{ts,tsx}');
    expect(paths).toContain('apps/docs/**/*.{ts,tsx}');
    expect(paths).toHaveLength(2);
  });

  it('handles custom workspace patterns from package.json', () => {
    mkdirSync(path.join(temporaryDirectory, 'services', 'frontend'), { recursive: true });
    writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ workspaces: ['services/*'] }),
    );
    writeFileSync(path.join(temporaryDirectory, 'services', 'frontend', 'next.config.js'), '');

    const paths = detect.findNextConfigPaths(temporaryDirectory);

    expect(paths).toEqual(['services/frontend/**/*.{ts,tsx}']);
  });
});

describe('hasExistingPrettierConfig', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'detect-prettier-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('returns false when no prettier config is present', () => {
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(false);
  });

  it('detects a bare .prettierrc', () => {
    writeFileSync(path.join(temporaryDirectory, '.prettierrc'), '{}');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(true);
  });

  it('detects an extensioned .prettierrc.yaml', () => {
    writeFileSync(path.join(temporaryDirectory, '.prettierrc.yaml'), 'singleQuote: false\n');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(true);
  });

  it('detects a prettier.config.mjs module (the form .prettierrc would shadow)', () => {
    writeFileSync(path.join(temporaryDirectory, 'prettier.config.mjs'), 'export default {};\n');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(true);
  });

  it('detects a "prettier" key in package.json', () => {
    writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ prettier: { singleQuote: false } }),
    );

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(true);
  });

  it('ignores an alternative-formatter-only project (biome)', () => {
    writeFileSync(path.join(temporaryDirectory, 'biome.json'), '{}');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(false);
  });

  it('ignores a disabled/backup config prettier will not load (.prettierrc.bak)', () => {
    // Prettier resolves an exact set of filenames; `.prettierrc.bak` is not one,
    // so it must read as "no config" — not suppress safeword's install. Mirrors
    // the exact-match fix in hooks/lib/lint-config.ts (ticket 1J6JKP).
    writeFileSync(path.join(temporaryDirectory, '.prettierrc.bak'), '{}');
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(false);
  });

  it('ignores a disabled prettier.config module (prettier.config.js.disabled)', () => {
    writeFileSync(
      path.join(temporaryDirectory, 'prettier.config.js.disabled'),
      'module.exports={}',
    );
    writeFileSync(path.join(temporaryDirectory, 'package.json'), '{}');

    expect(detect.hasExistingPrettierConfig(temporaryDirectory)).toBe(false);
  });
});
