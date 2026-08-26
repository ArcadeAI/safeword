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

describe('OpenCode activation evidence', () => {
  it('TBU1.R2.S20 atomically records a marked project plugin load without invented call identity', async () => {
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
    const dispatcherHash = digest(readFileSync(dispatcher));
    writeFileSync(paths.plugin, pluginBytes);
    writeFileSync(
      paths.identity,
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: '0.79.4',
        plugin_path: 'plugins/safeword.js',
        plugin_sha256: digest(pluginBytes),
        runtime_path: process.execPath,
        dispatcher_path: dispatcher,
        dispatcher_sha256: dispatcherHash,
      })}\n`,
    );
    const module = (await import(`${pathToFileURL(paths.plugin).href}?test=${Date.now()}`)) as {
      Safeword: (input: { directory: string }) => Promise<unknown>;
    };

    await module.Safeword({ directory: project });

    const projectHash = digest(realpathSync(project));
    const recordPath = nodePath.join(paths.activation, `${projectHash}.json`);
    expect(existsSync(recordPath)).toBe(true);
    const bytes = readFileSync(recordPath, 'utf8');
    const record = parseOpenCodeActivation(JSON.parse(bytes));
    expect(record).toMatchObject({
      schema_version: 1,
      safeword_version: '0.79.4',
      plugin_sha256: digest(pluginBytes),
      project_sha256: projectHash,
      event: 'plugin_load',
    });
    expect(record).not.toHaveProperty('session_id_sha256');
    expect(record).not.toHaveProperty('call_id_sha256');
    expect(bytes).not.toContain(project);
  });
});
