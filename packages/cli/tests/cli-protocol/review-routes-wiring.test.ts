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

async function invokeHuman(cwd: string, args: readonly string[]): Promise<string> {
  const output: string[] = [];
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    output.push(String(chunk));
    return true;
  });
  await createCliProgram().parseAsync(['node', 'safeword', ...args, '--no-input', '--cwd', cwd]);
  writeSpy.mockRestore();
  return output.join('');
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
      data: {
        routes: [
          { reviewer: 'opencode', model: 'vendor/model', independence: 'cross-agent' },
          { reviewer: 'codex', independence: 'cross-agent' },
        ],
      },
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
    expect(await invokeHuman(cwd, ['review', 'routes', 'list', '--author', 'claude'])).toContain(
      '1. opencode (vendor/model) [cross-agent]',
    );

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

  it('resolves each author independently across project and user scopes', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    const xdg = nodePath.join(root, 'profile');
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    await invoke(root, ['review', 'routes', 'set', '--author', 'claude', '--route', 'opencode']);
    await invoke(root, [
      'review',
      'routes',
      'set',
      '--scope',
      'project',
      '--author',
      'codex',
      '--route',
      'claude',
    ]);

    expect(await invoke(root, ['review', 'routes', 'list', '--author', 'claude'])).toMatchObject({
      data: { source: 'user', routes: [{ reviewer: 'opencode' }] },
    });
  });

  it('validates the user profile even when the project has a valid route', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    const xdg = nodePath.join(root, 'profile');
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(root, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { claude: [{ reviewer: 'codex' }] } }),
    );
    const profile = nodePath.join(xdg, 'safeword', 'config.json');
    mkdirSync(nodePath.dirname(profile), { recursive: true });
    writeFileSync(profile, '{ malformed');

    const listed = await invoke(root, ['review', 'routes', 'list', '--author', 'claude']);
    expect(listed).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
    });
    expect((listed.errors as { message: string }[])[0]?.message).toContain(profile);
  });

  it('preserves unrelated project configuration while setting and resetting routes', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    vi.stubEnv('XDG_CONFIG_HOME', nodePath.join(root, 'profile'));
    const configPath = nodePath.join(root, '.safeword', 'config.json');
    mkdirSync(nodePath.dirname(configPath), { recursive: true });
    const unrelated = { installedPacks: ['typescript'], crossAgentReview: 'prefer' };
    writeFileSync(configPath, JSON.stringify(unrelated));

    await invoke(root, [
      'review',
      'routes',
      'set',
      '--scope',
      'project',
      '--author',
      'claude',
      '--route',
      'codex',
    ]);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toMatchObject(unrelated);
    await invoke(root, ['review', 'routes', 'reset', '--scope', 'project', '--author', 'claude']);
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual(unrelated);
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

  it('reports durable write failures as retryable instead of invalid configuration', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    writeFileSync(nodePath.join(root, '.safeword'), 'not a directory');

    const result = await invoke(root, [
      'review',
      'routes',
      'set',
      '--scope',
      'project',
      '--author',
      'claude',
      '--route',
      'codex',
    ]);

    expect(result).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_ROUTE_CONFIG_WRITE_FAILED', retryable: true }],
    });
  });

  it('lists every author when no author is given', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);

    const listed = await invoke(root, ['review', 'routes', 'list']);
    expect(listed).toMatchObject({ state: 'healthy', data: { command: 'review routes list' } });
    const authors = (listed.data as { authors: { author: string }[] }).authors;
    expect(authors.map(entry => entry.author)).toEqual(['claude', 'codex', 'opencode']);

    const human = await invokeHuman(root, ['review', 'routes', 'list']);
    expect(human).toContain('claude review routes');
    expect(human).toContain('codex review routes');
    expect(human).toContain('opencode review routes');
  });

  it('rejects an author that is not a review agent', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);

    const listed = await invoke(root, ['review', 'routes', 'list', '--author', 'gemini']);
    expect(listed).toMatchObject({ state: 'failed' });
    expect((listed.errors as { message: string }[])[0]?.message).toContain(
      'Provide --author as claude, codex, or opencode.',
    );
  });

  it('names the configuration key and file that change the routes', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);

    const human = await invokeHuman(root, ['review', 'routes', 'list', '--author', 'claude']);
    expect(human).toContain('crossAgentReviewRoutes');
    expect(human).toContain(nodePath.join('.safeword', 'config.json'));

    const listed = await invoke(root, ['review', 'routes', 'list', '--author', 'claude']);
    expect(listed).toMatchObject({
      data: { config_key: 'crossAgentReviewRoutes' },
    });
  });

  it('reports route-list read failures as read failures', async () => {
    const root = createTemporaryDirectory();
    directories.push(root);
    mkdirSync(nodePath.join(root, '.safeword', 'config.json'), { recursive: true });

    const result = await invoke(root, ['review', 'routes', 'list', '--author', 'claude']);

    expect(result).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_ROUTE_CONFIG_READ_FAILED', retryable: true }],
      data: { command: 'review routes list' },
    });
  });
});
