import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCliProgram } from '../../src/cli-protocol/program.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const directories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
  for (const directory of directories) removeTemporaryDirectory(directory);
  directories.length = 0;
});

async function invoke(cwd: string, args: readonly string[]): Promise<Record<string, unknown>> {
  const output: string[] = [];
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    output.push(String(chunk));
    return true;
  });
  await createCliProgram().parseAsync([
    'node',
    'safeword',
    ...args,
    '--json',
    '--no-input',
    '--cwd',
    cwd,
  ]);
  writeSpy.mockRestore();
  return JSON.parse(output.join('')) as Record<string, unknown>;
}

describe('review routes CLI wiring', () => {
  it('sets, lists, and resets ordered user routes through the assembled program', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    const cwd = nodePath.join(root, 'project');
    const xdg = nodePath.join(root, 'profile');
    vi.stubEnv('XDG_CONFIG_HOME', xdg);

    const set = await invoke(cwd, [
      'review',
      'routes',
      'set',
      '--author',
      'claude',
      '--route',
      'opencode=vendor/model',
      '--route',
      'codex',
    ]);
    const profile = nodePath.join(xdg, 'safeword', 'config.json');
    expect(set).toMatchObject({
      state: 'changed',
      changed: true,
      effects: { files: [{ kind: 'create', target: profile }] },
    });
    expect(JSON.parse(readFileSync(profile, 'utf8'))).toMatchObject({
      crossAgentReviewRoutes: {
        claude: [{ reviewer: 'opencode', model: 'vendor/model' }, { reviewer: 'codex' }],
      },
    });
    expect(existsSync(nodePath.join(cwd, '.safeword', 'config.json'))).toBe(false);

    const listed = await invoke(cwd, ['review', 'routes', 'list', '--author', 'claude']);
    expect(listed).toMatchObject({
      state: 'healthy',
      data: {
        source: 'user',
        routes: [
          { reviewer: 'opencode', model: 'vendor/model', independence: 'cross-agent' },
          { reviewer: 'codex', independence: 'cross-agent' },
        ],
      },
    });

    const reset = await invoke(cwd, ['review', 'routes', 'reset', '--author', 'claude']);
    expect(reset).toMatchObject({
      state: 'changed',
      changed: true,
      effects: { files: [{ kind: 'update', target: profile }] },
    });
    const defaults = await invoke(cwd, ['review', 'routes', 'list', '--author', 'claude']);
    expect(defaults).toMatchObject({
      state: 'healthy',
      data: {
        source: 'built-in',
        routes: [
          { reviewer: 'codex', independence: 'cross-agent' },
          { reviewer: 'opencode', independence: 'cross-agent' },
          { reviewer: 'claude', independence: 'degraded' },
        ],
      },
    });
  });

  it('writes explicit project scope and reports same-author routes as degraded', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    vi.stubEnv('XDG_CONFIG_HOME', nodePath.join(root, 'profile'));
    await invoke(root, [
      'review',
      'routes',
      'set',
      '--scope',
      'project',
      '--author',
      'codex',
      '--route',
      'codex=gpt-5.6-sol',
    ]);
    const listed = await invoke(root, ['review', 'routes', 'list', '--author', 'codex']);
    expect(listed).toMatchObject({
      data: {
        source: 'project',
        routes: [{ reviewer: 'codex', model: 'gpt-5.6-sol', independence: 'degraded' }],
      },
    });
  });

  it('reports malformed profile configuration through the JSON result envelope', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    const xdg = nodePath.join(root, 'profile');
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    const profile = nodePath.join(xdg, 'safeword', 'config.json');
    mkdirSync(nodePath.dirname(profile), { recursive: true });
    writeFileSync(profile, '{ malformed');

    const listed = await invoke(root, ['review', 'routes', 'list', '--author', 'claude']);

    expect(listed).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID', retryable: false }],
      data: { command: 'review routes list' },
    });
  });
});
