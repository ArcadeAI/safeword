import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { writePassingOpenCodeConformance } from '../../src/opencode/evidence.js';
import {
  generateOpenCodeProfilePlugin,
  observeOpenCodeProfile,
  openCodeProfilePaths,
} from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';
import { blockChildren } from '../helpers/io-failure.js';

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
  it('keeps pre-tool activation after later events and dispatches from the enrolled root', async () => {
    const root = temporaryDirectory();
    const project = nodePath.join(root, 'project');
    const nested = nodePath.join(project, 'packages', 'app');
    const profile = nodePath.join(root, 'profile');
    const paths = openCodeProfilePaths(profile);
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    const observedCwd = nodePath.join(root, 'dispatcher-cwd');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(paths.safeword, { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      dispatcher,
      `import { writeFileSync } from 'node:fs';\nprocess.stdin.resume();\nprocess.stdin.on('end', () => { writeFileSync(${JSON.stringify(
        observedCwd,
      )}, process.cwd()); });\n`,
    );
    const pluginBytes = generateOpenCodeProfilePlugin();
    const digest = (value: string | Buffer): string =>
      createHash('sha256').update(value).digest('hex');
    const identity = {
      schema_version: 1 as const,
      safeword_version: '0.79.6',
      plugin_path: 'plugins/safeword.js',
      plugin_sha256: digest(pluginBytes),
      runtime_path: process.execPath,
      dispatcher_path: dispatcher,
      dispatcher_sha256: digest(readFileSync(dispatcher)),
    };
    writeFileSync(paths.plugin, pluginBytes);
    writeFileSync(paths.identity, `${JSON.stringify(identity)}\n`);

    const module = (await import(`${pathToFileURL(paths.plugin).href}?test=${Date.now()}`)) as {
      Safeword: (input: { directory: string }) => Promise<{
        'tool.execute.before': (
          input: { tool: string; sessionID: string; callID: string },
          output: { args: Record<string, unknown> },
        ) => Promise<void>;
        'tool.execute.after': (input: { sessionID: string; callID: string }) => Promise<void>;
      }>;
    };
    const hooks = await module.Safeword({ directory: nested });
    await hooks['tool.execute.before'](
      { tool: 'bash', sessionID: 'session', callID: 'call' },
      { args: { command: 'operation' } },
    );
    await hooks['tool.execute.after']({ sessionID: 'session', callID: 'call' });
    writePassingOpenCodeConformance(paths.conformance, {
      schema_version: 1,
      safeword_version: identity.safeword_version,
      opencode_version: '1.18.23',
      platform: process.platform,
      arch: process.arch,
      plugin_sha256: identity.plugin_sha256,
      dispatcher_sha256: identity.dispatcher_sha256,
      command_catalogue: true,
      agent_catalogue: true,
      denial: true,
      control: true,
      checked_at: new Date().toISOString(),
      result: 'passed',
    });

    expect(readFileSync(observedCwd, 'utf8')).toBe(realpathSync(project));
    expect(
      observeOpenCodeProfile(profile, {
        projectDirectory: project,
        opencodeVersion: '1.18.23',
      }),
    ).toMatchObject({ state: 'healthy', data: { activated: true, conformant: true } });
  });

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
      const generated = generateOpenCodeProfilePlugin();
      const pluginBytes =
        failure === 'timeout'
          ? generated.replace(
              'const MARKER_TIMEOUT_MILLISECONDS = 50;',
              'const MARKER_TIMEOUT_MILLISECONDS = 0;',
            )
          : generated;
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
      if (failure === 'permission-failure') blockChildren(markerDirectory);

      let error: unknown;
      try {
        await hooks['tool.execute.before'](
          { tool: 'bash', sessionID: 'private-session', callID: 'private-call' },
          { args: { command: 'operation' } },
        );
        writeFileSync(sentinel, 'changed\n');
      } catch (error_) {
        error = error_;
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
