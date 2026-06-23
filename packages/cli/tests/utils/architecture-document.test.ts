/**
 * Integration tests for the architecture state-document self-heal (ticket
 * QD5DTT, Slice 1). Covers the "structural facts self-heal at session start"
 * rule from features/architecture-state-docs.feature. Temp-dir fixtures; the
 * document lands at the fixed generated path (<namespace-root>/architecture.generated.md).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isWouldChangeAction,
  planSelfHeal,
  readDocumentFingerprint,
  selfHeal,
} from '../../src/utils/architecture-document.js';
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

  it('skips (not noop) a foreign doc even when the skeleton is empty', () => {
    // No modules here, but a foreign doc exists: ownership wins over the
    // empty-skeleton noop — the doc must be left untouched, never noop'd away.
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
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

describe('planSelfHeal — dry-run action, writes nothing (FPV0E4 Slice 2)', () => {
  it('reports the action selfHeal would take without writing the doc', () => {
    const action = planSelfHeal(context.directory);

    expect(action).toBe('created');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('agrees with selfHeal on the action for an unchanged doc', () => {
    selfHeal(context.directory);

    expect(planSelfHeal(context.directory)).toBe('unchanged');
    // A second plan call still mutates nothing.
    const before = readFileSync(documentPath(context.directory), 'utf8');
    planSelfHeal(context.directory);
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('reports healed for a moved fingerprint without touching the doc', () => {
    selfHeal(context.directory);
    const before = readFileSync(documentPath(context.directory), 'utf8');
    mkdirSync(nodePath.join(context.directory, 'src', 'billing'), { recursive: true });

    expect(planSelfHeal(context.directory)).toBe('healed');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(before);
  });

  it('reports noop for a project with no modules and no doc', () => {
    rmSync(nodePath.join(context.directory, 'src'), { recursive: true, force: true });

    expect(planSelfHeal(context.directory)).toBe('noop');
    expect(existsSync(documentPath(context.directory))).toBe(false);
  });

  it('reports skipped for a foreign doc and leaves it untouched', () => {
    const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
    mkdirSync(nodePath.dirname(documentPath(context.directory)), { recursive: true });
    writeFileSync(documentPath(context.directory), foreign);

    expect(planSelfHeal(context.directory)).toBe('skipped');
    expect(readFileSync(documentPath(context.directory), 'utf8')).toBe(foreign);
  });
});

describe('isWouldChangeAction — the enforcement threshold (FPV0E4 Slice 2)', () => {
  it('is true exactly for created, healed, and regenerated', () => {
    expect(isWouldChangeAction('created')).toBe(true);
    expect(isWouldChangeAction('healed')).toBe(true);
    expect(isWouldChangeAction('regenerated')).toBe(true);
  });

  it('is false for unchanged, noop, and skipped', () => {
    expect(isWouldChangeAction('unchanged')).toBe(false);
    expect(isWouldChangeAction('noop')).toBe(false);
    expect(isWouldChangeAction('skipped')).toBe(false);
  });
});
