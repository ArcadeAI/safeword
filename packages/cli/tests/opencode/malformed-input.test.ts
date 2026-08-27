import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

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

describe('OpenCode covered input validation', () => {
  it('TBU1.R2.S15 denies every malformed covered-tool input', async () => {
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
      Safeword: (input: { directory: string }) => Promise<{
        'tool.execute.before': (
          input: { tool: string; sessionID: string; callID: string },
          output: { args: Record<string, unknown> },
        ) => Promise<void>;
      }>;
    };
    const hooks = await module.Safeword({ directory: project });
    const cases: readonly (readonly [string, Record<string, unknown>])[] = [
      ['bash', {}],
      ['bash', { command: 42 }],
      ['bash', { command: '' }],
      ['shell', { command: 42 }],
      ['shell', { command: '' }],
      ['shell', {}],
      ['edit', {}],
      ['edit', { filePath: 42 }],
      ['edit', { filePath: '' }],
      ['edit', { filePath: ['target'] }],
      ['write', { filePath: ['target'] }],
      ['write', {}],
      ['write', { filePath: 42 }],
      ['write', { filePath: '' }],
      ['patch', { patchText: '*** Begin Patch\n*** Mystery File: target\n*** End Patch' }],
      ['patch', {}],
      ['patch', { patchText: 42 }],
      ['patch', { patchText: '' }],
    ];

    for (const [index, [tool, args]] of cases.entries()) {
      const operation = hooks['tool.execute.before'](
        { tool, sessionID: `session-${index}`, callID: `call-${index}` },
        { args },
      );
      await expect(operation).rejects.toThrow('Safeword denied this OpenCode tool call.');
    }
  });
});
