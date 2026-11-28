import * as childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { codexWorkflowTemporaryBase } from '../helpers/codex-internal-workflows.js';
import { initializeWorkflowGit } from '../helpers/codex-workflow-git.js';
import { CodexWorkflowRuntimeActor } from '../helpers/codex-workflow-runtime.js';

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof childProcess>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});
const actual = await vi.importActual<typeof childProcess>('node:child_process');
const roots: string[] = [];
const temporary = () => {
  const prefix = path.join(codexWorkflowTemporaryBase(), 'codex-guard-git-control-');
  const root = realpathSync(mkdtempSync(prefix));
  roots.push(root);
  return root;
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(childProcess.spawnSync).mockImplementation(actual.spawnSync);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const git = (cwd: string, ...args: string[]) => {
  const result = childProcess.spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
};

it('establishes a real project HEAD before the first native subprocess, without changing author assets', async () => {
  const root = temporary();
  const profile = path.join(root, 'profile');
  const installedPath = path.join(profile, 'plugins/cache/control/plugin/1');
  mkdirSync(path.join(installedPath, 'runtime'), { recursive: true });
  mkdirSync(path.join(installedPath, '.codex-plugin'));
  const files = {
    'runtime/cli.js': 'unit author runtime, never executed',
    'hooks.json': '{"hooks":{}}',
    '.codex-plugin/plugin.json': '{}',
  };
  for (const [file, body] of Object.entries(files))
    writeFileSync(path.join(installedPath, file), body);
  const hash = (file: string) =>
    createHash('sha256')
      .update(readFileSync(path.join(installedPath, file)))
      .digest('hex');
  const authorConfig =
    '# Unit author config; empty unit state, never trusted or executed\n[hooks.state]\n';
  writeFileSync(path.join(profile, 'config.toml'), authorConfig);
  writeFileSync(path.join(profile, 'auth.json'), '{}');
  const fixture = path.join(root, 'fixture.json');
  const identity = path.join(root, 'identity.json');
  const binary = path.join(root, 'native-process-boundary');
  writeFileSync(
    fixture,
    JSON.stringify({
      root,
      profile,
      installedPath,
      binary,
      hookManifestSha256: hash('hooks.json'),
      packageManifestSha256: hash('.codex-plugin/plugin.json'),
    }),
  );
  writeFileSync(
    identity,
    JSON.stringify({ runtimeSha256: hash('runtime/cli.js'), originalManifest: hash('hooks.json') }),
  );
  const actor = new CodexWorkflowRuntimeActor(fixture, identity);
  const source = (actor as unknown as { source: string }).source;
  roots.push(path.dirname(source));
  const project = path.join(actor.artifacts, 'project');
  const before = Object.fromEntries(Object.keys(files).map(file => [file, hash(file)]));
  const spawn = actual.spawnSync;
  let reached = false;
  vi.mocked(childProcess.spawnSync).mockImplementation((...args: Parameters<typeof spawn>) => {
    if (args[0] !== binary) return spawn(...args);
    expect(git(project, 'rev-parse', '--show-toplevel')).toBe(project);
    expect(git(project, 'branch', '--show-current')).toBe('codex/fixture');
    expect(git(project, 'cat-file', '-t', 'HEAD')).toBe('commit');
    expect(git(project, 'show', 'HEAD:clamp.js')).toContain('export function clamp');
    reached = true;
    throw new Error('UNIT_NATIVE_BOUNDARY_STOP');
  });
  await expect(actor.prepareCanonical()).rejects.toThrow('UNIT_NATIVE_BOUNDARY_STOP');
  expect(reached).toBe(true);
  expect(Object.fromEntries(Object.keys(files).map(file => [file, hash(file)]))).toEqual(before);
  expect(readFileSync(path.join(profile, 'config.toml'), 'utf8')).toBe(authorConfig);
  expect(readFileSync(path.join(profile, 'auth.json'), 'utf8')).toBe('{}');
});

function seededProject() {
  const artifacts = temporary();
  const project = path.join(artifacts, 'project');
  mkdirSync(path.join(project, '.safeword'), { recursive: true });
  for (const file of ['.safeword/SAFEWORD.md', '.safeword/config.json', 'package.json', 'clamp.js'])
    writeFileSync(path.join(project, file), `Unit baseline: ${file}\n`);
  return { artifacts, project };
}

it('cannot redirect fixture Git through inherited repository/config selectors or persist fixture identity', () => {
  const other = seededProject();
  initializeWorkflowGit(other.project, other.artifacts);
  const inventory = () =>
    Object.fromEntries(
      readdirSync(other.project, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => {
          const file = path.join(entry.parentPath, entry.name);
          return [
            path.relative(other.project, file),
            createHash('sha256').update(readFileSync(file)).digest('hex'),
          ];
        }),
    );
  const before = inventory();
  const globalConfig = path.join(other.artifacts, 'global-config');
  const config =
    '[user]\nname = Unrelated\n[commit]\ngpgsign = true\n[core]\nhooksPath = /must-not-run\n';
  writeFileSync(globalConfig, config);
  const inherited = {
    GIT_DIR: path.join(other.project, '.git'),
    GIT_WORK_TREE: other.project,
    GIT_INDEX_FILE: path.join(other.artifacts, 'redirected-index'),
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/must-not-run',
    GIT_TEMPLATE_DIR: '/must-not-use',
  };
  for (const [key, value] of Object.entries(inherited)) vi.stubEnv(key, value);
  const own = seededProject();
  initializeWorkflowGit(own.project, own.artifacts);
  expect(git(own.project, 'rev-parse', '--show-toplevel')).toBe(own.project);
  expect(git(own.project, 'branch', '--show-current')).toBe('codex/fixture');
  expect(git(own.project, 'cat-file', '-t', 'HEAD')).toBe('commit');
  expect(git(own.project, 'show', 'HEAD:clamp.js')).toBe('Unit baseline: clamp.js');
  expect(git(own.project, 'remote')).toBe('');
  const local = readFileSync(path.join(own.project, '.git/config'), 'utf8');
  expect(local).not.toMatch(/user|gpgsign|hooksPath/iu);
  expect(inventory()).toEqual(before);
  expect(readFileSync(globalConfig, 'utf8')).toBe(config);
});

it('checks real repository readiness before resume, permits dirty state, and stops wrong branch or missing HEAD before dispatch', () => {
  const { project, artifacts } = seededProject();
  initializeWorkflowGit(project, artifacts);
  writeFileSync(path.join(project, 'clamp.js'), 'dirty A task changes\n');
  const unit = {
    project,
    artifacts,
    profile: path.join(artifacts, 'profile'),
    markers: {},
    sequence: 0,
    fixture: { binary: 'unit-native-transport' },
    turn: { allEntries: [], thread: 'unit-thread-not-a-receipt' },
    command(program: string, args: string[]) {
      if (program === '/bin/zsh') {
        expect(args[0]).toBe('-lc');
        expect(args[1]).toContain('zmodload zsh/parameter');
        return '5.9\ncd\nif\n';
      }
      expect(program).toBe('unit-native-transport');
      expect(args).toContain('resume');
      expect(args).toContain('unit-thread-not-a-receipt');
      throw new Error('UNIT_NATIVE_BOUNDARY_STOP');
    },
  } as unknown as CodexWorkflowRuntimeActor;
  expect(() =>
    CodexWorkflowRuntimeActor.prototype.run.call(unit, 'Unchanged unit request', true),
  ).toThrow('UNIT_NATIVE_BOUNDARY_STOP');
  expect(readFileSync(path.join(project, 'clamp.js'), 'utf8')).toBe('dirty A task changes\n');
  git(project, 'checkout', '-qb', 'wrong-branch');
  expect(() =>
    CodexWorkflowRuntimeActor.prototype.run.call(unit, 'Unchanged unit request', true),
  ).toThrow('fixture Git branch');
  git(project, 'checkout', 'codex/fixture');
  git(project, 'checkout', '--detach');
  expect(() =>
    CodexWorkflowRuntimeActor.prototype.run.call(unit, 'Unchanged unit request', true),
  ).toThrow('fixture Git branch');
  git(project, 'checkout', 'codex/fixture');
  const nested = path.join(project, 'nested');
  mkdirSync(nested);
  Object.assign(unit, { project: nested });
  expect(() =>
    CodexWorkflowRuntimeActor.prototype.run.call(unit, 'Unchanged unit request', true),
  ).toThrow('fixture Git root');
  Object.assign(unit, { project });
  git(project, 'update-ref', '-d', 'refs/heads/codex/fixture');
  expect(() =>
    CodexWorkflowRuntimeActor.prototype.run.call(unit, 'Unchanged unit request', true),
  ).toThrow('fixture Git rev-parse');
  const observation = JSON.parse(
    readFileSync(path.join(artifacts, 'project-git-before-turn-2.json'), 'utf8'),
  );
  expect(observation.commands.at(-1).status).not.toBe(0);
  expect(observation.commands.at(-1).args).toEqual(['rev-parse', '--verify', 'HEAD^{commit}']);
  expect(observation.gitEnvironment).toEqual({
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  });
});
