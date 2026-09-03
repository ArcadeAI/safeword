import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  commandInvokesWriteReviewStamp,
  parsePackagedRecordSkillInvocation,
} from '../../src/commands/codex-hook.js';
import { runProjectRuntime } from '../../src/commands/project-runtime.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) removeTemporaryDirectory(directory);
  directories.length = 0;
  vi.unstubAllEnvs();
});

describe('packaged project runtime', () => {
  it('passes helper flags after the argument delimiter', () => {
    const result = spawnSync(
      process.execPath,
      [
        nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
        '--json',
        'project',
        'runtime',
        'unknown-helper',
        '--',
        '--yes',
      ],
      { encoding: 'utf8' },
    );

    expect(result.stderr).not.toContain('unknown option');
    expect(JSON.parse(result.stdout)).toMatchObject({
      errors: [{ code: 'PROJECT_RUNTIME_HELPER_INVALID' }],
    });
  });

  it('uses an enrolled CLAUDE_PROJECT_DIR when invoked below the project root', async () => {
    const project = createTemporaryDirectory();
    directories.push(project);
    mkdirSync(nodePath.join(project, '.safeword-project'), { recursive: true });
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# enrolled\n');
    const child = nodePath.join(project, 'nested');
    mkdirSync(child);
    vi.stubEnv('CLAUDE_PROJECT_DIR', project);

    const ticket = nodePath.join(project, '.safeword-project/tickets/ABC-proof/ticket.md');
    mkdirSync(nodePath.dirname(ticket), { recursive: true });
    writeFileSync(ticket, '---\nid: ABC\n---\n');

    const result = await runProjectRuntime(child, 'resolve-verify-ticket', ['--ticket', 'ABC']);

    expect(result.state).toBe('healthy');
    expect(result.presentation).toMatchObject({ kind: 'raw' });
    expect(result.presentation?.body.trim()).toMatch(
      /\.safeword-project\/tickets\/ABC-proof\/ticket\.md$/u,
    );
  });

  it('recognizes packaged proof commands for Codex session bridging', () => {
    expect(
      parsePackagedRecordSkillInvocation(
        'bunx --bun safeword@1.2.3 project record-skill-invocation --cwd "$PROJECT_DIR" verify "$SESSION"',
      ),
    ).toBe('verify');
    expect(
      commandInvokesWriteReviewStamp(
        'bunx --bun safeword@1.2.3 project runtime write-review-stamp -- spec',
      ),
    ).toBe(true);
  });
});
