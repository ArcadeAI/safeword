/* eslint-disable unicorn/no-null -- transaction JSON uses null for an absent file image */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { claudeLegacyMutations, recoverClaudeCleanup } from '../../src/claude-plugin/cleanup.js';
import { CLAUDE_HISTORICAL_CATALOGUE } from '../../src/claude-plugin/historical-catalogue.generated.js';
import {
  historicalCatalogueDigest,
  historicalHookEntry,
} from '../../src/claude-plugin/historical-ownership.js';
import { claudeProjectStatePath } from '../../src/claude-plugin/migration-state.js';
import { useIsolatedClaudePluginState } from '../helpers/claude-plugin-state.js';

const fixtures: string[] = [];
const recognizedLegacy = readFileSync(
  new URL('../../templates/skills/debug/SKILL.md', import.meta.url),
  'utf8',
);

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fixture(): { root: string; target: string; transaction: string } {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-recovery-'));
  fixtures.push(root);
  const target = nodePath.join(root, '.claude/skills/debug/SKILL.md');
  const transaction = claudeProjectStatePath(root, 'transaction');
  mkdirSync(nodePath.dirname(target), { recursive: true });
  mkdirSync(nodePath.dirname(transaction), { recursive: true });
  return { root, target, transaction };
}

function writeTransaction(
  path: string,
  before: string,
  overrides: Record<string, unknown> = {},
): void {
  writeFileSync(
    path,
    `${JSON.stringify({
      schema_version: 1,
      transaction_id: '00000000-0000-4000-8000-000000000000',
      disposition: 'complete-forward',
      state: 'recoverable',
      owner_pid: process.pid,
      entries: [
        {
          path: '.claude/skills/debug/SKILL.md',
          before_sha256: sha256(before),
          before_base64: Buffer.from(before).toString('base64'),
          before_mode: 0o644,
          after_sha256: null,
          after_base64: null,
          after_mode: null,
        },
      ],
      plugin_mode: {
        plugin_version: '0.74.0',
        hook_manifest_sha256: 'a'.repeat(64),
        catalogue_sha256: historicalCatalogueDigest(),
        unresolved_paths: [],
      },
      ...overrides,
    })}\n`,
  );
}

afterEach(() => {
  const completed = [...fixtures];
  fixtures.length = 0;
  for (const root of completed) rmSync(root, { recursive: true, force: true });
});

useIsolatedClaudePluginState();

describe('Claude cleanup recovery', () => {
  it('completes the recorded forward image only from the recorded before fingerprint', () => {
    const { root, target, transaction } = fixture();
    writeFileSync(target, recognizedLegacy);
    writeTransaction(transaction, recognizedLegacy);

    expect(recoverClaudeCleanup(root).state).toBe('changed');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(transaction)).toBe(false);
  });

  it('rejects legacy restore-backup journals instead of trusting their images', () => {
    const { root, target, transaction } = fixture();
    writeTransaction(transaction, recognizedLegacy, { disposition: 'restore-backup' });

    expect(recoverClaudeCleanup(root).state).toBe('failed');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(transaction)).toBe(true);
  });

  it('accepts an all-after forward transaction and retires it idempotently', () => {
    const { root, target, transaction } = fixture();
    writeTransaction(transaction, recognizedLegacy);
    expect(existsSync(target)).toBe(false);

    expect(recoverClaudeCleanup(root).state).toBe('changed');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(transaction)).toBe(false);
    expect(existsSync(claudeProjectStatePath(root, 'pluginMarkerV2'))).toBe(true);
  });

  it('preserves unknown concurrent bytes and retains recovery evidence', () => {
    const { root, target, transaction } = fixture();
    writeFileSync(target, 'concurrent user bytes\n');
    writeTransaction(transaction, recognizedLegacy);

    const result = recoverClaudeCleanup(root);
    expect(result.state).toBe('failed');
    expect(readFileSync(target, 'utf8')).toBe('concurrent user bytes\n');
    expect(existsSync(transaction)).toBe(true);
  });

  it('refuses a symlinked managed target before mutation', () => {
    const { root, target, transaction } = fixture();
    const external = nodePath.join(root, 'external');
    writeFileSync(external, 'external bytes\n');
    symlinkSync(external, target);
    writeTransaction(transaction, recognizedLegacy);

    expect(recoverClaudeCleanup(root).state).toBe('failed');
    expect(readFileSync(external, 'utf8')).toBe('external bytes\n');
  });

  it('rejects an attacker-selected after-image even for a catalogued target', () => {
    const { root, target, transaction } = fixture();
    writeFileSync(target, recognizedLegacy);
    writeTransaction(transaction, recognizedLegacy);
    const crafted = JSON.parse(readFileSync(transaction, 'utf8')) as {
      entries: { after_base64: string; after_mode: number; after_sha256: string }[];
    };
    const entry = crafted.entries[0];
    if (entry === undefined) throw new Error('Missing transaction entry fixture.');
    const malicious = 'attacker-selected instructions\n';
    entry.after_base64 = Buffer.from(malicious).toString('base64');
    entry.after_sha256 = sha256(malicious);
    entry.after_mode = 0o644;
    writeFileSync(transaction, `${JSON.stringify(crafted)}\n`);

    expect(recoverClaudeCleanup(root).state).toBe('failed');
    expect(readFileSync(target, 'utf8')).toBe(recognizedLegacy);
  });

  it('refuses to follow a symlinked transaction journal', () => {
    const { root, target, transaction } = fixture();
    const external = nodePath.join(root, 'external-transaction.json');
    writeFileSync(target, recognizedLegacy);
    writeTransaction(external, recognizedLegacy);
    symlinkSync(external, transaction);

    expect(recoverClaudeCleanup(root).state).toBe('failed');
    expect(readFileSync(target, 'utf8')).toBe(recognizedLegacy);
    expect(existsSync(external)).toBe(true);
  });

  it('is a healthy no-op after recovery has completed', () => {
    const { root } = fixture();
    expect(recoverClaudeCleanup(root).state).toBe('healthy');
  });

  it('recovers repository-owned state from a nested working directory', () => {
    const { root, target, transaction } = fixture();
    const nested = nodePath.join(root, 'packages/example');
    mkdirSync(nested, { recursive: true });
    execFileSync('git', ['init', '--quiet', root]);
    writeFileSync(target, recognizedLegacy);
    writeTransaction(transaction, recognizedLegacy);

    expect(recoverClaudeCleanup(nested).state).toBe('changed');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(transaction)).toBe(false);
  });
});

