import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommandInvocation } from '../../src/cli-protocol/handler.js';
import { createResult } from '../../src/cli-protocol/result.js';
import { installLifecycle, uninstallLifecycle } from '../../src/lifecycle/commands.js';
import type * as OpenCodeProfile from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const profileState = vi.hoisted(() => ({ codex: false, claude: false, opencode: false }));

vi.mock('../../src/opencode/profile.js', async importOriginal => ({
  ...(await importOriginal<typeof OpenCodeProfile>()),
  observeOpenCodeProfile: () =>
    createResult({
      state: 'healthy',
      data: { installed: profileState.opencode, profile_removable: profileState.opencode },
    }),
}));

vi.mock('../../src/opencode/conformance.js', () => ({ observeOpenCodeVersion: () => {} }));

vi.mock('../../src/claude-plugin/profile.js', () => ({
  observeClaudeProfile: () => ({ plugin: profileState.claude ? { installed: true } : undefined }),
  claudeInstallRequiresMutation: () => false,
  uninstallClaudePlugin: () => {
    const changed = profileState.claude;
    profileState.claude = false;
    return createResult({ state: changed ? 'changed' : 'healthy' });
  },
}));

vi.mock('../../src/claude-plugin/status.js', () => ({
  observeClaudeStatus: () => createResult({ state: 'healthy' }),
}));

vi.mock('../../src/codex-plugin/operations.js', () => ({
  observeCodexMigrationResult: () => ({ plugin: { installed: profileState.codex } }),
  codexInstallRequiresMutation: () => !profileState.codex,
  observeCodexMigration: () =>
    createResult({ state: profileState.codex ? 'healthy' : 'action_required' }),
  uninstallCodexPlugin: () => {
    const changed = profileState.codex;
    profileState.codex = false;
    return createResult({ state: changed ? 'changed' : 'healthy' });
  },
}));

const temporaryDirectories: string[] = [];

function project(): string {
  const cwd = createTemporaryDirectory();
  temporaryDirectories.push(cwd);
  return cwd;
}

function invocation(cwd: string, agents: string, options = {}): CommandInvocation {
  return {
    cwd,
    noInput: true,
    offline: false,
    operands: [],
    options: { agents, modify: false, scope: 'project', ...options },
  };
}

const adapters = {
  installClaude: () => Promise.resolve(createResult({ state: 'healthy' })),
  installCodex: () => {
    const changed = !profileState.codex;
    profileState.codex = true;
    return Promise.resolve(createResult({ state: changed ? 'changed' : 'healthy' }));
  },
};

async function installSelected(cwd: string) {
  const result = await installLifecycle(invocation(cwd, 'cursor,codex'), adapters);
  expect(result.errors).toEqual([]);
  return result;
}

function projectBytes(cwd: string, relativePath: string): string {
  return readFileSync(nodePath.join(cwd, relativePath), 'utf8');
}

afterEach(() => {
  profileState.codex = false;
  profileState.claude = false;
  profileState.opencode = false;
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('selected authority lifecycle reconciliation', () => {
  it.each([
    ['codex', 'claude'],
    ['claude', 'codex'],
    ['codex', 'opencode'],
    ['cursor', 'claude'],
  ] as const)(
    'removes %s without unenrolling the remaining %s host',
    async (removed, remaining) => {
      const cwd = project();
      profileState[remaining] = true;
      if (removed === 'claude') profileState.claude = true;
      const installed = await installLifecycle(invocation(cwd, removed), adapters);
      expect(installed.errors).toEqual([]);
      expect(existsSync(nodePath.join(cwd, '.cursor'))).toBe(removed === 'cursor');
      const preserved = ['.safeword/SAFEWORD.md', '.safeword/config.json'];
      const before = new Map(preserved.map(path => [path, projectBytes(cwd, path)]));

      const preview = await uninstallLifecycle(invocation(cwd, removed));
      const plan = (preview.data as { readonly plan: { readonly id: string } }).plan.id;
      const result = await uninstallLifecycle(invocation(cwd, removed, { yes: true, plan }));

      expect(result.errors).toEqual([]);
      if (removed !== 'cursor') expect(profileState[removed]).toBe(false);
      expect(profileState[remaining]).toBe(true);
      for (const [path, content] of before) expect(projectBytes(cwd, path)).toBe(content);
      expect(existsSync(nodePath.join(cwd, '.safeword/hooks'))).toBe(false);
      expect(existsSync(nodePath.join(cwd, '.cursor/commands/audit.md'))).toBe(false);
    },
  );

  it('uninstalls the Codex profile without changing Cursor or project content', async () => {
    const cwd = project();
    profileState.codex = true;
    await installSelected(cwd);
    const preserved = [
      '.cursor/commands/audit.md',
      '.cursor/rules/safeword-core.mdc',
      '.safeword/hooks/cursor/post-tool-quality.ts',
      '.safeword/skills/audit/SKILL.md',
      '.safeword/SAFEWORD.md',
    ];
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.project/authored.md'), 'authored knowledge\n');
    writeFileSync(nodePath.join(cwd, 'unrelated.txt'), 'unrelated content\n');
    const before = new Map(preserved.map(path => [path, projectBytes(cwd, path)]));

    const preview = await uninstallLifecycle(invocation(cwd, 'codex'));
    const plan = (preview.data as { readonly plan: { readonly id: string } }).plan.id;
    const result = await uninstallLifecycle(invocation(cwd, 'codex', { yes: true, plan }));

    expect(result.errors).toEqual([]);
    expect(profileState.codex).toBe(false);
    for (const [path, content] of before) expect(projectBytes(cwd, path)).toBe(content);
    expect(projectBytes(cwd, '.project/authored.md')).toBe('authored knowledge\n');
    expect(projectBytes(cwd, 'unrelated.txt')).toBe('unrelated content\n');
  });

  it('reconciles Codex and Cursor without restoring native project runtime', async () => {
    const cwd = project();
    profileState.codex = true;
    await installSelected(cwd);
    const retired = nodePath.join(cwd, '.safeword/hooks/codex/post-tool-quality.ts');
    expect(existsSync(retired)).toBe(false);
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.project/authored.md'), 'authored knowledge\n');
    writeFileSync(nodePath.join(cwd, 'unrelated.txt'), 'unrelated content\n');
    const cursorCommand = projectBytes(cwd, '.cursor/commands/audit.md');
    const cursorSkill = projectBytes(cwd, '.safeword/skills/audit/SKILL.md');

    const result = await installSelected(cwd);

    expect(result.errors).toEqual([]);
    expect(profileState.codex).toBe(true);
    expect(existsSync(retired)).toBe(false);
    expect(projectBytes(cwd, '.cursor/commands/audit.md')).toBe(cursorCommand);
    expect(projectBytes(cwd, '.safeword/skills/audit/SKILL.md')).toBe(cursorSkill);
    expect(projectBytes(cwd, '.project/authored.md')).toBe('authored knowledge\n');
    expect(projectBytes(cwd, '.safeword/SAFEWORD.md')).toContain('SAFEWORD');
    expect(projectBytes(cwd, 'unrelated.txt')).toBe('unrelated content\n');
  });
});
