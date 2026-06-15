import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  dependencyInputFingerprint,
  detectDependencyPlan,
  getDependencyReadiness,
  isDependencyBackedCommand,
  readDependencyBootstrapConfig,
} from '../../templates/hooks/lib/dependency-readiness.js';
import {
  createTemporaryDirectory,
  readTestFile,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers.js';

const SESSION_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/session-dependency-readiness.ts',
);
const PRE_TOOL_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/pre-tool-dependency-readiness.ts',
);

describe('dependency readiness hook support', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  function writeJson(relativePath: string, value: unknown): void {
    writeTestFile(projectDirectory, relativePath, JSON.stringify(value, undefined, 2));
  }

  function writeBunProject(): void {
    writeJson('package.json', {
      name: 'test-project',
      packageManager: 'bun@1.3.2',
      workspaces: ['packages/*'],
    });
    writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
    writeJson('packages/cli/package.json', {
      name: '@test/cli',
      scripts: { test: 'vitest' },
    });
  }

  function writeMinimalBunProject(): void {
    writeJson('package.json', {
      name: 'auto-install-project',
      packageManager: 'bun@1.3.12',
      workspaces: ['packages/*'],
      dependencies: {
        'local-pkg': 'workspace:*',
      },
    });
    writeJson('packages/local/package.json', {
      name: 'local-pkg',
      version: '1.0.0',
    });
  }

  function markSafewordProject(): void {
    mkdirSync(path.join(projectDirectory, '.safeword'), { recursive: true });
  }

  function runHook(scriptPath: string, input?: string): SpawnSyncReturns<string> {
    return spawnSync('bun', [scriptPath], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
      },
      input,
      encoding: 'utf8',
    });
  }

  function writeGeneratedBunLock(): void {
    const result = spawnSync('bun', ['install', '--lockfile-only'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    rmSync(path.join(projectDirectory, 'node_modules'), { recursive: true, force: true });
  }

  it('detects Bun projects and tracks lockfile plus workspace manifests', () => {
    writeBunProject();

    const plan = detectDependencyPlan(projectDirectory);

    expect(plan).toMatchObject({
      manager: 'bun',
      installCommand: {
        binary: 'bun',
        args: ['ci'],
        display: 'bun ci',
      },
      installArtifact: 'node_modules',
    });
    expect(plan?.inputPaths.toSorted()).toEqual([
      'bun.lock',
      'package.json',
      'packages/cli/package.json',
    ]);
  });

  it('changes the dependency fingerprint when tracked inputs change', () => {
    writeBunProject();
    const plan = detectDependencyPlan(projectDirectory);
    expect(plan).toBeDefined();
    if (plan === undefined) throw new Error('expected Bun dependency plan');

    const before = dependencyInputFingerprint(projectDirectory, plan);
    writeTestFile(projectDirectory, 'bun.lock', '# changed lockfile');
    const after = dependencyInputFingerprint(projectDirectory, plan);

    expect(after).not.toEqual(before);
  });

  it('reports missing dependencies before install artifacts exist', () => {
    writeBunProject();

    const readiness = getDependencyReadiness(projectDirectory);

    expect(readiness).toMatchObject({
      status: 'missing',
      installCommand: 'bun ci',
      reason: 'install_artifact_missing',
    });
  });

  it('reports ready dependencies when install artifacts exist', () => {
    writeBunProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'));

    const readiness = getDependencyReadiness(projectDirectory);

    expect(readiness).toMatchObject({
      status: 'ready',
      installCommand: 'bun ci',
    });
  });

  it('reads explicit auto-install opt-in from safeword config', () => {
    writeBunProject();

    expect(readDependencyBootstrapConfig(projectDirectory)).toEqual({
      autoInstall: false,
    });

    writeJson('.safeword/config.json', {
      dependencyBootstrap: {
        autoInstall: true,
      },
    });

    expect(readDependencyBootstrapConfig(projectDirectory)).toEqual({
      autoInstall: true,
    });
  });

  it.each([
    ['bun run test'],
    ['bun test'],
    ['bunx vitest run'],
    ['vitest run'],
    ['./node_modules/.bin/vitest run'],
    ['tsc --noEmit'],
    ['eslint .'],
    ['npm test'],
    ['pnpm run build'],
    ['yarn test'],
  ])('treats dependency-backed command "%s" as guarded', command => {
    expect(isDependencyBackedCommand(command)).toBe(true);
  });

  it.each([
    ['git status'],
    ['ls packages/cli'],
    ['pwd'],
    ['bun ci'],
    ['bun install --frozen-lockfile'],
    ['npm ci'],
    ['pnpm install --frozen-lockfile'],
    ['yarn install --immutable'],
  ])('does not guard non-runtime or install command "%s"', command => {
    expect(isDependencyBackedCommand(command)).toBe(false);
  });

  it('ignores malformed safeword config instead of crashing hooks', () => {
    writeBunProject();
    mkdirSync(path.join(projectDirectory, '.safeword'));
    writeFileSync(path.join(projectDirectory, '.safeword/config.json'), '{ nope');

    expect(readDependencyBootstrapConfig(projectDirectory)).toEqual({
      autoInstall: false,
    });
  });

  it('session hook reports missing dependencies and writes readiness state', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput).toMatchObject({
      hookEventName: 'SessionStart',
    });
    expect(output.hookSpecificOutput.additionalContext).toContain('bun ci');

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state).toMatchObject({
      status: 'missing',
      installCommand: 'bun ci',
    });
  });

  it('session hook bootstraps dependencies when auto-install is explicitly enabled', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();
    writeJson('.safeword/config.json', {
      dependencyBootstrap: {
        autoInstall: true,
      },
    });

    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('bootstrapped');
    expect(existsSync(path.join(projectDirectory, 'node_modules'))).toBe(true);

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state).toMatchObject({
      status: 'ready',
      installCommand: 'bun ci',
    });
  });

  it('session hook records auto-install failures without silently rewriting dependencies', () => {
    writeBunProject();
    markSafewordProject();
    writeJson('.safeword/config.json', {
      dependencyBootstrap: {
        autoInstall: true,
      },
    });

    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.additionalContext).toContain('dependency bootstrap failed');

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state).toMatchObject({
      status: 'failed',
      installCommand: 'bun ci',
    });
  });

  it('pre-tool hook blocks dependency-backed Bash commands when dependencies are missing', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'bun run test',
        },
      }),
    );

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput).toMatchObject({
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
    });
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain('bun ci');
  });

  it('pre-tool hook allows unrelated Bash commands without output', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'git status',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
