import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { readFreshCloseoutBinding } from '../../templates/hooks/lib/closeout-binding.ts';
import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  repoRoot,
  setupOrThrow,
} from '../helpers.js';

function project(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-adapter-'));
  mkdirSync(nodePath.join(directory, '.safeword'));
  writeFileSync(nodePath.join(directory, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');
  return directory;
}

function closeoutCommand(directory: string): string {
  return `bun "${directory}/.safeword/scripts/closeout-cleanup.ts" --pr 42`;
}

describe('closeout production host adapters (93C14D TBU1.R4)', () => {
  it('installs the shared guard and resolves every local host entry point to it', async () => {
    const directory = createTemporaryDirectory();
    try {
      createTypeScriptPackageJson(directory);
      initGitRepo(directory);
      await setupOrThrow(directory, ['setup', '--yes'], { env: INSTALL_DEPENDENCIES_ENV });

      const claudeSkill = readFileSync(
        nodePath.join(directory, '.claude/skills/closeout/SKILL.md'),
        'utf8',
      );
      const cursorCommand = readFileSync(
        nodePath.join(directory, '.cursor/commands/closeout.md'),
        'utf8',
      );
      const installedGuard = nodePath.join(directory, '.safeword/scripts/closeout-cleanup.ts');
      const codexProfile = nodePath.join(directory, 'codex-profile/plugins/cache/safeword/0.0.0');
      const canonicalSkills = nodePath.join(repoRoot, 'packages/cli/templates/skills');
      for (const asset of generateCodexPluginAssets(canonicalSkills)) {
        const target = nodePath.join(codexProfile, asset.relativePath);
        mkdirSync(nodePath.dirname(target), { recursive: true });
        writeFileSync(target, asset.content);
      }
      const codexSkill = readFileSync(
        nodePath.join(codexProfile, 'skills/closeout/SKILL.md'),
        'utf8',
      );

      expect(claudeSkill).toContain('bun .safeword/scripts/closeout-cleanup.ts');
      expect(cursorCommand).toContain('.claude/skills/closeout/SKILL.md');
      expect(codexSkill).toContain('bun .safeword/scripts/closeout-cleanup.ts');
      expect(readFileSync(installedGuard, 'utf8')).toContain('executeCleanupOperation');
      const execution = spawnSync('bun', [installedGuard], {
        cwd: directory,
        encoding: 'utf8',
      });
      expect(execution.status).toBe(2);
      expect(execution.stderr).toContain('a fresh host session binding are required');
    } finally {
      removeTemporaryDirectory(directory);
    }
  });

  it('binds the exact Claude session and transcript through the shipped pre-tool hook', () => {
    const directory = project();
    const transcript = nodePath.join(directory, 'claude.jsonl');
    const result = spawnSync(
      'bun',
      [nodePath.join(repoRoot, 'packages/cli/templates/hooks/pre-tool-quality.ts')],
      {
        cwd: directory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
        input: JSON.stringify({
          session_id: 'claude-closeout-42',
          transcript_path: transcript,
          tool_name: 'Bash',
          tool_input: { command: closeoutCommand(directory) },
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'claude',
      id: 'claude-closeout-42',
      transcriptPath: transcript,
    });
  });

  it('binds the exact Codex session through the shipped pre-tool hook', () => {
    const directory = project();
    const result = spawnSync(
      process.execPath,
      [nodePath.join(repoRoot, 'packages/cli/dist/cli.js'), 'hook', 'codex', 'pre-tool-use'],
      {
        cwd: directory,
        input: JSON.stringify({
          session_id: 'codex-closeout-42',
          tool_name: 'Bash',
          tool_input: { command: closeoutCommand(directory) },
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'codex',
      id: 'codex-closeout-42',
    });
  });

  it('binds the exact Cursor conversation and transcript through the shipped shell hook', () => {
    const directory = project();
    const transcript = nodePath.join(directory, 'cursor.jsonl');
    const result = spawnSync(
      'bun',
      [nodePath.join(repoRoot, 'packages/cli/templates/hooks/cursor/before-shell-execution.ts')],
      {
        cwd: directory,
        input: JSON.stringify({
          workspace_roots: [directory],
          conversation_id: 'cursor-closeout-42',
          transcript_path: transcript,
          command: closeoutCommand(directory),
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ permission: 'allow' });
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'cursor',
      id: 'cursor-closeout-42',
      transcriptPath: transcript,
    });
  });
});
