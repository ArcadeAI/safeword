import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

describe('OpenCode marker resolution', () => {
  it.each(['permission-failure', 'timeout'] as const)(
    'TBU1.R2.S09 fails open with bounded evidence after %s',
    async failure => {
      const root = temporaryDirectory();
      const project = nodePath.join(root, 'project');
      const markerDirectory = nodePath.join(project, '.safeword');
      const profile = nodePath.join(root, 'profile');
      const paths = openCodeProfilePaths(profile);
      const dispatcher = nodePath.join(root, 'dispatcher.mjs');
      const dispatcherCalled = nodePath.join(root, 'dispatcher-called');
      const sentinel = nodePath.join(root, 'operation-sentinel');
      mkdirSync(markerDirectory, { recursive: true });
      mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
      mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
      writeFileSync(nodePath.join(markerDirectory, 'SAFEWORD.md'), '# enrolled\n');
      writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
      writeFileSync(
        dispatcher,
        `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(
          dispatcherCalled,
        )}, 'called');\n`,
      );
      const generate = generateOpenCodeProfilePlugin;
      const pluginBytes = generate(
        failure === 'timeout' ? { markerTimeoutMilliseconds: 0 } : undefined,
      );
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
      if (failure === 'permission-failure') chmodSync(markerDirectory, 0o000);

      let error: unknown;
      try {
        await hooks['tool.execute.before'](
          { tool: 'bash', sessionID: 'private-session', callID: 'private-call' },
          { args: { command: 'operation' } },
        );
        writeFileSync(sentinel, 'changed\n');
      } catch (error_) {
        error = error_;
      } finally {
        if (failure === 'permission-failure') chmodSync(markerDirectory, 0o700);
      }

      expect(error).toBeUndefined();
      expect(existsSync(sentinel)).toBe(true);
      expect(existsSync(dispatcherCalled)).toBe(false);
      const evidence = JSON.parse(readFileSync(paths.profileError, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(Object.keys(evidence).toSorted((left, right) => left.localeCompare(right))).toEqual([
        'error_code',
        'observed_at',
        'plugin_sha256',
        'safeword_version',
        'schema_version',
      ]);
      expect(evidence).toMatchObject({
        schema_version: 1,
        safeword_version: '0.79.4',
        plugin_sha256: digest(pluginBytes),
        error_code: 'marker_resolution_failed',
      });
    },
  );
});
