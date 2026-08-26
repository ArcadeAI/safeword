import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

      if (denied) await expect(operation()).rejects.toThrow('Safeword denied this operation.');
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
});
