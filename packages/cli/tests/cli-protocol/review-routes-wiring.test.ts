import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCliProgram } from '../../src/cli-protocol/program.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const directories: string[] = [];

beforeEach(() => {
  const root = createTemporaryDirectory();
  directories.push(root);
  vi.stubEnv('XDG_CONFIG_HOME', nodePath.join(root, 'profile'));
});

const userRoutes = [{ reviewer: 'opencode', model: 'vendor/model' }, { reviewer: 'codex' }];
const projectRoutes = [{ reviewer: 'codex', model: 'custom-model' }, { reviewer: 'opencode' }];
const builtInRoutes = [
  { reviewer: 'codex', independence: 'cross-agent' },
  { reviewer: 'opencode', independence: 'cross-agent' },
  { reviewer: 'claude', independence: 'degraded' },
];

function scopedFixture() {
  const root = createTemporaryDirectory();
  directories.push(root);
  const cwd = nodePath.join(root, 'project');
  mkdirSync(cwd);
  vi.stubEnv('XDG_CONFIG_HOME', nodePath.join(root, 'profile'));
  return {
    cwd,
    user: nodePath.join(root, 'profile', 'safeword', 'config.json'),
    project: nodePath.join(cwd, '.safeword', 'config.json'),
  };
}

function writeConfig(path: string, config: unknown) {
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, typeof config === 'string' ? config : JSON.stringify(config));
}

async function expectEffectiveRoutes(
  cwd: string,
  source: string,
  routes: readonly Record<string, string>[],
) {
  const listed = await invoke(cwd, ['review', 'routes', 'list', '--author', 'claude']);
  expect(listed.state).toBe('healthy');
  const data = listed.data as { source: string; routes: unknown[] };
  expect(data.source).toBe(source);
  expect(data.routes).toEqual(routes);
}

