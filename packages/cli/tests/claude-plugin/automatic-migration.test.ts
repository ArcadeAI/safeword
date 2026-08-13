import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { migrateClaudeLegacyAutomatically } from '../../src/claude-plugin/cleanup.js';
import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import {
  historicalCatalogueDigest,
  historicalHookEntry,
} from '../../src/claude-plugin/historical-ownership.js';
import { readClaudePluginMode } from '../../src/claude-plugin/migration-state.js';

const repoRoot = new URL('../../../..', import.meta.url).pathname;
const roots: string[] = [];
const hookDigest = 'a'.repeat(64);
const originalProjectDirectory = process.env.CLAUDE_PROJECT_DIR;

function fixture(version = '0.72.0'): { root: string; installedPath: string } {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-auto-claude-'));
  roots.push(root);
  const release =
    CLAUDE_HISTORICAL_CATALOGUE.releases[
      version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
    ];
  const installedPath = Object.keys(release.files)[0];
  if (installedPath === undefined) throw new Error(`Release ${version} has no Claude fixture.`);
  const schema = execFileSync('git', ['show', `v${version}:packages/cli/src/schema.ts`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const escaped = installedPath.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  // eslint-disable-next-line security/detect-non-literal-regexp -- escaped fixture path is test-owned
  const template = new RegExp(
    String.raw`['"]${escaped}['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]`,
    'su',
  ).exec(schema)?.[1];
  const content = execFileSync('git', ['show', `v${version}:packages/cli/templates/${template}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const target = nodePath.join(root, installedPath);
  mkdirSync(nodePath.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return { root, installedPath };
}

function migrate(root: string, now: () => number = () => 0) {
  process.env.CLAUDE_PROJECT_DIR = root;
  return migrateClaudeLegacyAutomatically(root, {
    pluginVersion: '0.73.0',
    hookManifestSha256: hookDigest,
    catalogueSha256: historicalCatalogueDigest(),
    deadline: 10,
    now,
  });
}

afterEach(() => {
  if (originalProjectDirectory === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = originalProjectDirectory;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('automatic Claude migration', () => {
  it.each(['0.68.0', '0.69.0', '0.72.0'])(
    'contracts exact %s released bytes and writes clean plugin mode silently',
    version => {
      const { root, installedPath } = fixture(version);
      const result = migrate(root);
      expect(result).toMatchObject({ state: 'complete', unresolvedPaths: [] });
      expect(result.advisory).toBeUndefined();
      expect(existsSync(nodePath.join(root, installedPath))).toBe(false);
      expect(readClaudePluginMode(root)).toMatchObject({ state: 'clean', unresolved_paths: [] });
      const quarantine = nodePath.join(root, '.safeword/claude-plugin/quarantine');
      const tombstones = readdirSync(quarantine);
      expect(tombstones).toHaveLength(1);
      expect(statSync(nodePath.join(quarantine, tombstones[0] ?? '')).size).toBe(0);
    },
  );

  it('preserves changed bytes and records unresolved plugin mode with one advisory', () => {
    const { root, installedPath } = fixture();
    const target = nodePath.join(root, installedPath);
    writeFileSync(target, 'user-owned change\n');
    const result = migrate(root);
    expect(result.state).toBe('complete');
    expect(result.advisory).toContain(installedPath);
    expect(readFileSync(target, 'utf8')).toBe('user-owned change\n');
    expect(readClaudePluginMode(root)).toMatchObject({
      state: 'unresolved',
      unresolved_paths: [installedPath],
    });
  });

  it('preserves a malformed non-array hook event while removing an exact historical entry', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    const fingerprint =
      CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.SessionStart?.[0] ?? '';
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      `${JSON.stringify({
        hooks: {
          SessionStart: [historicalHookEntry(fingerprint)],
          CustomEvent: { unexpected: true },
        },
      })}\n`,
    );

    expect(migrate(root).state).toBe('complete');
    expect(JSON.parse(readFileSync(settings, 'utf8'))).toEqual({
      hooks: { SessionStart: [], CustomEvent: { unexpected: true } },
    });
  });

  it('defers after writing the transaction and completes on the next attempt', () => {
    const { root, installedPath } = fixture();
    let reads = 0;
    const result = migrate(root, () => (reads++ === 0 ? 0 : 10));
    expect(result.state).toBe('deferred');
    expect(existsSync(nodePath.join(root, installedPath))).toBe(true);
    expect(
      existsSync(nodePath.join(root, '.safeword/claude-plugin/cleanup-transaction-v1.json')),
    ).toBe(true);

    expect(migrate(root).state).toBe('complete');
    expect(existsSync(nodePath.join(root, installedPath))).toBe(false);
    expect(readClaudePluginMode(root)?.state).toBe('clean');
  });

  it('preserves the winning transaction identity during no-op convergence', () => {
    const { root } = fixture();

    expect(migrate(root).state).toBe('complete');
    const winningTransactionId = readClaudePluginMode(root)?.transaction_id;
    expect(winningTransactionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );

    expect(migrate(root).state).toBe('complete');
    expect(readClaudePluginMode(root)?.transaction_id).toBe(winningTransactionId);
  });

  it('preserves the unresolved-path advisory when a deferred transaction recovers', () => {
    const { root } = fixture();
    const conflictingPath = Object.keys(CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].files)[1];
    expect(conflictingPath).toBeDefined();
    const conflict = nodePath.join(root, conflictingPath ?? 'missing');
    mkdirSync(nodePath.dirname(conflict), { recursive: true });
    writeFileSync(conflict, 'user-owned change\n');

    let reads = 0;
    expect(migrate(root, () => (reads++ === 0 ? 0 : 10)).state).toBe('deferred');

    const recovered = migrate(root);
    expect(recovered).toMatchObject({
      state: 'complete',
      unresolvedPaths: [conflictingPath],
    });
    expect(recovered.advisory).toContain(conflictingPath);
    expect(readFileSync(conflict, 'utf8')).toBe('user-owned change\n');
  });

  it('removes the directories contracted legacy assets leave behind', () => {
    const { root, installedPath } = fixture();
    const keptPath = nodePath.join(nodePath.dirname(installedPath), 'notes.md');
    const kept = nodePath.join(root, keptPath);
    writeFileSync(kept, 'user-authored note\n');

    expect(migrate(root).state).toBe('complete');

    // The sibling the user owns pins its directory; only Safeword's own empty
    // husks disappear.
    expect(readFileSync(kept, 'utf8')).toBe('user-authored note\n');
    const keptDirectory = nodePath.dirname(installedPath);
    expect(existsSync(nodePath.join(root, keptDirectory))).toBe(true);

    const { root: bare, installedPath: barePath } = fixture();
    const bareDirectory = nodePath.dirname(barePath);
    expect(migrate(bare).state).toBe('complete');
    expect(existsSync(nodePath.join(bare, bareDirectory))).toBe(false);
    expect(existsSync(nodePath.join(bare, '.claude'))).toBe(false);
  });

  it('contains unexpected migration exceptions instead of throwing into the prompt', () => {
    const missing = nodePath.join(tmpdir(), 'safeword-missing-project-for-auto-migration');
    rmSync(missing, { recursive: true, force: true });
    expect(() => migrate(missing)).not.toThrow();
    expect(migrate(missing)).toMatchObject({ state: 'attention' });
  });

  it('explains a transaction recovery failure without changing legacy bytes', () => {
    const { root, installedPath } = fixture();
    const target = nodePath.join(root, installedPath);
    const before = readFileSync(target);
    mkdirSync(nodePath.join(root, '.safeword/claude-plugin/cleanup-transaction-v1.json'), {
      recursive: true,
    });

    const result = migrate(root);

    expect(result.state).toBe('attention');
    expect(result.advisory).toContain('Safeword preserved the old Claude integration');
    expect(result.advisory).toContain('safeword claude recover');
    expect(readFileSync(target)).toEqual(before);
    expect(readClaudePluginMode(root)).toBeUndefined();
  });
});
