import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  claimClaudeMigrationAdvisory,
  claimClaudeMigrationAttempt,
  claudeProjectStatePath,
  createClaudePluginMode,
  pluginModeIsTerminal,
  readClaudePluginMode,
  writeClaudePluginMode,
} from '../../src/claude-plugin/migration-state.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';

const roots: string[] = [];
const digest = 'a'.repeat(64);

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

useIsolatedClaudePluginState();

describe('Claude plugin mode v2', () => {
  it('re-arms clean mode when the verified plugin identity changes', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-plugin-mode-'));
    roots.push(root);
    writeClaudePluginMode(root, {
      schema_version: 2,
      state: 'clean',
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: [],
    });
    const marker = readClaudePluginMode(root);
    expect(marker).toBeDefined();
    if (marker === undefined) throw new Error('Plugin mode marker was not readable.');
    expect(
      pluginModeIsTerminal(marker, {
        plugin_version: '0.73.0',
        hook_manifest_sha256: digest,
        catalogue_sha256: 'b'.repeat(64),
      }),
    ).toBe(false);
  });

  it('re-arms unresolved paths when the catalogue changes', () => {
    const marker = {
      schema_version: 2 as const,
      state: 'unresolved' as const,
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: ['.claude/skills/custom/SKILL.md'],
    };
    expect(
      pluginModeIsTerminal(marker, {
        plugin_version: '0.73.0',
        hook_manifest_sha256: digest,
        catalogue_sha256: digest,
      }),
    ).toBe(true);
    expect(
      pluginModeIsTerminal(marker, {
        plugin_version: '0.73.0',
        hook_manifest_sha256: digest,
        catalogue_sha256: 'b'.repeat(64),
      }),
    ).toBe(false);
  });

  it('allows three launches for the first session and one for each later session', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-migration-attempts-'));
    roots.push(root);
    expect([1, 2, 3, 4].map(() => claimClaudeMigrationAttempt(root, 'first'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect([1, 2].map(() => claimClaudeMigrationAttempt(root, 'later'))).toEqual([true, false]);
  });

  it('gives a later session one separate recovery launch', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-migration-recovery-attempts-'));
    roots.push(root);
    expect(claimClaudeMigrationAttempt(root, 'first')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'later')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'later')).toBe(false);
    expect(claimClaudeMigrationAttempt(root, 'later', 'recovery')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'later', 'recovery')).toBe(false);
  });

  it('keeps recovery inside the initial session three-launch budget', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-initial-recovery-attempts-'));
    roots.push(root);
    expect(claimClaudeMigrationAttempt(root, 'initial')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'initial')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'initial', 'recovery')).toBe(true);
    expect(claimClaudeMigrationAttempt(root, 'initial', 'recovery')).toBe(false);
  });

  it('derives plugin-mode state even when a caller spreads a stale marker in', () => {
    // Spreading an existing marker compiles — TypeScript's excess-property
    // check does not apply to spreads — so the factory has to win regardless.
    const clean = {
      schema_version: 2 as const,
      state: 'clean' as const,
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: [] as readonly string[],
    };
    expect(
      createClaudePluginMode({ ...clean, unresolved_paths: ['.claude/skills/bdd/SKILL.md'] }).state,
    ).toBe('unresolved');
    expect(createClaudePluginMode({ ...clean, unresolved_paths: [] }).state).toBe('clean');
  });

  it('claims the same advisory only once per session', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-migration-advisory-'));
    roots.push(root);
    expect(claimClaudeMigrationAdvisory(root, 'session-a', digest)).toBe(true);
    expect(claimClaudeMigrationAdvisory(root, 'session-a', digest)).toBe(false);
    expect(claimClaudeMigrationAdvisory(root, 'session-b', digest)).toBe(true);
  });

  it('gives missing and blank session IDs a fresh budget in a later process', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-missing-session-attempts-'));
    roots.push(root);
    expect(
      [1, 2, 3, 4].map(() =>
        claimClaudeMigrationAttempt(root, undefined, 'migration', 'process-a'),
      ),
    ).toEqual([true, true, true, false]);
    expect(claimClaudeMigrationAttempt(root, '  ', 'migration', 'process-b')).toBe(true);
  });

  it('shows the same advisory again when a missing-ID session starts in a later process', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-missing-session-advisory-'));
    roots.push(root);
    expect(claimClaudeMigrationAdvisory(root, undefined, digest, 'process-a')).toBe(true);
    expect(claimClaudeMigrationAdvisory(root, '', digest, 'process-a')).toBe(false);
    expect(claimClaudeMigrationAdvisory(root, undefined, digest, 'process-b')).toBe(true);
  });

  it('rejects advisory digests that could escape the claims directory', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-advisory-traversal-'));
    roots.push(root);
    expect(() => claimClaudeMigrationAdvisory(root, 'session', '../escaped')).toThrow(
      'advisory digest is invalid',
    );
    const attempts = claudeProjectStatePath(root, 'attemptsDirectory');

    expect(existsSync(nodePath.join(attempts, '../escaped.json'))).toBe(false);
  });

  it('normalizes inconsistent plugin-mode state when writing', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-plugin-mode-normalize-'));
    roots.push(root);
    writeClaudePluginMode(root, {
      schema_version: 2,
      state: 'clean',
      plugin_version: '0.73.0',
      hook_manifest_sha256: digest,
      catalogue_sha256: digest,
      unresolved_paths: ['legacy-path'],
    });
    expect(readClaudePluginMode(root)?.state).toBe('unresolved');
  });

  it('rejects inconsistent plugin-mode state persisted outside the writer', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-plugin-mode-corrupt-'));
    roots.push(root);
    const markerPath = claudeProjectStatePath(root, 'pluginMarkerV2');
    mkdirSync(nodePath.dirname(markerPath), { recursive: true });
    writeFileSync(
      markerPath,
      JSON.stringify({
        schema_version: 2,
        state: 'unresolved',
        plugin_version: '0.73.0',
        hook_manifest_sha256: digest,
        catalogue_sha256: digest,
        unresolved_paths: [],
      }),
    );
    expect(readClaudePluginMode(root)).toBeUndefined();
  });
});
