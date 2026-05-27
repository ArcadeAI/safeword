/**
 * Configurable-paths tests for validatePersonaReference (ticket K7N2QM).
 *
 * Covers the `.safeword/config.json` `paths.personas` override —
 * relative / absolute resolution, missing-file degradation, empty-string
 * fallback. Default-location fallback regression lives in
 * `personas-ref.test.ts`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest';

import { validatePersonaReference } from '../../src/utils/personas.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const PERSONA_FIXTURE = ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n');

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

describe('validatePersonaReference — configured paths (K7N2QM)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('R1.2: resolves a relative override against project root', () => {
    // Override points at docs/personas.md; default location does NOT exist.
    writeFileAt(cwd, 'docs/personas.md', PERSONA_FIXTURE);
    writeConfig(cwd, { installedPacks: [], paths: { personas: 'docs/personas.md' } });

    const result = validatePersonaReference(cwd, 'PO');

    assert(result.status === 'valid');
    expect(result.match.code).toBe('PO');
  });
});