function independent(routes: readonly { reviewer: string; model?: string }[]) {
  return routes.map(route => ({ ...route, independence: 'cross-agent' }));
}

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
  it('lists exact user routes when project routes are absent', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    await expectEffectiveRoutes(fixture.cwd, 'user', independent(userRoutes));
  });

  it('lists exact user routes when project configures another author', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    writeConfig(fixture.project, { crossAgentReviewRoutes: { codex: projectRoutes } });
    await expectEffectiveRoutes(fixture.cwd, 'user', independent(userRoutes));
  });

  it('lists exact user routes when project routes object is empty', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    writeConfig(fixture.project, { crossAgentReviewRoutes: {} });
    await expectEffectiveRoutes(fixture.cwd, 'user', independent(userRoutes));
  });

  it('lists only project routes when both scopes configure the author', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    writeConfig(fixture.project, { crossAgentReviewRoutes: { claude: projectRoutes } });
    await expectEffectiveRoutes(fixture.cwd, 'project', independent(projectRoutes));
  });

  it('lists exact project routes when user routes are absent', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.project, { crossAgentReviewRoutes: { claude: projectRoutes } });
    await expectEffectiveRoutes(fixture.cwd, 'project', independent(projectRoutes));
  });

  it.each(['user', 'project'] as const)(
    'sets only the selected author at %s scope',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      const config = {
        installedPacks: ['typescript'],
        crossAgentReview: 'prefer',
        crossAgentReviewRoutes: { claude: projectRoutes, codex: [{ reviewer: 'claude' }] },
      };
      writeConfig(fixture.user, config);
      writeConfig(fixture.project, config);
      const otherBefore = readFileSync(fixture[other], 'utf8');

      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'set',
        '--scope',
        scope,
        '--author',
        'claude',
        '--route',
        'opencode=vendor/model',
        '--route',
        'codex',
      ]);

      expect(result.state).toBe('changed');
      expect(JSON.parse(readFileSync(fixture[scope], 'utf8'))).toEqual({
        ...config,
        crossAgentReviewRoutes: { ...config.crossAgentReviewRoutes, claude: userRoutes },
      });
      expect(readFileSync(fixture[other], 'utf8')).toBe(otherBefore);
    },
  );

  it.each(['user', 'project'] as const)(
    'resets only the selected author at %s scope',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      const config = {
        installedPacks: ['typescript'],
        crossAgentReview: 'prefer',
        crossAgentReviewRoutes: { claude: userRoutes, codex: [{ reviewer: 'claude' }] },
      };
      writeConfig(fixture.user, config);
      writeConfig(fixture.project, config);
      const otherBefore = readFileSync(fixture[other], 'utf8');

      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'reset',
        '--scope',
        scope,
        '--author',
        'claude',
      ]);

      expect(result.state).toBe('changed');
      expect(JSON.parse(readFileSync(fixture[scope], 'utf8'))).toEqual({
        ...config,
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] },
      });
      expect(readFileSync(fixture[other], 'utf8')).toBe(otherBefore);
    },
  );

  it('does not create a project config when resetting an absent entry', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    const before = readFileSync(fixture.user, 'utf8');
    const result = await invoke(fixture.cwd, [
      'review',
      'routes',
      'reset',
      '--scope',
      'project',
      '--author',
      'claude',
    ]);
    expect(result).toMatchObject({ state: 'healthy', changed: false });
    expect(existsSync(fixture.project)).toBe(false);
    expect(readFileSync(fixture.user, 'utf8')).toBe(before);
    await expectEffectiveRoutes(fixture.cwd, 'user', independent(userRoutes));
  });

  it.each(['user', 'project'] as const)(
    'rejects malformed %s configuration instead of resolving other routes',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      writeConfig(fixture[other], { crossAgentReviewRoutes: { claude: userRoutes } });
      writeConfig(fixture[scope], '{ malformed');
      const result = await invoke(fixture.cwd, ['review', 'routes', 'list', '--author', 'claude']);
      expect(result).toMatchObject({
        state: 'failed',
        errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
        data: { command: 'review routes list' },
      });
      expect((result.errors as { message: string }[])[0]?.message).toContain(fixture[scope]);
      expect(result.data).not.toHaveProperty('routes');
    },
  );

  it.each(['user', 'project'] as const)(
    'refuses to set malformed %s configuration',
    async scope => {
      const fixture = scopedFixture();
      writeConfig(fixture[scope], '{ malformed');
      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'set',
        '--scope',
        scope,
        '--author',
        'claude',
        '--route',
        'codex',
      ]);
      expect(result).toMatchObject({
        state: 'failed',
        errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
      });
      expect((result.errors as { message: string }[])[0]?.message).toContain(fixture[scope]);
      expect(readFileSync(fixture[scope], 'utf8')).toBe('{ malformed');
    },
  );

  it.each(['user', 'project'] as const)(
    'refuses to reset malformed %s configuration',
    async scope => {
      const fixture = scopedFixture();
      writeConfig(fixture[scope], '{ malformed');
      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'reset',
        '--scope',
        scope,
        '--author',
        'claude',
      ]);
      expect(result).toMatchObject({
        state: 'failed',
        errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
      });
      expect((result.errors as { message: string }[])[0]?.message).toContain(fixture[scope]);
      expect(readFileSync(fixture[scope], 'utf8')).toBe('{ malformed');
    },
  );

  it.each(['user', 'project'] as const)(
    'sets %s routes despite malformed non-target configuration',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      writeConfig(fixture[other], '{ malformed');
      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'set',
        '--scope',
        scope,
        '--author',
        'claude',
        '--route',
        'opencode=vendor/model',
        '--route',
        'codex',
      ]);
      expect(result.state).toBe('changed');
      expect(JSON.parse(readFileSync(fixture[scope], 'utf8'))).toEqual({
        crossAgentReviewRoutes: { claude: userRoutes },
      });
      expect(readFileSync(fixture[other], 'utf8')).toBe('{ malformed');
    },
  );

  it.each(['user', 'project'] as const)(
    'resets %s routes despite malformed non-target configuration',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      writeConfig(fixture[other], '{ malformed');
      writeConfig(fixture[scope], { crossAgentReviewRoutes: { claude: userRoutes } });
      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'reset',
        '--scope',
        scope,
        '--author',
        'claude',
      ]);
      expect(result.state).toBe('changed');
      expect(JSON.parse(readFileSync(fixture[scope], 'utf8'))).toEqual({});
      expect(readFileSync(fixture[other], 'utf8')).toBe('{ malformed');
    },
  );

  it.each(['user', 'project'] as const)(
    'rejects an empty %s route list instead of resolving other routes',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      writeConfig(fixture[other], { crossAgentReviewRoutes: { claude: userRoutes } });
      writeConfig(fixture[scope], { crossAgentReviewRoutes: { claude: [] } });
      const result = await invoke(fixture.cwd, ['review', 'routes', 'list', '--author', 'claude']);
      expect(result).toMatchObject({
        state: 'failed',
        errors: [{ code: 'REVIEW_ROUTE_CONFIG_INVALID' }],
      });
      expect((result.errors as { message: string }[])[0]?.message).toContain(fixture[scope]);
      expect(result.data).not.toHaveProperty('routes');
    },
  );

  it('lists the built-in chain when neither scope has routes', async () => {
    const fixture = scopedFixture();
    await expectEffectiveRoutes(fixture.cwd, 'built-in', builtInRoutes);
  });

  it('reveals the built-in chain after resetting the only user routes', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    const result = await invoke(fixture.cwd, ['review', 'routes', 'reset', '--author', 'claude']);
    expect(result.state).toBe('changed');
    await expectEffectiveRoutes(fixture.cwd, 'built-in', builtInRoutes);
  });

  it('reveals the exact user chain after resetting project routes', async () => {
    const fixture = scopedFixture();
    writeConfig(fixture.user, { crossAgentReviewRoutes: { claude: userRoutes } });
    writeConfig(fixture.project, { crossAgentReviewRoutes: { claude: projectRoutes } });
    const result = await invoke(fixture.cwd, [
      'review',
      'routes',
      'reset',
      '--scope',
      'project',
      '--author',
      'claude',
    ]);
    expect(result.state).toBe('changed');
    await expectEffectiveRoutes(fixture.cwd, 'user', independent(userRoutes));
  });

  it.each(['user', 'project'] as const)(
    'creates only the selected config on first %s write',
    async scope => {
      const fixture = scopedFixture();
      const other = scope === 'user' ? 'project' : 'user';
      const result = await invoke(fixture.cwd, [
        'review',
        'routes',
        'set',
        '--scope',
        scope,
        '--author',
        'claude',
        '--route',
        'opencode=vendor/model',
        '--route',
        'codex',
      ]);
      expect(result.state).toBe('changed');
      expect(JSON.parse(readFileSync(fixture[scope], 'utf8'))).toEqual({
        crossAgentReviewRoutes: { claude: userRoutes },
      });
      expect(existsSync(fixture[other])).toBe(false);
      expect(readdirSync(fixture.cwd)).toEqual(scope === 'user' ? [] : ['.safeword']);
      expect(readdirSync(nodePath.dirname(fixture[scope]))).toEqual(['config.json']);
    },
  );

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
