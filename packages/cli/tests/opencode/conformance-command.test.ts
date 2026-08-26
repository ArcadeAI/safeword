import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';

function executable(directory: string, body: string): void {
  const path = nodePath.join(directory, 'opencode');
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

describe('OpenCode conformance command', () => {
  it.each([
    ['unresolvable', undefined],
    ['wrong version', String.raw`printf '1.18.24\n'`],
    ['pre-conformance failure', 'exit 9'],
  ])('fails safely when the executable is %s', async (_state, body) => {
    const project = createTemporaryDirectory();
    const config = createTemporaryDirectory();
    const bin = createTemporaryDirectory();
    if (body !== undefined) executable(bin, body);

    const result = await runCli(
      ['conformance', '--agents=opencode', '--json', '--no-input', '--offline', '--cwd', project],
      { cwd: project, env: { OPENCODE_CONFIG_DIR: config, PATH: bin } },
    );

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      changed: false,
      data: { command: 'conformance', agent: 'opencode' },
      next_actions: [{ kind: 'human', mutates: false, requires_human: true }],
    });
    expect(existsSync(nodePath.join(config, 'safeword', 'conformance-v1'))).toBe(false);
  });

  it('uses the pinned real host to discover the generated Safeword catalogue', async () => {
    const project = createTemporaryDirectory();
    const config = createTemporaryDirectory();
    const bin = createTemporaryDirectory();
    executable(bin, 'exec bunx --bun opencode-ai@1.18.23 "$@"');
    expect(installOpenCodeProfile(config).state).toBe('changed');

    const result = await runCli(
      ['conformance', '--agents=opencode', '--json', '--no-input', '--offline', '--cwd', project],
      {
        cwd: project,
        env: {
          OPENCODE_CONFIG_DIR: config,
          PATH: `${bin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        },
        timeout: 120_000,
      },
    );

    expect(result).toMatchObject({ exitCode: 2, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      data: {
        command: 'conformance',
        agent: 'opencode',
        discovery: { command: 'bdd', subagent: 'safeword-reviewer', skill: 'bdd' },
      },
    });
    expect(existsSync(nodePath.join(config, 'safeword', 'conformance-v1'))).toBe(false);
  }, 120_000);
});
