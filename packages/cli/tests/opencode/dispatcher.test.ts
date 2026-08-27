import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getTemplatesDirectory } from '../../src/utils/fs.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];
const dispatcherPath = nodePath.resolve(import.meta.dirname, '../../dist/opencode/dispatcher.js');

function markedProject(): string {
  const project = createTemporaryDirectory();
  temporaryDirectories.push(project);
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  cpSync(
    nodePath.join(getTemplatesDirectory(), 'hooks'),
    nodePath.join(project, '.safeword', 'hooks'),
    { recursive: true },
  );
  return project;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('packaged OpenCode dispatcher', () => {
  it('runs after being copied without sibling build chunks or node_modules', () => {
    const project = markedProject();
    const isolated = createTemporaryDirectory();
    temporaryDirectories.push(isolated);
    const copiedDispatcher = nodePath.join(isolated, 'dispatcher.js');
    copyFileSync(dispatcherPath, copiedDispatcher);

    const result = spawnSync(process.execPath, [copiedDispatcher], {
      cwd: project,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        SAFEWORD_AGENT_RUNTIME: 'opencode',
        SAFEWORD_CODEX_DENY_MODE: 'exit-code',
      },
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'opencode-session',
        tool_name: 'Bash',
        tool_input: { command: 'printf safe' },
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ['exit 0', 'printf safe', 0],
    ['exit 2', 'pkill node', 2],
  ] as const)(
    'TBU1.R2.S03 preserves the canonical guard %s contract',
    (_case, command, exitCode) => {
      const project = markedProject();
      const result = spawnSync(process.execPath, [dispatcherPath], {
        cwd: project,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: project,
          SAFEWORD_AGENT_RUNTIME: 'opencode',
          SAFEWORD_CODEX_DENY_MODE: 'exit-code',
        },
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          session_id: 'opencode-session',
          tool_name: 'Bash',
          tool_input: { command },
        }),
        encoding: 'utf8',
      });

      expect(result.status, result.stderr).toBe(exitCode);
    },
  );
});
