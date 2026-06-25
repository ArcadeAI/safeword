import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  decideGitHooksWiring,
  dependencyInputFingerprint,
  detectDependencyPlan,
  formatDependencyRecovery,
  getDependencyReadiness,
  isDependencyBackedCommand,
  isDependencyInstallCommand,
  readDependencyBootstrapConfig,
  shouldBootstrapDependencies,
  writeInstallMarker,
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
const POST_TOOL_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/post-tool-dependency-readiness.ts',
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
    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'bun.lock',
      'package.json',
      'packages/cli/package.json',
    ]);
  });

  it('abstains (unsupported) for a pnpm workspace with a coexisting bun lockfile (#321)', () => {
    writeJson('package.json', {
      name: 'pnpm-workspace-project',
      packageManager: 'pnpm@9.0.0',
      workspaces: ['packages/*'],
    });
    writeTestFile(projectDirectory, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    // A stray/legacy bun lockfile must not flip this pnpm workspace to `bun ci`.
    writeTestFile(projectDirectory, 'bun.lock', '# stray bun lockfile');

    expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
    expect(getDependencyReadiness(projectDirectory).status).toBe('unsupported');
  });

  it('abstains when packageManager declares a non-bun manager despite a coexisting bun lockfile (#321)', () => {
    writeJson('package.json', {
      name: 'declared-pnpm-project',
      packageManager: 'pnpm@9.0.0',
    });
    writeTestFile(projectDirectory, 'bun.lock', '# stray bun lockfile');

    expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
    expect(getDependencyReadiness(projectDirectory).status).toBe('unsupported');
  });

  it('detects a pnpm workspace and plans a frozen pnpm install (#323)', () => {
    writeJson('package.json', { name: 'pnpm-project', packageManager: 'pnpm@9.0.0' });
    writeTestFile(projectDirectory, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");

    const plan = detectDependencyPlan(projectDirectory);

    expect(plan).toMatchObject({
      manager: 'pnpm',
      installCommand: {
        binary: 'pnpm',
        args: ['install', '--frozen-lockfile'],
        display: 'pnpm install --frozen-lockfile',
      },
      installArtifact: 'node_modules',
    });
    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
    ]);
  });

  it('prefers pnpm over a coexisting bun lockfile when the project signals pnpm (#323)', () => {
    writeJson('package.json', { name: 'mixed', packageManager: 'pnpm@9.0.0' });
    writeTestFile(projectDirectory, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    writeTestFile(projectDirectory, 'bun.lock', '# stray bun lockfile');

    expect(detectDependencyPlan(projectDirectory)?.manager).toBe('pnpm');
  });

  it('treats pnpm-lock.yaml alone (no bun lockfile) as pnpm (#323)', () => {
    writeJson('package.json', { name: 'pnpm-single' });
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");

    expect(detectDependencyPlan(projectDirectory)?.manager).toBe('pnpm');
  });

  it('keeps bun precedence when bun.lock coexists with pnpm-lock.yaml and no pnpm signal (#323)', () => {
    writeJson('package.json', { name: 'ambiguous' });
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    writeTestFile(projectDirectory, 'bun.lock', '# bun lockfile');

    expect(detectDependencyPlan(projectDirectory)?.manager).toBe('bun');
  });

  it('reports missing then ready for a pnpm project (#323)', () => {
    writeJson('package.json', { name: 'pnpm-project', packageManager: 'pnpm@9.0.0' });
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");

    const missing = getDependencyReadiness(projectDirectory);
    expect(missing.status).toBe('missing');
    expect(missing.installCommand).toBe('pnpm install --frozen-lockfile');

    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
  });

  it('detects an npm project and plans npm ci (#327)', () => {
    writeJson('package.json', { name: 'npm-project', packageManager: 'npm@10.0.0' });
    writeTestFile(projectDirectory, 'package-lock.json', '{}');

    const plan = detectDependencyPlan(projectDirectory);
    expect(plan).toMatchObject({
      manager: 'npm',
      installCommand: { binary: 'npm', args: ['ci'], display: 'npm ci' },
    });
    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'package-lock.json',
      'package.json',
    ]);
  });

  it('treats package-lock.json alone as npm (#327)', () => {
    writeJson('package.json', { name: 'npm-single' });
    writeTestFile(projectDirectory, 'package-lock.json', '{}');

    expect(detectDependencyPlan(projectDirectory)?.manager).toBe('npm');
  });

  it('stays unsupported when npm is declared but no package-lock.json exists (#327)', () => {
    writeJson('package.json', { name: 'npm-no-lock', packageManager: 'npm@10.0.0' });
    writeTestFile(projectDirectory, 'bun.lock', '# stray bun lockfile');

    expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
  });

  it('plans a frozen-lockfile install for yarn classic (#327)', () => {
    writeJson('package.json', { name: 'yarn-classic', packageManager: 'yarn@1.22.22' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');

    expect(detectDependencyPlan(projectDirectory)?.installCommand.display).toBe(
      'yarn install --frozen-lockfile',
    );
  });

  it('plans an immutable install for yarn berry (#327)', () => {
    writeJson('package.json', { name: 'yarn-berry', packageManager: 'yarn@4.3.1' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');

    expect(detectDependencyPlan(projectDirectory)?.installCommand.display).toBe(
      'yarn install --immutable',
    );
  });

  it('detects yarn berry from .yarnrc.yml when no packageManager is declared (#327)', () => {
    writeJson('package.json', { name: 'yarn-berry-rc' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');
    writeTestFile(projectDirectory, '.yarnrc.yml', 'nodeLinker: node-modules\n');

    const plan = detectDependencyPlan(projectDirectory);
    expect(plan?.manager).toBe('yarn');
    expect(plan?.installCommand.display).toBe('yarn install --immutable');
  });

  it('tracks pnpm workspace package manifests globbed from pnpm-workspace.yaml (#327)', () => {
    writeJson('package.json', { name: 'pnpm-ws', packageManager: 'pnpm@9.0.0' });
    writeTestFile(projectDirectory, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    writeJson('packages/cli/package.json', { name: '@ws/cli' });
    writeJson('packages/core/package.json', { name: '@ws/core' });

    const plan = detectDependencyPlan(projectDirectory);
    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'package.json',
      'packages/cli/package.json',
      'packages/core/package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
    ]);
  });

  it('tracks package manifests matched by recursive workspace globs', () => {
    writeJson('package.json', {
      name: 'recursive-workspace-project',
      packageManager: 'bun@1.3.14',
      workspaces: ['packages/**'],
    });
    writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
    writeJson('packages/cli/package.json', {
      name: '@test/cli',
    });
    writeJson('packages/features/plugin/package.json', {
      name: '@test/plugin',
    });

    const plan = detectDependencyPlan(projectDirectory);

    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'bun.lock',
      'package.json',
      'packages/cli/package.json',
      'packages/features/plugin/package.json',
    ]);
  });

  it('excludes package manifests matched by negative workspace globs', () => {
    writeJson('package.json', {
      name: 'excluded-workspace-project',
      packageManager: 'bun@1.3.14',
      workspaces: ['packages/**', '!packages/**/test/**'],
    });
    writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
    writeJson('packages/app/package.json', {
      name: '@test/app',
    });
    writeJson('packages/app/test/fixture/package.json', {
      name: '@test/fixture',
    });
    writeJson('packages/plugins/auth/package.json', {
      name: '@test/auth-plugin',
    });

    const plan = detectDependencyPlan(projectDirectory);

    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'bun.lock',
      'package.json',
      'packages/app/package.json',
      'packages/plugins/auth/package.json',
    ]);
  });

  it('over-tracks package manifests for unsupported advanced workspace globs', () => {
    writeJson('package.json', {
      name: 'advanced-workspace-project',
      packageManager: 'bun@1.3.14',
      workspaces: ['packages/{app,plugins/*}', '!packages/[a]*/test/**'],
    });
    writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
    writeJson('packages/app/package.json', {
      name: '@test/app',
    });
    writeJson('packages/app/test/fixture/package.json', {
      name: '@test/fixture',
    });
    writeJson('packages/plugins/auth/package.json', {
      name: '@test/auth-plugin',
    });
    writeJson('examples/tool/package.json', {
      name: '@test/example-tool',
    });

    const plan = detectDependencyPlan(projectDirectory);

    expect(plan?.inputPaths.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'bun.lock',
      'package.json',
      'packages/app/package.json',
      'packages/app/test/fixture/package.json',
      'packages/plugins/auth/package.json',
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

  it('stays ready after a content-preserving op bumps input mtimes past the artifact', () => {
    writeBunProject();
    const artifact = path.join(projectDirectory, 'node_modules');
    mkdirSync(artifact);

    // A hook stamps the marker once dependencies resolve ready.
    const ready = getDependencyReadiness(projectDirectory);
    expect(ready.status).toBe('ready');
    writeInstallMarker(projectDirectory, ready);

    // Simulate a rebase/checkout: input mtimes jump forward while content is
    // unchanged, and a no-op `bun ci` never touches the artifact.
    const future = new Date(Date.now() + 60_000);
    for (const input of ['package.json', 'bun.lock', 'packages/cli/package.json']) {
      utimesSync(path.join(projectDirectory, input), future, future);
    }

    expect(getDependencyReadiness(projectDirectory)).toMatchObject({
      status: 'ready',
      reason: 'install_artifact_current',
    });

    // Without the marker the mtime fallback would (incorrectly) flag stale —
    // proving the marker is what keeps the worktree usable after a rebase.
    rmSync(path.join(artifact, '.safeword-deps-fingerprint'));
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
  });

  it('reports stale when tracked input content changes, then ready once re-stamped', () => {
    writeBunProject();
    const artifact = path.join(projectDirectory, 'node_modules');
    mkdirSync(artifact);
    writeInstallMarker(projectDirectory, getDependencyReadiness(projectDirectory));

    // A genuine dependency-spec change: content differs from the marker, and the
    // artifact has not been reinstalled yet (mtime behind the changed input).
    writeTestFile(projectDirectory, 'bun.lock', '# changed lockfile');
    const past = new Date(Date.now() - 60_000);
    utimesSync(artifact, past, past);

    expect(getDependencyReadiness(projectDirectory)).toMatchObject({
      status: 'stale',
      reason: 'install_artifact_stale',
    });

    // Reinstall bumps the artifact mtime (bun repoints symlinks); the mtime
    // fallback then resolves ready and the hook re-stamps the new fingerprint.
    const future = new Date(Date.now() + 60_000);
    utimesSync(artifact, future, future);
    const reinstalled = getDependencyReadiness(projectDirectory);
    expect(reinstalled.status).toBe('ready');
    writeInstallMarker(projectDirectory, reinstalled);

    // A later rebase pushes the artifact mtime behind again, but the refreshed
    // marker still matches the current content, so it stays ready.
    utimesSync(artifact, past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
  });

  it('stale recovery documents the no-op escape so the gate cannot loop', () => {
    writeBunProject();
    const artifact = path.join(projectDirectory, 'node_modules');
    mkdirSync(artifact);
    writeInstallMarker(projectDirectory, getDependencyReadiness(projectDirectory));

    // Version-bump-style change: tracked content differs from the marker while
    // the artifact mtime sits behind it — exactly the case a no-op `bun ci`
    // cannot heal (it reports "no changes" and never re-stamps the marker).
    writeTestFile(projectDirectory, 'bun.lock', '# changed lockfile');
    const past = new Date(Date.now() - 60_000);
    utimesSync(artifact, past, past);

    const stale = getDependencyReadiness(projectDirectory);
    expect(stale.status).toBe('stale');

    const recovery = formatDependencyRecovery(stale);
    expect(recovery).toContain('bun ci');
    expect(recovery).toContain('reports no changes');
    expect(recovery).toContain('touch node_modules');
  });

  it('missing recovery installs for real, so it omits the touch escape', () => {
    writeBunProject();

    const missing = getDependencyReadiness(projectDirectory);
    expect(missing.status).toBe('missing');

    const recovery = formatDependencyRecovery(missing);
    expect(recovery).toContain('bun ci');
    expect(recovery).not.toContain('touch node_modules');
  });

  it('bootstraps a missing install artifact even when auto-install is off (JNVP4W)', () => {
    // The fix: a fresh worktree (no node_modules) installs unconditionally, so a
    // commit never bypasses the husky guard chain — even with autoInstall off.
    expect(shouldBootstrapDependencies('missing', false)).toBe(true);
    expect(shouldBootstrapDependencies('missing', true)).toBe(true);
  });

  it('leaves the stale re-install behind the auto-install opt-in', () => {
    expect(shouldBootstrapDependencies('stale', false)).toBe(false);
    expect(shouldBootstrapDependencies('stale', true)).toBe(true);
  });

  it('never bootstraps a ready or unsupported worktree', () => {
    expect(shouldBootstrapDependencies('ready', true)).toBe(false);
    expect(shouldBootstrapDependencies('unsupported', true)).toBe(false);
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
    ['bun --cwd packages/cli test'],
    ['bun --cwd packages/cli run test'],
    ['env FOO=1 bun run test'],
    ['/usr/bin/env FOO=1 bun test'],
    ['bunx vitest run'],
    ['npx vitest run'],
    ['npm exec -- vitest run'],
    ['vitest run'],
    ['./node_modules/.bin/vitest run'],
    ['tsc --noEmit'],
    ['eslint .'],
    ['npm test'],
    ['npm --prefix packages/cli test'],
    ['pnpm run build'],
    ['pnpm --dir packages/cli test'],
    ['pnpm exec vitest run'],
    ['pnpm vitest run'],
    ['corepack pnpm test'],
    ['yarn test'],
    ['yarn --cwd packages/cli test'],
    ['yarn vitest run'],
  ])('treats dependency-backed command "%s" as guarded', command => {
    expect(isDependencyBackedCommand(command)).toBe(true);
  });

  it.each([
    ['git status'],
    ['ls packages/cli'],
    ['pwd'],
    ['echo "x; bun test"'],
    ['bun ci'],
    ['env FOO=1 bun ci'],
    ['bun install --frozen-lockfile'],
    ['npm ci'],
    ['pnpm install --frozen-lockfile'],
    ['corepack pnpm install --frozen-lockfile'],
    ['yarn install --immutable'],
    ['npx cowsay hello'],
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

  it('session hook auto-installs a missing worktree (JNVP4W), degrading if the install fails', () => {
    writeBunProject();
    markSafewordProject();

    // node_modules absent → the hook bootstraps (`bun ci`) regardless of the
    // autoInstall opt-in. The fixture's lockfile is a stub, so the install
    // fails — exercising the degrade: exit 0, a 'failed' state, never a wedge.
    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('bun ci');

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state.status).toBe('failed');
    expect(state.installCommand).toBe('bun ci');
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

  it('session hook stamps the install marker when dependencies are ready', () => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'));

    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const plan = detectDependencyPlan(projectDirectory);
    if (plan === undefined) throw new Error('expected Bun dependency plan');
    expect(readTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint')).toBe(
      dependencyInputFingerprint(projectDirectory, plan),
    );
  });

  it('does not stamp a marker for unsupported projects', () => {
    // No package.json/lockfile → unsupported readiness carries no plan or
    // fingerprint. writeInstallMarker must no-op rather than crash, since the
    // pre-tool hook calls it on the unsupported branch.
    const readiness = getDependencyReadiness(projectDirectory);
    expect(readiness.status).toBe('unsupported');

    expect(() => {
      writeInstallMarker(projectDirectory, readiness);
    }).not.toThrow();
    expect(
      existsSync(path.join(projectDirectory, 'node_modules', '.safeword-deps-fingerprint')),
    ).toBe(false);
  });

  describe('git hooks wiring (#364)', () => {
    it('wires committed hooks when core.hooksPath is unset', () => {
      expect(
        decideGitHooksWiring({
          committedHookExists: true,
          currentHooksPath: '',
          currentHooksPathActive: false,
        }),
      ).toEqual({ action: 'wire', hooksPath: '.husky' });
    });

    it('wires when core.hooksPath is husky-managed but not yet populated', () => {
      // Fresh clone: .husky/_ is configured but husky never ran to fill it.
      expect(
        decideGitHooksWiring({
          committedHookExists: true,
          currentHooksPath: '.husky/_',
          currentHooksPathActive: false,
        }),
      ).toEqual({ action: 'wire', hooksPath: '.husky' });
    });

    it('leaves an already-active hooks path alone', () => {
      expect(
        decideGitHooksWiring({
          committedHookExists: true,
          currentHooksPath: '.husky/_',
          currentHooksPathActive: true,
        }),
      ).toEqual({ action: 'none' });
    });

    it('never clobbers a deliberate custom core.hooksPath without a pre-commit', () => {
      expect(
        decideGitHooksWiring({
          committedHookExists: true,
          currentHooksPath: '.myhooks',
          currentHooksPathActive: false,
        }),
      ).toEqual({ action: 'none' });
    });

    it('does nothing when no committed hook exists', () => {
      expect(
        decideGitHooksWiring({
          committedHookExists: false,
          currentHooksPath: '',
          currentHooksPathActive: false,
        }),
      ).toEqual({ action: 'none' });
    });

    it('the SessionStart hook activates the committed guard on a fresh worktree', () => {
      // Fresh clone: committed .husky/pre-commit present, but git never ran husky's
      // prepare, so core.hooksPath is unset and the guard chain is silently inactive.
      expect(spawnSync('git', ['init'], { cwd: projectDirectory }).status).toBe(0);
      mkdirSync(path.join(projectDirectory, '.safeword'), { recursive: true });
      mkdirSync(path.join(projectDirectory, '.husky'), { recursive: true });
      writeTestFile(projectDirectory, '.husky/pre-commit', '#!/bin/sh\nexit 1\n');
      expect(
        spawnSync('git', ['config', '--get', 'core.hooksPath'], {
          cwd: projectDirectory,
          encoding: 'utf8',
        }).stdout.trim(),
      ).toBe('');

      const result = runHook(SESSION_HOOK);
      expect(result.status).toBe(0);

      expect(
        spawnSync('git', ['config', '--get', 'core.hooksPath'], {
          cwd: projectDirectory,
          encoding: 'utf8',
        }).stdout.trim(),
      ).toBe('.husky');
    });
  });

  describe('post-install fingerprint stamping (#380)', () => {
    const MARKER = 'node_modules/.safeword-deps-fingerprint';

    function postInput(command: string, result: Record<string, unknown>): string {
      return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, tool_response: result });
    }

    /** Recreate the #380 bug state: deps changed, install was a no-op that left
     *  node_modules mtime stale, and the marker still holds an old fingerprint. */
    function makeStaleAfterNoopInstall(): string {
      writeBunProject();
      mkdirSync(path.join(projectDirectory, '.safeword'), { recursive: true });
      mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
      writeTestFile(projectDirectory, MARKER, 'old-fingerprint');
      const past = new Date(Date.now() - 60_000);
      utimesSync(path.join(projectDirectory, 'node_modules'), past, past);

      expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
      const plan = detectDependencyPlan(projectDirectory);
      if (plan === undefined) throw new Error('expected a dependency plan for the bun fixture');
      return dependencyInputFingerprint(projectDirectory, plan);
    }

    it('detects install commands', () => {
      for (const command of [
        'bun ci',
        'bun install',
        'pnpm install --frozen-lockfile',
        'npm ci',
        'yarn',
        'corepack pnpm install',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(true);
      }
    });

    it('ignores non-install commands', () => {
      for (const command of ['bun run test', 'eslint .', 'git commit -m x', 'pnpm add zod']) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('stamps the current fingerprint after a successful no-op install (clears the block)', () => {
      const fingerprint = makeStaleAfterNoopInstall();

      const result = runHook(POST_TOOL_HOOK, postInput('bun ci', { exit_code: 0, success: true }));
      expect(result.status).toBe(0);

      expect(readTestFile(projectDirectory, MARKER)).toBe(fingerprint);
      expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
    });

    it('does NOT stamp when the install command failed (no false ready)', () => {
      makeStaleAfterNoopInstall();

      runHook(POST_TOOL_HOOK, postInput('bun ci', { exit_code: 1, success: false }));

      expect(readTestFile(projectDirectory, MARKER)).toBe('old-fingerprint');
      expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
    });

    it('does nothing for a non-install command', () => {
      makeStaleAfterNoopInstall();

      runHook(POST_TOOL_HOOK, postInput('bun run test', { exit_code: 0, success: true }));

      expect(readTestFile(projectDirectory, MARKER)).toBe('old-fingerprint');
      expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
    });
  });
});
