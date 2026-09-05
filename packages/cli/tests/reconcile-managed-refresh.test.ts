/**
 * `refreshWhileUnmodified` — managed files that must track the CLI (#3717 follow-up).
 *
 * Managed files are create-only: `planManagedFilesActions` skipped anything already on
 * disk, so an upgrade never touched one. Right for a config the customer edits, wrong
 * for the advisory PR review workflows, which carry `npx safeword@<version>`. Those run
 * with write scopes under `pull_request_target` and check nothing out, so the version
 * has to be written into the file — and it froze at whichever release first installed
 * it. A customer who installed at 0.79.0 kept reviewing with 0.79.0 through every
 * upgrade; this repo sat four releases behind and nothing reported it.
 *
 * The opt-in refreshes such a file only while it is still safeword's own scaffold,
 * judged by the same normalized comparison that authorizes removal — so a customized
 * workflow keeps both its edits and its pin.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcile } from '../src/reconcile';
import type { ManagedFileDefinition, ProjectContext, SafewordSchema } from '../src/schema';

const TARGET = 'pinned-workflow.yml';
const CURRENT_PIN = '0.83.1';

function body(pin: string): string {
  return `jobs:\n  run: npx --yes safeword@${pin} review-pr publish\n`;
}

/** Strip the pin, the way the real schema does, so only customer edits count as changes. */
function normalizePin(content: string): string {
  return content.replaceAll(/safeword@\d+\.\d+\.\d+/gu, 'safeword@<pin>');
}

function schemaWith(managed: ManagedFileDefinition): SafewordSchema {
  return {
    version: '0.0.0-test',
    ownedDirs: [],
    sharedDirs: [],
    preservedDirs: [],
    deprecatedFiles: [],
    deprecatedPackages: [],
    deprecatedDirs: [],
    ownedFiles: {},
    managedFiles: { [TARGET]: managed },
    jsonMerges: {},
    textPatches: {},
    legacyTextPatches: {},
    contracts: {},
    codexMigration: {
      legacyFiles: [],
      cleanupFiles: [],
      legacyDirs: [],
      hookEvents: [],
      hookEventNames: {},
      hookScripts: [],
      sharedRuntimePaths: [],
      cleanupRuntimePaths: [],
      hookScriptEvents: {},
      hookScriptPrefix: '',
      packageRunner: 'npx',
      projectMarker: '.safeword/SAFEWORD.md',
    },
    packages: { base: [], conditional: {} },
  };
}

function definition(refresh: boolean): ManagedFileDefinition {
  return {
    generator: (): string => body(CURRENT_PIN),
    normalizeForUnmodifiedComparison: normalizePin,
    refreshWhileUnmodified: refresh,
    removeIfUnmodified: (): string => body(CURRENT_PIN),
  };
}

describe('managed file refresh while unmodified', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'managed-refresh-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function context(): ProjectContext {
    return {
      cwd: dir,
      projectType: {} as ProjectContext['projectType'],
      developmentDeps: {},
      productionDeps: {},
      isGitRepo: true,
    };
  }

  function install(content: string): string {
    const path = nodePath.join(dir, TARGET);
    writeFileSync(path, content);
    return path;
  }

  it('advances a stale pin on upgrade', async () => {
    const path = install(body('0.60.0'));
    await reconcile(schemaWith(definition(true)), 'upgrade', context());
    expect(readFileSync(path, 'utf8')).toContain(`safeword@${CURRENT_PIN}`);
  });

  it('leaves a customized workflow entirely alone, pin included', async () => {
    const customized = `${body('0.60.0')}# customer added this\n`;
    const path = install(customized);
    await reconcile(schemaWith(definition(true)), 'upgrade', context());
    // Not "keeps the customer line" — the whole file is untouched, so safeword
    // never has to guess which parts of someone's workflow were safe to rewrite.
    expect(readFileSync(path, 'utf8')).toBe(customized);
  });

  it('stays create-only without the opt-in, so this changes nothing by default', async () => {
    const stale = body('0.60.0');
    const path = install(stale);
    await reconcile(schemaWith(definition(false)), 'upgrade', context());
    expect(readFileSync(path, 'utf8')).toBe(stale);
  });

  it('still creates the file when it does not exist yet', async () => {
    await reconcile(schemaWith(definition(true)), 'install', context());
    expect(readFileSync(nodePath.join(dir, TARGET), 'utf8')).toContain(`safeword@${CURRENT_PIN}`);
  });
});
