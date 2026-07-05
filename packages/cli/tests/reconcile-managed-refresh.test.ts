/**
 * Unit proof for the provenance-gated managed-file refresh (ticket A4HG61,
 * #849): the per-file decision rule, and the jsonMerge co-ownership
 * exclusion (a managed file that a json-merge also edits must not be
 * provenance-tracked — the merge rewrites it after the managed write, so a
 * recorded pre-merge hash would break the manifest's core invariant).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decideManagedFileAction, reconcile } from '../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';
import {
  hashManagedFileContent,
  MANAGED_FILE_MANIFEST_PATH,
  readManagedFileManifest,
} from '../src/utils/managed-file-manifest.js';

const DEFAULT_PROJECT_TYPE = {
  typescript: false,
  react: false,
  nextjs: false,
  astro: false,
  vitest: false,
  playwright: false,
  tailwind: true, // resolves a prettier plugin, so the .prettierrc json-merge mutates the file post-write
  tanstackQuery: false,
  publishableLibrary: false,
  shell: false,
  hasJsSource: false,
  existingLinter: false,
  existingFormatter: false,
  existingPrettierConfig: false,
  existingEslintConfig: undefined,
  legacyEslint: false,
  existingRuffConfig: undefined,
  existingMypyConfig: false,
  existingImportLinterConfig: false,
  existingGolangciConfig: undefined,
  existingClippyConfig: undefined,
  existingRustfmtConfig: undefined,
  existingSqlfluffConfig: undefined,
  existingCucumberHarness: undefined,
  scaffoldBddLane: true,
};

const DEFAULT_LANGUAGES = {
  javascript: true,
  python: false,
  golang: false,
  rust: false,
  sql: false,
};

function makeContext(cwd: string) {
  return {
    cwd,
    projectType: DEFAULT_PROJECT_TYPE,
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: false,
    languages: DEFAULT_LANGUAGES,
  };
}

describe('managed-file provenance (A4HG61, #849)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-managed-refresh-'));
    writeFileSync(nodePath.join(cwd, 'package.json'), JSON.stringify({ name: 'host' }));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  describe('jsonMerge co-ownership exclusion (MF1)', () => {
    it('never records a hash for a managed file that a json-merge also edits', async () => {
      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext(cwd));

      const manifest = readManagedFileManifest(cwd);
      expect(manifest.kind).toBe('ok');
      if (manifest.kind !== 'ok') return;

      for (const [path, recorded] of Object.entries(manifest.files)) {
        const onDisk = readFileSync(nodePath.join(cwd, path), 'utf8');
        expect(recorded, `stale recorded hash for ${path}`).toBe(hashManagedFileContent(onDisk));
      }
      // The tailwind plugin merge rewrites .prettierrc after the managed
      // write — a recorded pre-merge hash would be permanently stale.
      expect(manifest.files['.prettierrc']).toBeUndefined();
    });

    it('never refreshes a merge-co-owned managed file on upgrade', async () => {
      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext(cwd));
      // Reconstruct the poisoned state a pre-fix install left behind: a
      // recorded pre-merge hash that no longer matches the merged file.
      const prettierrcPath = nodePath.join(cwd, '.prettierrc');
      const preMergeBytes = '{}\n';
      const manifest = readManagedFileManifest(cwd);
      const files = manifest.kind === 'ok' ? manifest.files : {};
      writeFileSync(
        nodePath.join(cwd, MANAGED_FILE_MANIFEST_PATH),
        JSON.stringify({
          version: 1,
          files: { ...files, '.prettierrc': hashManagedFileContent(preMergeBytes) },
        }),
      );
      writeFileSync(prettierrcPath, preMergeBytes);

      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', makeContext(cwd), {
        dryRun: true,
      });
      expect(result.updated).not.toContain('.prettierrc');
    });
  });

  describe('decideManagedFileAction — the 7-case rule (SI3)', () => {
    const CONTENT = 'resolved output\n';
    const HASH = hashManagedFileContent(CONTENT);
    const okManifest = (files: Record<string, string>) => ({ kind: 'ok', files }) as const;

    it('creates and records a missing file', () => {
      expect(decideManagedFileAction('a.md', CONTENT, cwd, { kind: 'absent' })).toEqual({
        kind: 'create',
        hash: HASH,
      });
    });

    it('creates WITHOUT recording when the manifest is corrupt', () => {
      expect(decideManagedFileAction('a.md', CONTENT, cwd, { kind: 'corrupt' })).toEqual({
        kind: 'create',
        hash: undefined,
      });
    });

    it('skips an existing file when the manifest is corrupt', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), 'old bytes\n');
      expect(decideManagedFileAction('a.md', CONTENT, cwd, { kind: 'corrupt' })).toEqual({
        kind: 'skip',
      });
    });

    it('skips a current file whose record already matches', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), CONTENT);
      expect(decideManagedFileAction('a.md', CONTENT, cwd, okManifest({ 'a.md': HASH }))).toEqual({
        kind: 'skip',
      });
    });

    it('adopts a current file with no record (byte-identity adoption)', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), CONTENT);
      expect(decideManagedFileAction('a.md', CONTENT, cwd, okManifest({}))).toEqual({
        kind: 'record',
        hash: HASH,
      });
    });

    it('heals a current file whose record is stale (DD9)', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), CONTENT);
      expect(
        decideManagedFileAction('a.md', CONTENT, cwd, okManifest({ 'a.md': 'stale' })),
      ).toEqual({ kind: 'record', hash: HASH });
    });

    it('refreshes a pristine, stale file', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), 'old bytes\n');
      const manifest = okManifest({ 'a.md': hashManagedFileContent('old bytes\n') });
      expect(decideManagedFileAction('a.md', CONTENT, cwd, manifest)).toEqual({
        kind: 'refresh',
        hash: HASH,
      });
    });

    it('skips an edited file (record mismatch)', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), 'customer edit\n');
      const manifest = okManifest({ 'a.md': hashManagedFileContent('what safeword wrote\n') });
      expect(decideManagedFileAction('a.md', CONTENT, cwd, manifest)).toEqual({ kind: 'skip' });
    });

    it('skips an unrecorded, differing file (pre-manifest, never adopted)', () => {
      writeFileSync(nodePath.join(cwd, 'a.md'), 'unknown provenance\n');
      expect(decideManagedFileAction('a.md', CONTENT, cwd, okManifest({}))).toEqual({
        kind: 'skip',
      });
    });
  });
});
