/**
 * The SessionStart architecture self-heal hook must invoke the canonical
 * `project architecture` command, not the retained `architecture` alias.
 *
 * Invoking the alias makes the CLI emit a `CLI_ALIAS_DEPRECATED` finding on
 * every session start, even when nothing changed — noisy output that dilutes
 * the health-check signal (issue #8143).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const HOOKS = nodePath.resolve(import.meta.dirname, '../../templates/hooks');

describe('session-architecture-heal uses the canonical command', () => {
  let root: string;

  afterEach(() => {
    if (root !== undefined) removeTemporaryDirectory(root);
  });

  it('shells out to `project architecture`, not the deprecated `architecture` alias', () => {
    root = createTemporaryDirectory();
    const project = nodePath.join(root, 'project');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(project, '.git'), 'gitdir: elsewhere\n');
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');

    // Stub the project's own source CLI so it records the exact argv.
    const log = nodePath.join(root, 'architecture-argv.log');
    mkdirSync(nodePath.join(project, 'packages/cli/src'), { recursive: true });
    writeFileSync(nodePath.join(project, 'packages/cli/package.json'), '{"name":"safeword"}\n');
    writeFileSync(
      nodePath.join(project, 'packages/cli/src/cli.ts'),
      `import { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));\n`,
    );

    const result = spawnSync('bun', [nodePath.join(HOOKS, 'session-architecture-heal.ts')], {
      input: JSON.stringify({
        session_id: 'canonical-command-test',
        hook_event_name: 'SessionStart',
        cwd: project,
      }),
      cwd: project,
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(result.status, result.stderr).toBe(0);
    const args = JSON.parse(readFileSync(log, 'utf8')) as string[];
    expect(args).toEqual(['project', 'architecture']);
  });
});
