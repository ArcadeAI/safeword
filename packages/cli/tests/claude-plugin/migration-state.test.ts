import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  claimClaudeMigrationAdvisory,
  claimClaudeMigrationAttempt,
  pluginModeIsTerminal,
  readClaudePluginMode,
  writeClaudePluginMode,
} from '../../src/claude-plugin/migration-state.js';

const roots: string[] = [];
const digest = 'a'.repeat(64);

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Claude plugin mode v2', () => {
  it('keeps clean mode terminal across catalogue upgrades', () => {
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
    expect(pluginModeIsTerminal(marker, 'b'.repeat(64))).toBe(true);
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
    expect(pluginModeIsTerminal(marker, digest)).toBe(true);
    expect(pluginModeIsTerminal(marker, 'b'.repeat(64))).toBe(false);
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

  it('claims the same advisory only once per session', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-migration-advisory-'));
    roots.push(root);
    expect(claimClaudeMigrationAdvisory(root, 'session-a', digest)).toBe(true);
    expect(claimClaudeMigrationAdvisory(root, 'session-a', digest)).toBe(false);
    expect(claimClaudeMigrationAdvisory(root, 'session-b', digest)).toBe(true);
  });
});
