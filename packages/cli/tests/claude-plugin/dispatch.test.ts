import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');

describe('Claude plugin dispatcher', () => {
  it('passes the bundled CLI path to aggregate child hooks', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plugin-project-'));
    const pluginData = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plugin-data-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'));
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PLUGIN_DATA: pluginData,
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
      CLAUDE_PROJECT_DIR: projectDirectory,
    };
    delete environment.SAFEWORD_PLUGIN_CLI;

    const result = spawnSync(
      'bun',
      [nodePath.join(PLUGIN_ROOT, 'runtime/dispatch.ts'), 'SessionStart', '--event-group'],
      {
        cwd: projectDirectory,
        env: environment,
        encoding: 'utf8',
        input: JSON.stringify({
          hook_event_name: 'SessionStart',
          session_id: 'dispatch-environment-test',
        }),
      },
    );

    expect(result.stderr).not.toContain('Module not found');
    expect(result.status).toBe(0);
    const projectDigest = createHash('sha256').update(realpathSync(projectDirectory)).digest('hex');
    const proofPath = nodePath.join(pluginData, 'execution-proofs-v2', `${projectDigest}.json`);
    expect(existsSync(proofPath)).toBe(true);
    expect(JSON.parse(readFileSync(proofPath, 'utf8'))).toMatchObject({
      event: 'SessionStart',
      session_id: 'dispatch-environment-test',
    });
  });
});
