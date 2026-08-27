import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { parseOpenCodeActivation } from '../../src/opencode/evidence.js';
import { generateOpenCodeProfilePlugin, openCodeProfilePaths } from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode evidence recovery', () => {
  it('TBU1.R2.S11 clears a prior marker error and records the handled pre-tool call', async () => {
    const root = temporaryDirectory();
    const project = nodePath.join(root, 'project');
    const profile = nodePath.join(root, 'profile');
    const paths = openCodeProfilePaths(profile);
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(dispatcher, 'process.exitCode = 0;\n');

    const pluginBytes = generateOpenCodeProfilePlugin();
    const digest = (value: string | Buffer): string =>
      createHash('sha256').update(value).digest('hex');
    const pluginHash = digest(pluginBytes);
    const dispatcherHash = digest(readFileSync(dispatcher));
    writeFileSync(paths.plugin, pluginBytes);
    writeFileSync(
      paths.identity,
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: '0.79.4',
        plugin_path: 'plugins/safeword.js',
        plugin_sha256: pluginHash,
        runtime_path: process.execPath,
        dispatcher_path: dispatcher,
        dispatcher_sha256: dispatcherHash,
      })}\n`,
    );
    writeFileSync(
      paths.profileError,
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: '0.79.4',
        plugin_sha256: pluginHash,
        error_code: 'marker_resolution_failed',
        observed_at: '2026-08-26T12:00:00.000Z',
      })}\n`,
    );
    const module = (await import(`${pathToFileURL(paths.plugin).href}?test=${Date.now()}`)) as {
      Safeword: (input: { directory: string }) => Promise<{
        'tool.execute.before': (
          input: { tool: string; sessionID: string; callID: string },
          output: { args: Record<string, unknown> },
        ) => Promise<void>;
      }>;
    };
    const hooks = await module.Safeword({ directory: project });
    const sessionID = 'private-session';
    const callID = 'private-call';

    await hooks['tool.execute.before'](
      { tool: 'bash', sessionID, callID },
      { args: { command: 'operation' } },
    );

    const projectHash = digest(realpathSync(project));
    const activationPath = nodePath.join(paths.activation, `${projectHash}-pre_tool.json`);
    expect(existsSync(paths.profileError)).toBe(false);
    expect(existsSync(activationPath)).toBe(true);
    const record = parseOpenCodeActivation(JSON.parse(readFileSync(activationPath, 'utf8')));
    expect(record).toMatchObject({
      schema_version: 1,
      safeword_version: '0.79.4',
      plugin_sha256: pluginHash,
      project_sha256: projectHash,
      event: 'pre_tool',
      session_id_sha256: digest(sessionID),
      call_id_sha256: digest(callID),
    });
  });
});
