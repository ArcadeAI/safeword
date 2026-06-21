/**
 * Integration tests for the architecture state-document self-heal (ticket
 * QD5DTT, Slice 1). Covers the "structural facts self-heal at session start"
 * rule from features/architecture-state-docs.feature. Temp-dir fixtures; the
 * document lands at the fixed generated path (<namespace-root>/architecture.generated.md).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readDocumentFingerprint, selfHeal } from '../../src/utils/architecture-document.js';
import { shapeFingerprint } from '../../src/utils/architecture-fingerprint.js';
import { resolveGeneratedArchitecturePath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function documentPath(directory: string): string {
  return resolveGeneratedArchitecturePath(directory);
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

  it('regenerates a safeword-owned document whose fingerprint is missing or corrupt', () => {
    selfHeal(context.directory);
    // Keep safeword's ownership marker; only the fingerprint is mangled away.
    writeFileSync(
      documentPath(context.directory),
      '---\ngenerator: safeword-architecture\n---\n\n# fingerprint corrupted\n',
    );

    const result = selfHeal(context.directory);

    expect(result.action).toBe('regenerated');
    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(readDocumentFingerprint(content)).toBe(shapeFingerprint(context.directory));
  });

  it('never overwrites a foreign hand-written doc it does not own', () => {
    const foreign = '# Our Architecture\n\nHand-written prose, no safeword marker.\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    const result = selfHeal(context.directory);

    expect(result.action).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });

  it('recognizes a safeword-owned doc with CRLF line endings (heals, never skips)', () => {
    selfHeal(context.directory);
    // Re-encode an owned doc with CRLF (git core.autocrlf) and a stale fingerprint.
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(
      documentPath(context.directory),
      '---\r\ngenerator: safeword-architecture\r\nfingerprint: stale\r\n---\r\n\r\n# Architecture\r\n',
    );

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
  });

  it('treats a different generator value as foreign and does not overwrite it', () => {
    const foreign = '---\ngenerator: safeword-architecture-v2\n---\n\n# theirs\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    const result = selfHeal(context.directory);

    expect(result.action).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
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

  it('flags a removed module as orphaned rather than silently dropping it', () => {
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });
    selfHeal(context.directory);
    rmSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true, force: true });

    selfHeal(context.directory);

    const content = readFileSync(documentPath(context.directory), 'utf8');
    expect(content).toMatch(/orphaned/i);
    expect(content).toContain('billing');
  });

  it('does not create a doc when there are no modules and none exists (noop)', () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('noop');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('heals an existing doc toward empty when all modules are removed (not noop)', () => {
    selfHeal(context.directory);
    rmSync(nodePath.join(context.directory, 'src', 'auth'), { recursive: true, force: true });

    const result = selfHeal(context.directory);

    expect(result.action).toBe('healed');
    expect(existsSync(documentPath(context.directory))).toBe(true);
  });
});
