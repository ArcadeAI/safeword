import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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

describe('generated OpenCode uncovered-tool observation', () => {
  it('TBU1.R2.S16 observes an uncovered tool without denying or dispatching it', async () => {
    const root = temporaryDirectory();
    const project = nodePath.join(root, 'project');
    const profile = nodePath.join(root, 'profile');
    const paths = openCodeProfilePaths(profile);
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    const dispatcherSentinel = nodePath.join(root, 'dispatcher-called');
    const operationSentinel = nodePath.join(root, 'operation-completed');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      dispatcher,
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(dispatcherSentinel)}, 'called');\n`,
    );

    const digest = (value: string | Buffer): string =>
      createHash('sha256').update(value).digest('hex');
    const pluginBytes = generateOpenCodeProfilePlugin();
    const dispatcherBytes = readFileSync(dispatcher);
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
        dispatcher_sha256: digest(dispatcherBytes),
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

    await hooks['tool.execute.before'](
      { tool: 'custom_uncovered_tool', sessionID: 'session', callID: 'call' },
      { args: { private: 'input' } },
    );
    writeFileSync(operationSentinel, 'completed\n');

    const projectHash = digest(realpathSync(project));
    const evidence = JSON.parse(
      readFileSync(nodePath.join(paths.activation, `${projectHash}.json`), 'utf8'),
    ) as Record<string, unknown>;
    expect(existsSync(operationSentinel)).toBe(true);
    expect(existsSync(dispatcherSentinel)).toBe(false);
    expect(evidence).toMatchObject({
      event: 'uncovered_tool',
      session_id_sha256: digest('session'),
      call_id_sha256: digest('call'),
    });
  });
});
