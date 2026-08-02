import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFreshCloseoutBinding } from '../../templates/hooks/lib/cursor-run-identity.ts';
import { repoRoot } from '../helpers.js';

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
