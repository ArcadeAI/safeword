/**
 * `safeword project namespace-root` (ticket GJB22B) — the public subcommand
 * that replaces the project-local `.safeword/hooks/resolve-namespace-root.ts`
 * script for hosts with no installed hooks directory (Codex's self-contained
 * plugin). Skills capture its raw stdout in shell substitutions, so the output
 * must stay a bare path with no decoration.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { observeNamespaceRoot } from '../../src/commands/namespace-root.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('project namespace-root', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('prints the resolved namespace root as bare raw text', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.project'), { recursive: true });

    const result = await observeNamespaceRoot(temporaryDirectory, {});

    expect(result.presentation).toEqual({
      kind: 'raw',
      body: nodePath.join(temporaryDirectory, '.project'),
    });
  });

  it('falls back to the legacy namespace root when only it exists', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword-project'), { recursive: true });

    const result = await observeNamespaceRoot(temporaryDirectory, {});

    expect(result.presentation?.body).toBe(nodePath.join(temporaryDirectory, '.safeword-project'));
  });

  it('resolves a configured project-knowledge path under the namespace root', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.project'), { recursive: true });

    const result = await observeNamespaceRoot(temporaryDirectory, { key: 'personas' });

    expect(result.presentation?.body).toBe(
      nodePath.join(temporaryDirectory, '.project', 'personas.md'),
    );
  });

  it('honors a paths override for a configured key', async () => {
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { personas: 'docs/who.md' } }),
    );

    const result = await observeNamespaceRoot(temporaryDirectory, { key: 'personas' });

    expect(result.presentation?.body).toBe(nodePath.join(temporaryDirectory, 'docs/who.md'));
  });

  it('rejects a key that is not a configurable project-knowledge path', async () => {
    const result = await observeNamespaceRoot(temporaryDirectory, { key: 'bogus' });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('NAMESPACE_ROOT_KEY_INVALID');
  });
});
