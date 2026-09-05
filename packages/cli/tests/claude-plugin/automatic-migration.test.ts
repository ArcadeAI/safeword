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

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { migrateClaudeLegacyAutomatically } from '../../src/claude-plugin/cleanup.js';
import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import {
  historicalCatalogueDigest,
  historicalHookEntry,
} from '../../src/claude-plugin/historical-ownership.js';
import {
  claudeProjectStatePath,
  readClaudePluginMode,
} from '../../src/claude-plugin/migration-state.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';
import { readHistoricalTemplate, requireHistoricalReleaseTags } from '../helpers/git-history.js';
import { blockWrites } from '../helpers/io-failure.js';

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
  const content = readHistoricalTemplate(version, installedPath);
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

/** Releases this suite reads real bytes from; shared with the history preflight. */
const FIXTURE_VERSIONS = ['0.68.0', '0.69.0', '0.72.0'];

useIsolatedClaudePluginState();

describe('automatic Claude migration', () => {
  beforeAll(() => {
    requireHistoricalReleaseTags(FIXTURE_VERSIONS);
  });

  it.each(FIXTURE_VERSIONS)(
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
    expect(existsSync(claudeProjectStatePath(root, 'transaction'))).toBe(true);

    expect(migrate(root).state).toBe('complete');
    expect(existsSync(nodePath.join(root, installedPath))).toBe(false);
    expect(readClaudePluginMode(root)?.state).toBe('clean');
  });

  it('recovers a deferred settings contraction through the validated transaction', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    const fingerprint =
      CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.SessionStart?.[0] ?? '';
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      `${JSON.stringify({
        hooks: { SessionStart: [historicalHookEntry(fingerprint)] },
        userSetting: true,
      })}\n`,
    );

    let reads = 0;
    expect(migrate(root, () => (reads++ === 0 ? 0 : 10)).state).toBe('deferred');
    expect(migrate(root).state).toBe('complete');
    expect(JSON.parse(readFileSync(settings, 'utf8'))).toEqual({
      hooks: { SessionStart: [] },
      userSetting: true,
    });
  });

  it('finishes recovery from an interrupted deterministic settings write', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    const fingerprint =
      CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.SessionStart?.[0] ?? '';
    mkdirSync(nodePath.dirname(settings), { recursive: true });
    writeFileSync(
      settings,
      `${JSON.stringify({
        hooks: { SessionStart: [historicalHookEntry(fingerprint)] },
        userSetting: true,
      })}\n`,
    );

    let reads = 0;
    expect(migrate(root, () => (reads++ === 0 ? 0 : 10)).state).toBe('deferred');
    const transaction = JSON.parse(
      readFileSync(claudeProjectStatePath(root, 'transaction'), 'utf8'),
    ) as { entries: { path: string; after_base64: string | null }[] };
    const after = transaction.entries.find(
      entry => entry.path === '.claude/settings.json',
    )?.after_base64;
    expect(after).toBeTypeOf('string');
    const afterBytes = Buffer.from(after ?? '', 'base64');
    const partialLength = Math.max(1, Math.floor(afterBytes.length / 2));
    writeFileSync(settings, afterBytes.subarray(0, partialLength));

    expect(migrate(root).state).toBe('complete');
    expect(readFileSync(settings)).toEqual(afterBytes);
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

  it('retains a quarantined raced replacement and recovery evidence', () => {
    const { root, installedPath } = fixture();
    const target = nodePath.join(root, installedPath);
    const replacement = Buffer.from('concurrent replacement bytes\n');
    process.env.CLAUDE_PROJECT_DIR = root;

    const result = migrateClaudeLegacyAutomatically(root, {
      pluginVersion: '0.73.0',
      hookManifestSha256: hookDigest,
      catalogueSha256: historicalCatalogueDigest(),
      deadline: 10,
      now: () => 0,
      beforeQuarantine: () => {
        rmSync(target);
        writeFileSync(target, replacement);
      },
    });

    expect(result.state).toBe('attention');
    const transactionPath = claudeProjectStatePath(root, 'transaction');
    const transaction = JSON.parse(readFileSync(transactionPath, 'utf8')) as {
      entries: { quarantine_path?: string }[];
    };
    const quarantinePath = transaction.entries.find(
      entry => entry.quarantine_path,
    )?.quarantine_path;
    expect(quarantinePath).toBeDefined();
    expect(readFileSync(nodePath.join(root, quarantinePath ?? ''))).toEqual(replacement);
    expect(existsSync(target)).toBe(false);

    expect(migrate(root).state).toBe('attention');
    expect(readFileSync(nodePath.join(root, quarantinePath ?? ''))).toEqual(replacement);
    expect(existsSync(transactionPath)).toBe(true);
    expect(readClaudePluginMode(root)).toBeUndefined();
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
    const container = mkdtempSync(nodePath.join(tmpdir(), 'safeword-missing-project-'));
    roots.push(container);
    const missing = nodePath.join(container, 'not-created');
    expect(() => migrate(missing)).not.toThrow();
    expect(migrate(missing)).toMatchObject({ state: 'attention' });
  });

  it('explains a transaction recovery failure without changing legacy bytes', () => {
    const { root, installedPath } = fixture();
    const target = nodePath.join(root, installedPath);
    const before = readFileSync(target);
    blockWrites(claudeProjectStatePath(root, 'transaction'));

    const result = migrate(root);

    expect(result.state).toBe('attention');
    expect(result.advisory).toContain('Safeword preserved the old Claude integration');
    expect(result.advisory).toContain('safeword claude recover');
    expect(readFileSync(target)).toEqual(before);
    expect(readClaudePluginMode(root)).toBeUndefined();
  });
});
