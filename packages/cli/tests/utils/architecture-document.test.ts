/**
 * Integration tests for the architecture state-document self-heal (ticket
 * QD5DTT, Slice 1). Covers the "structural facts self-heal at session start"
 * rule from features/architecture-state-docs.feature. Temp-dir fixtures; the
 * document lands at the configured paths.architecture (default
 * <root>/architecture.md).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readDocumentFingerprint, selfHeal } from '../../src/utils/architecture-document.js';
import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import { resolveConfiguredPath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function documentPath(directory: string): string {
  return resolveConfiguredPath(directory, 'architecture');
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
  mkdirSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true });
  writeFileSync(
    nodePath.join(context.directory, 'package.json'),
    JSON.stringify({ name: 'fixture' }),
  );
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('selfHeal — structural facts self-heal at session start', () => {
  it('creates a document when none exists', () => {
    const result = selfHeal(context.directory);

    expect(result.action).toBe('created');
    expect(existsSync(documentPath(context.directory))).toBe(true);
  });

  it('heals the document to the current shape when the fingerprint has moved', () => {
    selfHeal(context.directory);
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
    expect(content).toContain('billing');
  });

  it('leaves the document untouched when the fingerprint is unchanged', () => {
    selfHeal(context.directory);
    const before = readFileSync(documentPath(context.directory), 'utf8');

    const result = selfHeal(context.directory);

    expect(result.action).toBe('unchanged');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('regenerates a document whose fingerprint is missing or corrupt', () => {
    selfHeal(context.directory);
    writeFileSync(documentPath(context.directory), '# hand-mangled document with no frontmatter\n');

    const result = selfHeal(context.directory);

    expect(result.action).toBe('regenerated');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
  });

  it('re-syncs and flags lagging prose when a change is made out of band', () => {
    selfHeal(context.directory);
    // A human adds a module with no agent in the loop, then a session starts.
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    selfHeal(context.directory);

    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(content).toContain('billing');
    expect(content).toMatch(/stale/i);
  });
});
