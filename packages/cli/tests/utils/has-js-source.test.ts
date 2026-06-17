import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hasJsSource } from '../../src/utils/project-detector';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-jssrc-'));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const abs = nodePath.join(root, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

describe('hasJsSource', () => {
  it('is true for a repo with JS/TS application source', () => {
    expect(hasJsSource(makeRepo({ 'src/index.ts': 'export const x = 1;\n' }))).toBe(true);
  });

  it('is true when source lives in a nested workspace package', () => {
    expect(hasJsSource(makeRepo({ 'apps/web/src/app.tsx': 'export default 1;\n' }))).toBe(true);
  });

  it('is false for a pure Python repo', () => {
    expect(hasJsSource(makeRepo({ 'pyproject.toml': '[project]\nname="x"\n' }))).toBe(false);
  });

  it('is false for a non-JS repo carrying only the safeword BDD lane scaffolding', () => {
    const root = makeRepo({
      'go.mod': 'module x\n',
      'package.json': JSON.stringify({ private: true, scripts: {} }),
      'cucumber.mjs': 'export default {};\n',
      'eslint.config.mjs': 'export default [];\n',
      'steps/world.ts': 'export {};\n',
      'steps/shared.steps.ts': 'export {};\n',
      'features/safeword-lane.feature': 'Feature: x\n',
    });
    expect(hasJsSource(root)).toBe(false);
  });

  it('ignores JS inside excluded directories like node_modules', () => {
    expect(hasJsSource(makeRepo({ 'node_modules/dep/index.js': 'module.exports = 1;\n' }))).toBe(
      false,
    );
  });

  it('is true for a real JS project that also has the lane (lane does not mask app source)', () => {
    const root = makeRepo({
      'package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
      'src/main.ts': 'export const y = 2;\n',
      'steps/world.ts': 'export {};\n',
    });
    expect(hasJsSource(root)).toBe(true);
  });
});
