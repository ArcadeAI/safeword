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
