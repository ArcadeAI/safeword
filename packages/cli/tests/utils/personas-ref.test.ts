/**
 * Filesystem-backed tests for validatePersonaReference (ticket 7YN5QB).
 *
 * Pure-function lookup tests live in src/utils/personas.test.ts; this
 * file covers the disk I/O wrapper — happy path, missing-file graceful
 * return, empty-file behavior.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PersonaReferenceResult } from '../../src/utils/personas.js';
import { validatePersonaReference } from '../../src/utils/personas.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

/**
 * Type-narrowing helper for the discriminated PersonaReferenceResult union.
 * After this call, TypeScript narrows `result` to the requested variant —
 * subsequent `result.match` or `result.suggestion` accesses are type-safe
 * without optional chaining.
 */
function assertStatus<S extends PersonaReferenceResult['status']>(
  result: PersonaReferenceResult,
  status: S,
): asserts result is Extract<PersonaReferenceResult, { status: S }> {
  expect(result.status).toBe(status);
}

function writePersonasFile(cwd: string, content: string): void {
  const dir = nodePath.join(cwd, '.safeword-project');
  mkdirSync(dir, { recursive: true });
  writeFileSync(nodePath.join(dir, 'personas.md'), content);
}

describe('validatePersonaReference — filesystem I/O', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('returns valid match when personas.md has the code', () => {
    writePersonasFile(cwd, ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'));
    const result = validatePersonaReference(cwd, 'PO');
    assertStatus(result, 'valid');
    expect(result.match.code).toBe('PO');
    expect(result.match.name).toBe('Platform Operator');
  });

  it('returns valid match for exact name lookup', () => {
    writePersonasFile(cwd, ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'));
    const result = validatePersonaReference(cwd, 'Platform Operator');
    assertStatus(result, 'valid');
    expect(result.match.code).toBe('PO');
  });

  it('returns unknown with suggestion on casing mismatch', () => {
    writePersonasFile(cwd, ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'));
    const result = validatePersonaReference(cwd, 'po');
    assertStatus(result, 'unknown');
    expect(result.suggestion).toBe('PO');
  });

  it('returns unknown without suggestion when ref is truly unknown', () => {
    writePersonasFile(cwd, ['## Platform Operator (PO)', '**Role:** Owns infra.', ''].join('\n'));
    const result = validatePersonaReference(cwd, 'AdminUser');
    assertStatus(result, 'unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('returns unknown when .safeword-project/personas.md is missing', () => {
    // No personas.md written — file does not exist.
    const result = validatePersonaReference(cwd, 'PO');
    assertStatus(result, 'unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('returns unknown when personas.md is empty (no real blocks)', () => {
    writePersonasFile(cwd, '# Personas\n\n<!-- ## Example (EX) -->\n');
    const result = validatePersonaReference(cwd, 'PO');
    expect(result.status).toBe('unknown');
  });

  it('resolves auto-derived codes during lookup', () => {
    // User authored only `## Platform Operator` (no explicit code);
    // lookup by derived code "PO" should still match.
    writePersonasFile(cwd, ['## Platform Operator', '**Role:** A', ''].join('\n'));
    const result = validatePersonaReference(cwd, 'PO');
    assertStatus(result, 'valid');
    expect(result.match.code).toBe('PO');
  });

  it('empty string input returns unknown without reading file twice', () => {
    writePersonasFile(cwd, ['## Platform Operator (PO)', '**Role:** A', ''].join('\n'));
    const result = validatePersonaReference(cwd, '');
    expect(result.status).toBe('unknown');
  });
});
