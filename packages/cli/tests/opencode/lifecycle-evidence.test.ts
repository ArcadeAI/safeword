import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { PRODUCTION_INTEGRATIONS } from '../../src/lifecycle/integrations.js';
import { parseOpenCodeActivation } from '../../src/opencode/evidence.js';
import { generateOpenCodeProfilePlugin, openCodeProfilePaths } from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode lifecycle evidence', () => {
  it('TBU1.R2.S21 records every declared lifecycle event at its actual strength', async () => {
    const root = createTemporaryDirectory();
    temporaryDirectories.push(root);
    const project = nodePath.join(root, 'project');
    const profile = nodePath.join(root, 'profile');
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    const paths = openCodeProfilePaths(profile);
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(dispatcher, 'process.stdin.resume();\n');
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
    interface OpenCodeHooks {
      event(input: {
        event: { type: string; properties: { info?: { id: string }; sessionID?: string } };
      }): Promise<void>;
      'chat.message'(
        input: object,
        output: { message: { sessionID: string }; parts: unknown[] },
      ): Promise<void>;
      'tool.execute.before'(
        input: { tool: string; sessionID: string; callID: string },
        output: { args: { command: string } },
      ): Promise<void>;
      'tool.execute.after'(
        input: { tool: string; sessionID: string; callID: string; args: { command: string } },
        output: object,
      ): Promise<void>;
    }
    const module = (await import(`${pathToFileURL(paths.plugin).href}?test=${Date.now()}`)) as {
      Safeword: (input: { directory: string }) => Promise<OpenCodeHooks>;
    };
    const hooks = await module.Safeword({ directory: project });
    const sessionID = 'known-session';
    const callID = 'known-call';
    const cases = [
      [
        'session_start',
        'observe',
        () =>
          hooks.event({
            event: { type: 'session.created', properties: { info: { id: sessionID } } },
          }),
      ],
      [
        'prompt_submit',
        'observe',
        () => hooks['chat.message']({}, { message: { sessionID }, parts: [] }),
      ],
      [
        'pre_tool',
        'block',
        () =>
          hooks['tool.execute.before'](
            { tool: 'bash', sessionID, callID },
            { args: { command: 'true' } },
          ),
      ],
      [
        'post_tool',
        'observe',
        () =>
          hooks['tool.execute.after'](
            { tool: 'bash', sessionID, callID, args: { command: 'true' } },
            {},
          ),
      ],
      [
        'stop',
        'observe',
        () => hooks.event({ event: { type: 'session.idle', properties: { sessionID } } }),
      ],
    ] as const;
    const adapter = PRODUCTION_INTEGRATIONS.find(candidate => candidate.id === 'opencode');
    const projectHash = digest(realpathSync(project));
    for (const [event, strength, invoke] of cases) {
      expect(adapter?.capabilities.lifecycle[event]).toBe(strength);
      await invoke();
      const evidencePath = nodePath.join(paths.activation, `${projectHash}-${event}.json`);
      const evidenceBytes = readFileSync(evidencePath, 'utf8');
      const evidence = parseOpenCodeActivation(JSON.parse(evidenceBytes));
      expect(evidence).toMatchObject({
        event,
        session_id_sha256: digest(sessionID),
        ...((event === 'pre_tool' || event === 'post_tool') && { call_id_sha256: digest(callID) }),
      });
    }
  });
});