describe('Claude settings contraction', () => {
  function acceptedPromptHook(): unknown {
    const fingerprint =
      CLAUDE_HISTORICAL_CATALOGUE.releases['0.72.0'].hooks.UserPromptSubmit?.[0] ?? '';
    return historicalHookEntry(fingerprint);
  }

  it('removes only exact historical entries while preserving untouched JSONC bytes', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    const accepted = acceptedPromptHook();
    const modified = structuredClone(accepted) as { hooks: { command: string }[] };
    const modifiedCommand = modified.hooks[0];
    if (modifiedCommand === undefined) throw new Error('Historical hook command is missing.');
    modifiedCommand.command += ' --custom';
    const prefix =
      '{\n  // user heading stays byte-exact\n  "theme"  :  "dark",\n  "hooks": {\n    "UserPromptSubmit": [\n';
    const suffix = '\n    ]\n  },\n  "custom" : { "spacing" : true } // tail stays\n}\n';
    writeFileSync(
      settings,
      `${prefix}      ${JSON.stringify(accepted)},\n      ${JSON.stringify(modified)},\n      {"hooks":[{"type":"command","command":"bun third-party.ts"}]}${suffix}`,
    );

    const mutation = claudeLegacyMutations(root).find(
      entry => entry.path === '.claude/settings.json',
    );
    expect(mutation?.content).not.toBeNull();
    expect(mutation?.content).toContain('// user heading stays byte-exact');
    expect(mutation?.content).toContain('"theme"  :  "dark"');
    expect(mutation?.content).toContain('"custom" : { "spacing" : true } // tail stays');
    expect(mutation?.content).toContain('--custom');
    expect(mutation?.content).toContain('bun third-party.ts');
    expect(mutation?.content).not.toContain(JSON.stringify(accepted));
  });

  it('deletes a generated hook-only settings file instead of leaving an empty object', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    writeFileSync(
      settings,
      `${JSON.stringify({ hooks: { UserPromptSubmit: [acceptedPromptHook()] } }, undefined, 2)}\n`,
    );
    expect(claudeLegacyMutations(root)).toContainEqual({
      path: '.claude/settings.json',
      content: null,
    });
  });

  it('preserves unrelated empty hook events when contracting generated hooks', () => {
    const { root } = fixture();
    const settings = nodePath.join(root, '.claude/settings.json');
    writeFileSync(
      settings,
      `${JSON.stringify({
        hooks: { UserPromptSubmit: [acceptedPromptHook()], CustomEvent: [] },
      })}\n`,
    );

    const mutation = claudeLegacyMutations(root).find(
      entry => entry.path === '.claude/settings.json',
    );
    expect(mutation?.content).not.toBeNull();
    expect(JSON.parse(mutation?.content ?? '{}')).toEqual({
      hooks: { UserPromptSubmit: [], CustomEvent: [] },
    });
  });
});
