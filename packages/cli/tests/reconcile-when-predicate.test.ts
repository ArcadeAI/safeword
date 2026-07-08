/**
 * TextPatch applicability predicate — `when?: (ctx) => boolean` (ZJMZ50,
 * #810 child 2, SM1.R1).
 *
 * The hook-manager world is a ProjectContext fact; schema entries gate on it
 * declaratively. Contract pinned here: `when` gates APPLICATION (install,
 * upgrade, file-creation) in both true/false directions, while unpatch stays
 * ungated — reset must strip a leftover block even after the host's world
 * changed since install.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcile } from '../src/reconcile';
import type { ProjectContext, SafewordSchema, TextPatchDefinition } from '../src/schema';

const TARGET = 'hooks-target.sh';

const BLOCK_MARKER = '# safeword predicate block';
const BLOCK = `${BLOCK_MARKER}\necho gated\n`;

function minimalSchema(patch: TextPatchDefinition): SafewordSchema {
  return {
    version: '0.0.0-test',
    ownedDirs: [],
    sharedDirs: [],
    preservedDirs: [],
    deprecatedFiles: [],
    deprecatedPackages: [],
    deprecatedDirs: [],
    ownedFiles: {},
    managedFiles: {},
    jsonMerges: {},
    textPatches: { [TARGET]: patch },
    legacyTextPatches: {},
    contracts: {},
    packages: { base: [], conditional: {} },
  };
}

describe('textPatch when-predicate', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'when-predicate-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function context(isGitRepo: boolean): ProjectContext {
    return {
      cwd: dir,
      projectType: {} as ProjectContext['projectType'],
      developmentDeps: {},
      productionDeps: {},
      isGitRepo,
    };
  }

  // The predicate reads the real ProjectContext — gate on isGitRepo to prove
  // the wiring without a spy.
  const gatedPatch: TextPatchDefinition = {
    operation: 'append',
    content: BLOCK,
    marker: BLOCK_MARKER,
    when: ctx => ctx.isGitRepo,
  };

  it('install applies a patch whose when(ctx) is true', async () => {
    await reconcile(minimalSchema(gatedPatch), 'install', context(true));
    expect(readFileSync(nodePath.join(dir, TARGET), 'utf8')).toContain(BLOCK_MARKER);
  });

  it('install skips a patch whose when(ctx) is false — no file is created', async () => {
    await reconcile(minimalSchema(gatedPatch), 'install', context(false));
    expect(existsSync(nodePath.join(dir, TARGET))).toBe(false);
  });

  it('upgrade skips a when-false patch even when the target file exists', async () => {
    writeFileSync(nodePath.join(dir, TARGET), 'user content\n');
    await reconcile(minimalSchema(gatedPatch), 'upgrade', context(false));
    expect(readFileSync(nodePath.join(dir, TARGET), 'utf8')).toBe('user content\n');
  });

  it('uninstall strips the block even when when(ctx) is now false', async () => {
    // World changed after install (e.g. husky -> lefthook migration): the
    // leftover block must still be removed on reset.
    writeFileSync(nodePath.join(dir, TARGET), `user content\n${BLOCK}`);
    await reconcile(minimalSchema(gatedPatch), 'uninstall', context(false));
    expect(readFileSync(nodePath.join(dir, TARGET), 'utf8')).not.toContain(BLOCK_MARKER);
    expect(readFileSync(nodePath.join(dir, TARGET), 'utf8')).toContain('user content');
  });
});
