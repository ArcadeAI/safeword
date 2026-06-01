/**
 * Configurable-paths + file-IO tests for validateGlossaryReference
 * (ticket YR6C49, Task 3). Mirrors personas-ref-configured-paths.test.ts.
 *
 * Covers the `.safeword/config.json` `paths.glossary` override —
 * default fallback, relative / absolute resolution, empty-string
 * fallback, and missing-file degradation (returns unknown, never throws).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest';

import { validateGlossaryReference } from '../../src/utils/glossary.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const GLOSSARY_FIXTURE = ['## Tool', '**Definition:** A single callable capability.', ''].join(
  '\n',
);

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  const dir = nodePath.join(cwd, '.safeword');
  mkdirSync(dir, { recursive: true });
  writeFileSync(nodePath.join(dir, 'config.json'), JSON.stringify(config, undefined, 2));
}

function writeFileAt(cwd: string, relativePath: string, content: string): void {
  const fullPath = nodePath.join(cwd, relativePath);
  mkdirSync(nodePath.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

describe('validateGlossaryReference — configured paths (YR6C49)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('R4.1: override unset reads the default location', () => {
    writeFileAt(cwd, '.safeword-project/glossary.md', GLOSSARY_FIXTURE);

    const result = validateGlossaryReference(cwd, 'Tool');

    assert(result.status === 'valid');
    expect(result.match.name).toBe('Tool');
  });

  it('R4.2: resolves a relative override against project root', () => {
    writeFileAt(cwd, 'docs/glossary.md', GLOSSARY_FIXTURE);
    writeConfig(cwd, { installedPacks: [], paths: { glossary: 'docs/glossary.md' } });

    const result = validateGlossaryReference(cwd, 'Tool');

    assert(result.status === 'valid');
    expect(result.match.name).toBe('Tool');
  });

  it('R4.3: uses an absolute override path verbatim', () => {
    const externalDirectory = createTemporaryDirectory();
    try {
      const externalPath = nodePath.join(externalDirectory, 'team-glossary.md');
      writeFileSync(externalPath, GLOSSARY_FIXTURE);
      writeConfig(cwd, { installedPacks: [], paths: { glossary: externalPath } });

      const result = validateGlossaryReference(cwd, 'Tool');

      assert(result.status === 'valid');
      expect(result.match.name).toBe('Tool');
    } finally {
      removeTemporaryDirectory(externalDirectory);
    }
  });

  it('R4.4: empty-string override falls back to default', () => {
    writeFileAt(cwd, '.safeword-project/glossary.md', GLOSSARY_FIXTURE);
    writeConfig(cwd, { installedPacks: [], paths: { glossary: '' } });

    const result = validateGlossaryReference(cwd, 'Tool');

    assert(result.status === 'valid');
    expect(result.match.name).toBe('Tool');
  });

  it('R4.5: configured-but-missing returns unknown without throwing', () => {
    writeConfig(cwd, { installedPacks: [], paths: { glossary: 'docs/glossary.md' } });

    const result = validateGlossaryReference(cwd, 'Tool');

    expect(result.status).toBe('unknown');
  });
});
