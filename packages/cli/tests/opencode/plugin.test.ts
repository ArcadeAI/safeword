import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

describe('generated OpenCode profile plugin', () => {
  it('TBU1.R2.S01 maps every covered input into the pinned canonical guard envelope', async () => {
    const root = temporaryDirectory();
    const project = nodePath.join(root, 'project');
    const profile = nodePath.join(root, 'profile');
    const paths = openCodeProfilePaths(profile);
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    const invocations = nodePath.join(root, 'dispatcher-invocations.jsonl');
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      dispatcher,
      `import { appendFileSync } from 'node:fs';\nlet raw = '';\nprocess.stdin.setEncoding('utf8');\nfor await (const chunk of process.stdin) raw += chunk;\nappendFileSync(${JSON.stringify(invocations)}, raw + '\\n');\nconst envelope = JSON.parse(raw);\nif (JSON.stringify(envelope.tool_input).includes('deny')) {\n  process.stdout.write(JSON.stringify({ schema_version: 1, decision: 'deny', reason: 'Safeword denied this operation.' }));\n  process.exitCode = 2;\n}\n`,
    );

    const pluginBytes = generateOpenCodeProfilePlugin();
    writeFileSync(paths.plugin, pluginBytes);
    const digest = (value: string | Buffer): string =>
      createHash('sha256').update(value).digest('hex');
    const dispatcherBytes = readFileSync(dispatcher);
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
    const patchText = [
      '*** Begin Patch',
      '*** Add File: add-target',
      '+content',
      '*** Update File: update-target',
      '@@',
      '-old',
      '+new',
      '*** Delete File: delete-target',
      '*** End Patch',
    ].join('\n');
    const cases = [
      ['bash', { command: 'allow bash' }, 'Bash', { command: 'allow bash' }],
      ['bash', { command: 'deny bash' }, 'Bash', { command: 'deny bash' }],
      ['shell', { command: 'allow shell' }, 'Bash', { command: 'allow shell' }],
      ['shell', { command: 'deny shell' }, 'Bash', { command: 'deny shell' }],
      ['edit', { filePath: 'allow-edit' }, 'Edit', { file_path: 'allow-edit' }],
      ['edit', { filePath: 'deny-edit' }, 'Edit', { file_path: 'deny-edit' }],
      ['write', { filePath: 'allow-write' }, 'Write', { file_path: 'allow-write' }],
      ['write', { filePath: 'deny-write' }, 'Write', { file_path: 'deny-write' }],
      ['patch', { patchText }, 'apply_patch', { command: patchText }],
      [
        'patch',
        { patchText: patchText.replace('update-target', 'deny-target') },
        'apply_patch',
        {
          command: patchText.replace('update-target', 'deny-target'),
        },
      ],
    ] as const;

    for (const [index, [tool, args, toolName, toolInput]] of cases.entries()) {
      const sentinel = nodePath.join(root, `sentinel-${index}`);
      const operation = async () => {
        await hooks['tool.execute.before'](
          { tool, sessionID: `session-${index}`, callID: `call-${index}` },
          { args },
        );
        writeFileSync(sentinel, 'changed\n');
      };
      const denied = JSON.stringify(toolInput).includes('deny');

      if (denied)
        await expect(operation()).rejects.toThrow('Safeword denied this OpenCode tool call.');
      else await operation();

      expect(existsSync(sentinel)).toBe(!denied);
      const invocation = JSON.parse(
        readFileSync(invocations, 'utf8').trim().split('\n').at(-1) ?? '',
      );
      expect(invocation).toEqual({
        hook_event_name: 'PreToolUse',
        session_id: `session-${index}`,
        tool_name: toolName,
        tool_input: toolInput,
      });
      if (tool === 'patch') {
        expect(invocation.tool_input.command).toContain('add-target');
        expect(invocation.tool_input.command).toContain(denied ? 'deny-target' : 'update-target');
        expect(invocation.tool_input.command).toContain('delete-target');
      }
    }
  });

  it('TBU1.R2.S04 exposes one bounded denial reason without sensitive dispatcher data', async () => {
    const root = temporaryDirectory();
    const project = nodePath.join(root, 'project');
    const profile = nodePath.join(root, 'profile');
    const paths = openCodeProfilePaths(profile);
    const dispatcher = nodePath.join(root, 'dispatcher.mjs');
    const commandSentinel = 'private-command-sentinel';
    const pathSentinel = 'private-path-sentinel';
    const stderrSentinel = 'private-stderr-sentinel';
    const environmentSentinel = 'private-environment-sentinel';
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
    mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
    writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
    writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      dispatcher,
      `process.stderr.write(${JSON.stringify(stderrSentinel)});\nprocess.stdout.write(JSON.stringify({ schema_version: 1, decision: 'deny', reason: ${JSON.stringify(
        [commandSentinel, pathSentinel, stderrSentinel, environmentSentinel].join(' '),
      )} }));\nprocess.exitCode = 2;\n`,
    );

    const pluginBytes = generateOpenCodeProfilePlugin();
    writeFileSync(paths.plugin, pluginBytes);
    const digest = (value: string | Buffer): string =>
      createHash('sha256').update(value).digest('hex');
    const dispatcherBytes = readFileSync(dispatcher);
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

    let error: unknown;
    try {
      await hooks['tool.execute.before'](
        { tool: 'bash', sessionID: 'private-session', callID: 'private-call' },
        { args: { command: commandSentinel, filePath: pathSentinel } },
      );
    } catch (error_) {
      error = error_;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Safeword denied this OpenCode tool call.');
    for (const sentinel of [commandSentinel, pathSentinel, stderrSentinel, environmentSentinel]) {
      expect((error as Error).message).not.toContain(sentinel);
    }
  });

  it.each(['absent', 'pruned-after-upgrade', 'moved-from-bound-path'] as const)(
    'TBU1.R2.S12 denies a marked project with repair when its dispatcher is %s',
    async dispatcherState => {
      const root = temporaryDirectory();
      const project = nodePath.join(root, 'project');
      const profile = nodePath.join(root, 'profile');
      const paths = openCodeProfilePaths(profile);
      const dispatcher = nodePath.join(root, 'dispatcher.mjs');
      const movedDispatcher = nodePath.join(root, 'moved-dispatcher.mjs');
      const sentinel = nodePath.join(root, 'operation-sentinel');
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      mkdirSync(nodePath.dirname(paths.plugin), { recursive: true });
      mkdirSync(nodePath.dirname(paths.identity), { recursive: true });
      writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), 'managed\n');
      writeFileSync(nodePath.join(profile, 'package.json'), '{"type":"module"}\n');
      if (dispatcherState !== 'absent') writeFileSync(dispatcher, 'process.exitCode = 0;\n');

      const pluginBytes = generateOpenCodeProfilePlugin();
      const dispatcherBytes = Buffer.from('process.exitCode = 0;\n');
      const digest = (value: string | Buffer): string =>
        createHash('sha256').update(value).digest('hex');
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
      if (dispatcherState === 'pruned-after-upgrade') {
        rmSync(dispatcher);
      } else if (dispatcherState === 'moved-from-bound-path') {
        renameSync(dispatcher, movedDispatcher);
      }

      const module = (await import(`${pathToFileURL(paths.plugin).href}?test=${Date.now()}`)) as {
        Safeword: (input: { directory: string }) => Promise<{
          'tool.execute.before': (
            input: { tool: string; sessionID: string; callID: string },
            output: { args: Record<string, unknown> },
          ) => Promise<void>;
        }>;
      };
      const hooks = await module.Safeword({ directory: project });
      let error: unknown;
      try {
        await hooks['tool.execute.before'](
          { tool: 'bash', sessionID: 'session', callID: 'call' },
          { args: { command: 'operation' } },
        );
        writeFileSync(sentinel, 'changed\n');
      } catch (error_) {
        error = error_;
      }

      expect(existsSync(sentinel)).toBe(false);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Safeword cannot run its OpenCode guard. Run safeword install --agents=opencode.',
      );
    },
  );
});
