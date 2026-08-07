import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { installClaudePlugin } from '../../src/claude-plugin/profile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createTemporaryDirectory } from '../helpers.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const directories: string[] = [];
const originalPath = process.env.PATH;
const originalProjectDirectory = process.env.CLAUDE_PROJECT_DIR;

function fixture(
  autoUpdate: boolean | undefined,
  ref = 'stable',
  environment?: Record<string, unknown>,
) {
  const root = createTemporaryDirectory();
  const project = nodePath.join(root, 'project');
  const bin = nodePath.join(root, 'bin');
  const log = nodePath.join(root, 'claude.log');
  const settingsPath = nodePath.join(project, '.claude/settings.json');
  directories.push(root);
  mkdirSync(nodePath.dirname(settingsPath), { recursive: true });
  mkdirSync(bin);
  const declaration: Record<string, unknown> = {
    source: { source: 'git', url: 'https://github.com/ArcadeAI/safeword.git', ref },
  };
  if (autoUpdate !== undefined) declaration.autoUpdate = autoUpdate;
  writeFileSync(
    settingsPath,
    `${JSON.stringify({ unrelated: { keep: true }, env: environment, extraKnownMarketplaces: { safeword: declaration } }, undefined, 2)}\n`,
  );
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
printf '%s\n' "$*" >> ${JSON.stringify(log)}
case "$*" in
  '--version') echo '2.1.170' ;;
  'plugin marketplace list --json') echo '[{"name":"safeword","source":{"url":"https://github.com/ArcadeAI/safeword.git","ref":"${ref}"}}]' ;;
  'plugin list --json') echo '[{"id":"safeword@safeword","scope":"project","projectPath":${JSON.stringify(project)},"version":"${SAFEWORD_SCHEMA.version}","enabled":true,"installPath":${JSON.stringify(nodePath.join(REPO_ROOT, 'plugin'))}}]' ;;
  *) exit 97 ;;
esac
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  process.env.PATH = `${bin}:${originalPath ?? ''}`;
  process.env.CLAUDE_PROJECT_DIR = project;
  return { log, project, settingsPath };
}

afterEach(() => {
  process.env.PATH = originalPath;
  if (originalProjectDirectory === undefined) delete process.env.CLAUDE_PROJECT_DIR;
  else process.env.CLAUDE_PROJECT_DIR = originalProjectDirectory;
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe('Claude marketplace update enrollment', () => {
  it('enables native auto-update for an eligible stable marketplace without disturbing other settings', () => {
    const { log, project, settingsPath } = fixture(undefined);

    const result = installClaudePlugin(project);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
      unrelated: unknown;
      extraKnownMarketplaces: { safeword: { autoUpdate?: boolean } };
    };

    // Installing leaves activation pending until the user runs /reload-plugins,
    // which ZE5RRG Rule NTB1.R2 reports as action_required rather than done.
    expect(result.state, JSON.stringify(result)).toBe('action_required');
    expect(settings.unrelated).toEqual({ keep: true });
    expect(settings.env.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE).toBe('1');
    expect(settings.extraKnownMarketplaces.safeword.autoUpdate).toBe(true);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('preserves existing environment settings and an explicit marketplace failure policy', () => {
    const { project, settingsPath } = fixture(true, 'stable', {
      KEEP_ME: 'yes',
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '0',
    });

    const result = installClaudePlugin(project);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, unknown>;
    };

    expect(result.state, JSON.stringify(result)).toBe('healthy');
    expect(settings.env).toEqual({
      KEEP_ME: 'yes',
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '0',
    });
  });

  it('preserves an explicit native auto-update opt-out', () => {
    const { log, project, settingsPath } = fixture(false);
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project);

    expect(result.state, JSON.stringify(result)).toBe('healthy');
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
  });

  it('does not migrate a stale marketplace while native auto-update is explicitly disabled', () => {
    const { log, project, settingsPath } = fixture(false, `v${SAFEWORD_SCHEMA.version}`);
    const before = readFileSync(settingsPath, 'utf8');

    const result = installClaudePlugin(project);

    expect(result.state).toBe('failed');
    expect((result.data as { classification?: string } | undefined)?.classification).toBe(
      'auto-update-disabled',
    );
    expect(readFileSync(settingsPath, 'utf8')).toBe(before);
    expect(readFileSync(log, 'utf8')).not.toContain('plugin marketplace add');
    expect(readFileSync(log, 'utf8')).not.toContain('plugin list --json');
  });
});
