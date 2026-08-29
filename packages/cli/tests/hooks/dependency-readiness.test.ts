import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { parse } from 'smol-toml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  bootstrapDependencies,
  decideGitHooksWiring,
  dependencyInputFingerprint,
  detectDependencyPlan,
  formatDependencyRecovery,
  getDependencyReadiness,
  isDependencyBackedCommand,
  isDependencyInstallCommand,
  isDependencyReadinessRecoveryCommand,
  readDependencyBootstrapConfig,
  readDependencyReadinessState,
  shouldBootstrapDependencies,
  writeDependencyReadinessState,
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
const DEPENDENCY_BOOTSTRAP_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/dependency-bootstrap.ts',
);
const PRE_TOOL_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/pre-tool-dependency-readiness.ts',
);
const POST_TOOL_HOOK = path.resolve(
  import.meta.dirname,
  '../../templates/hooks/post-tool-dependency-readiness.ts',
);

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../../..');

it('keeps the dogfood dependency-readiness helper identical to its source template', () => {
  const template = readFileSync(
    path.join(REPOSITORY_ROOT, 'packages/cli/templates/hooks/lib/dependency-readiness.ts'),
    'utf8',
  );
  const dogfood = readFileSync(
    path.join(REPOSITORY_ROOT, '.safeword/hooks/lib/dependency-readiness.ts'),
    'utf8',
  );
  const plugin = readFileSync(
    path.join(REPOSITORY_ROOT, 'plugin/runtime/hooks/lib/dependency-readiness.ts'),
    'utf8',
  );

  expect(dogfood).toBe(template);
  expect(plugin).toBe(template);
});

it('keeps the dogfood dependency bootstrap identical to its source template', () => {
  const template = readFileSync(
    path.join(REPOSITORY_ROOT, 'packages/cli/templates/hooks/dependency-bootstrap.ts'),
    'utf8',
  );
  const dogfood = readFileSync(
    path.join(REPOSITORY_ROOT, '.safeword/hooks/dependency-bootstrap.ts'),
    'utf8',
  );
  const plugin = readFileSync(
    path.join(REPOSITORY_ROOT, 'plugin/runtime/hooks/dependency-bootstrap.ts'),
    'utf8',
  );

  expect(dogfood).toBe(template);
  expect(plugin).toBe(template);
});

it('wires the dogfood Codex SessionStart to the managed dependency bootstrap', () => {
  const config = parse(readFileSync(path.join(REPOSITORY_ROOT, '.codex/config.toml'), 'utf8')) as {
    features?: { hooks?: boolean };
    hooks?: { SessionStart?: { hooks?: { command?: string }[] }[] };
  };
  const commands =
    config.hooks?.SessionStart?.flatMap(entry => entry.hooks ?? []).map(hook => hook.command) ?? [];
  const command = commands.find(candidate => candidate?.includes('dependency-bootstrap.ts'));

  expect(config.features?.hooks).toBe(true);
  expect(command).toBeDefined();
  expect(existsSync(path.join(REPOSITORY_ROOT, '.safeword/hooks/dependency-bootstrap.ts'))).toBe(
    true,
  );
  const wiredProject = createTemporaryDirectory();
  try {
    expect(spawnSync('git', ['init', '--quiet'], { cwd: wiredProject }).status).toBe(0);
    mkdirSync(path.join(wiredProject, '.safeword/hooks'), { recursive: true });
    writeFileSync(
      path.join(wiredProject, '.safeword/hooks/dependency-bootstrap.ts'),
      "import { writeFileSync } from 'node:fs'; writeFileSync(`${process.argv[2]}/.wiring-proof`, 'ok');\n",
    );

    expect(spawnSync('sh', ['-c', command ?? 'false'], { cwd: wiredProject }).status).toBe(0);
    expect(readFileSync(path.join(wiredProject, '.wiring-proof'), 'utf8')).toBe('ok');
  } finally {
    removeTemporaryDirectory(wiredProject);
  }
});

it('guards the repository-owned Safeword command with strict dependency readiness', () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };

  expect(packageJson.scripts?.safeword).toBe(
    'bun packages/cli/templates/hooks/dependency-bootstrap.ts --require-ready . && bun packages/cli/src/cli.ts',
  );
});

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

  function runHook(
    scriptPath: string,
    input?: string,
    environment: NodeJS.ProcessEnv = {},
    args: string[] = [],
  ): SpawnSyncReturns<string> {
    return spawnSync('bun', [scriptPath, ...args], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
        ...environment,
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

  it.each(['deno@2.0.0', 'pnpm'])(
    'abstains for unsupported packageManager declaration %s',
    declaration => {
      writeJson('package.json', {
        name: 'explicit-unsupported-project',
        packageManager: declaration,
      });
      writeTestFile(projectDirectory, 'bun.lock', '# stray bun lockfile');

      expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
      expect(getDependencyReadiness(projectDirectory).status).toBe('unsupported');
    },
  );

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

  it("abstains from yarn berry Plug'n'Play projects (#327)", () => {
    writeJson('package.json', { name: 'yarn-berry', packageManager: 'yarn@4.3.1' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');

    expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
  });

  it('detects yarn berry from .yarnrc.yml when no packageManager is declared (#327)', () => {
    writeJson('package.json', { name: 'yarn-berry-rc' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');
    writeTestFile(projectDirectory, '.yarnrc.yml', 'nodeLinker: node-modules\n');

    const plan = detectDependencyPlan(projectDirectory);
    expect(plan?.manager).toBe('yarn');
    expect(plan?.installCommand.display).toBe('yarn install --immutable');
    expect(plan?.installArtifact).toBe('node_modules');
    expect(plan?.inputPaths).toContain('.yarnrc.yml');
  });

  it.each(['"node-modules"', "'node-modules'"])(
    'accepts quoted yarn berry nodeLinker %s (#327)',
    nodeLinker => {
      writeJson('package.json', { name: 'yarn-berry-quoted', packageManager: 'yarn@4.3.1' });
      writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');
      writeTestFile(projectDirectory, '.yarnrc.yml', `nodeLinker: ${nodeLinker}\n`);

      expect(detectDependencyPlan(projectDirectory)?.installCommand.display).toBe(
        'yarn install --immutable',
      );
    },
  );

  it("abstains when yarn berry explicitly selects Plug'n'Play (#327)", () => {
    writeJson('package.json', { name: 'yarn-berry-pnp', packageManager: 'yarn@4.3.1' });
    writeTestFile(projectDirectory, 'yarn.lock', '# yarn lockfile');
    writeTestFile(projectDirectory, '.yarnrc.yml', 'nodeLinker: pnp\n');

    expect(detectDependencyPlan(projectDirectory)).toBeUndefined();
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

  it('preserves hash characters inside quoted pnpm workspace globs', () => {
    writeJson('package.json', { name: 'pnpm-ws', packageManager: 'pnpm@9.0.0' });
    writeTestFile(
      projectDirectory,
      'pnpm-workspace.yaml',
      "packages:\n  - 'packages/#internal' # private package\n",
    );
    writeTestFile(projectDirectory, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n");
    writeJson('packages/#internal/package.json', { name: '@ws/internal' });

    expect(detectDependencyPlan(projectDirectory)?.inputPaths).toContain(
      'packages/#internal/package.json',
    );
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

  it('ignores workspace patterns that escape the project root', () => {
    const outsideDirectory = createTemporaryDirectory();
    try {
      const outsidePattern = path
        .relative(projectDirectory, outsideDirectory)
        .replaceAll('\\', '/');
      writeJson('package.json', {
        name: 'contained-workspace-project',
        packageManager: 'bun@1.3.14',
        workspaces: [`${outsidePattern}/**`, `${outsideDirectory}/**`],
      });
      writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
      writeTestFile(outsideDirectory, 'nested/package.json', '{"name":"outside-project"}');

      expect(
        detectDependencyPlan(projectDirectory)?.inputPaths.toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(['bun.lock', 'package.json']);
    } finally {
      removeTemporaryDirectory(outsideDirectory);
    }
  });

  it('ignores workspace directories that resolve outside the project root', () => {
    const outsideDirectory = createTemporaryDirectory();
    try {
      writeJson('package.json', {
        name: 'contained-workspace-project',
        packageManager: 'bun@1.3.14',
        workspaces: ['packages/external'],
      });
      writeTestFile(projectDirectory, 'bun.lock', '# lockfile');
      writeTestFile(outsideDirectory, 'package.json', '{"name":"outside-project"}');
      mkdirSync(path.join(projectDirectory, 'packages'), { recursive: true });
      symlinkSync(outsideDirectory, path.join(projectDirectory, 'packages', 'external'), 'dir');

      expect(
        detectDependencyPlan(projectDirectory)?.inputPaths.toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(['bun.lock', 'package.json']);
    } finally {
      removeTemporaryDirectory(outsideDirectory);
    }
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

  it('keeps a mismatched marker stale until a successful install is proven', () => {
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

    // A newer artifact mtime cannot prove which inputs were installed. The
    // mismatched content marker remains authoritative until an install succeeds.
    const future = new Date(Date.now() + 60_000);
    utimesSync(artifact, future, future);
    const reinstalled = getDependencyReadiness(projectDirectory);
    expect(reinstalled.status).toBe('stale');
    writeInstallMarker(projectDirectory, {
      ...reinstalled,
      status: 'ready',
      reason: 'install_artifact_current',
    });

    // A later rebase pushes the artifact mtime behind again, but the refreshed
    // marker still matches the current content, so it stays ready.
    utimesSync(artifact, past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
  });

  it('stale recovery is one self-converging command even when the new PostToolUse hook is not loaded', () => {
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
    expect(recovery).toContain(
      'bun ci && rm -f node_modules/.safeword-deps-fingerprint && touch node_modules',
    );
    expect(recovery).not.toContain('If it reports no changes');
  });

  it('rendered stale recovery clears the block without a loaded PostToolUse hook', () => {
    writeBunProject();
    const artifact = path.join(projectDirectory, 'node_modules');
    mkdirSync(artifact);
    writeInstallMarker(projectDirectory, getDependencyReadiness(projectDirectory));
    writeTestFile(projectDirectory, 'bun.lock', '# changed lockfile');
    const past = new Date(Date.now() - 60_000);
    utimesSync(artifact, past, past);
    const plan = detectDependencyPlan(projectDirectory);
    if (plan === undefined) throw new Error('expected a dependency plan for the bun fixture');
    writeDependencyReadinessState(projectDirectory, {
      status: 'failed',
      reason: 'install_artifact_stale',
      fingerprint: dependencyInputFingerprint(projectDirectory, plan),
      installCommand: 'bun ci',
      updatedAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const stale = getDependencyReadiness(projectDirectory);
    const recovery = formatDependencyRecovery({ ...stale, installCommand: 'true' })
      .split('\n')
      .at(-1)
      ?.trim();
    expect(recovery).toBe(
      'true && rm -f node_modules/.safeword-deps-fingerprint && touch node_modules',
    );
    expect(spawnSync('sh', ['-c', recovery ?? 'false'], { cwd: projectDirectory }).status).toBe(0);
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
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
    // Host trust gates run before project SessionStart hooks. Once trusted, a
    // fresh worktree installs unconditionally so it cannot bypass the husky
    // guard chain merely because node_modules was absent.
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
    ['command bun test'],
    ['( bun test )'],
    ['env -u FOO bun test'],
    ['bunx safeword-tools setup'],
    ['bunx @scope/safeword setup'],
    ['bunx safeword'],
    ['bunx safeword setup'],
    ['bunx --bun safeword retro run --transcript /tmp/session.jsonl --auto-extract'],
    ['bunx safeword ticket list'],
    ['bunx safeword setupx'],
    ['bunx safeword --unknown-flag setup'],
    ['bunx safeword --cwd setup'],
    ['bunx safeword setup && bunx vitest run'],
    ['bunx safeword setup; bunx vitest run'],
    ['bunx safeword setup || bunx vitest run'],
    ['bunx safeword setup | bunx vitest run'],
    ['bunx safeword setup & bunx vitest run'],
    ['bunx safeword setup $(bunx vitest run)'],
    ['bunx safeword setup `bunx vitest run`'],
    ['bunx safeword setup <(bunx vitest run)'],
    ['bunx safeword setup >(bunx vitest run)'],
    ['FOO=$(vitest) bunx safeword setup'],
    ['FOO=bar BAR=$(vitest) bunx safeword setup'],
    ['bunx vitest run && bunx safeword setup'],
    ['bunx safeword --cwd "$(vitest)" setup'],
    ['bunx safeword setup\nbunx vitest run'],
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
    ['bunx safeword@latest setup'],
    ['bunx safeword@0.73.0 status'],
    ['FOO=bar bunx safeword@latest setup'],
    ['bunx safeword@latest status --json'],
    ['bunx --bun safeword@latest doctor'],
    ['bunx --bun safeword@0.82.0 retro run --transcript /tmp/session.jsonl --auto-extract'],
    ['bunx safeword@latest plan --offline'],
    ['bunx safeword@latest --cwd . setup'],
    ['bunx safeword@latest --cwd=. setup'],
    ['bunx safeword@latest --quiet doctor'],
    ['bunx safeword@latest setup && bunx safeword@latest doctor'],
    ['bunx safeword@latest status benign-positional-argument'],
    ['bunx safeword@latest --cwd "a && b" setup'],
    // `>|` is a clobber redirect: `vitest` here is a target filename, not a
    // command — the pre-EDDABK private splitter treated it as one.
    ['echo cfg >| vitest'],
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

  it('session hook bootstraps a missing worktree and degrades cleanly on failure', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(SESSION_HOOK);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('bun ci');

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state.status).toBe('failed');
    expect(state.installCommand).toBe('bun ci');
  });

  it('session hook bootstraps missing dependencies when auto-install is enabled', () => {
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
    expect(output.hookSpecificOutput.additionalContext).toContain('dependencies bootstrapped');
    expect(existsSync(path.join(projectDirectory, 'node_modules'))).toBe(true);

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state).toMatchObject({
      status: 'ready',
      installCommand: 'bun ci',
    });
  });

  it('host-neutral bootstrap prepares a fresh worktree without Claude hook output', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('dependencies bootstrapped with `bun ci`.');
    expect(result.stdout).toBe('');
    expect(existsSync(path.join(projectDirectory, 'node_modules'))).toBe(true);

    const state = JSON.parse(readTestFile(projectDirectory, '.project/dependency-readiness.json'));
    expect(state).toMatchObject({
      status: 'ready',
      installCommand: 'bun ci',
    });
  });

  it('host-neutral bootstrap wires a committed git guard before reporting readiness', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();
    mkdirSync(path.join(projectDirectory, '.husky'));
    writeTestFile(projectDirectory, '.husky/pre-commit', '#!/bin/sh\n');
    expect(spawnSync('git', ['init', '--quiet'], { cwd: projectDirectory }).status).toBe(0);

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(0);
    expect(
      spawnSync('git', ['config', '--get', 'core.hooksPath'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      }).stdout.trim(),
    ).toBe('.husky');
  });

  it('host-neutral bootstrap refreshes a stale marker after a successful install', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();
    mkdirSync(path.join(projectDirectory, 'node_modules'));
    writeTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint', 'old-fingerprint');
    writeJson('.safeword/config.json', { dependencyBootstrap: { autoInstall: true } });
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('dependencies bootstrapped with `bun ci`.');
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
  });

  it('refreshes a stale marker when a successful installer preserves node_modules', () => {
    writeJson('package.json', {
      name: 'marker-preserving-project',
      packageManager: 'npm@11.0.0',
    });
    writeJson('package-lock.json', {
      name: 'marker-preserving-project',
      lockfileVersion: 3,
      packages: {},
    });
    markSafewordProject();
    writeJson('.safeword/config.json', { dependencyBootstrap: { autoInstall: true } });
    mkdirSync(path.join(projectDirectory, 'node_modules'));
    writeTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint', 'old-fingerprint');

    const fakeBin = path.join(projectDirectory, 'fake-bin');
    mkdirSync(fakeBin);
    const fakeNpm = path.join(fakeBin, 'npm');
    writeFileSync(fakeNpm, '#!/bin/sh\nexit 0\n');
    chmodSync(fakeNpm, 0o755);

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK, undefined, {
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('dependencies bootstrapped with `npm ci`.');
    expect(getDependencyReadiness(projectDirectory).status).toBe('ready');
  });

  it('host-neutral bootstrap reports manual action without failing advisory mode', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();
    mkdirSync(path.join(projectDirectory, 'node_modules'));
    writeTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint', 'old-fingerprint');
    writeJson('.safeword/config.json', { dependencyBootstrap: { autoInstall: false } });
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("the project's tool list changed");
    expect(result.stdout).toContain('bun ci');
    expect(result.stderr).toBe('');
  });

  it('host-neutral bootstrap blocks composed commands when readiness is required', () => {
    writeMinimalBunProject();
    markSafewordProject();
    writeGeneratedBunLock();
    mkdirSync(path.join(projectDirectory, 'node_modules'));
    writeTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint', 'old-fingerprint');

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK, undefined, {}, ['--require-ready']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the project's tool list changed");
    expect(result.stdout).toBe('');
  });

  it('reports the spawn error when the declared package manager is unavailable', () => {
    writeJson('package.json', {
      name: 'missing-package-manager-project',
      packageManager: 'npm@11.0.0',
    });
    writeJson('package-lock.json', {
      name: 'missing-package-manager-project',
      lockfileVersion: 3,
      packages: {},
    });
    markSafewordProject();

    const originalPath = process.env.PATH;
    process.env.PATH = path.join(projectDirectory, 'missing-bin');
    try {
      const result = bootstrapDependencies(projectDirectory);
      expect(result.status).toBe('failed');
      expect(result).toMatchObject({ message: expect.stringContaining('ENOENT') });
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('preserves missing readiness when npm deletes and partially recreates node_modules', () => {
    writeJson('package.json', {
      name: 'interrupted-install-project',
      packageManager: 'npm@11.0.0',
    });
    writeJson('package-lock.json', {
      name: 'interrupted-install-project',
      lockfileVersion: 3,
      packages: {},
    });
    markSafewordProject();

    const fakeBin = path.join(projectDirectory, 'fake-bin');
    mkdirSync(fakeBin);
    const fakeNpm = path.join(fakeBin, 'npm');
    writeFileSync(
      fakeNpm,
      '#!/bin/sh\nrm -rf node_modules\nmkdir node_modules\nprintf partial > node_modules/partial\nexit 1\n',
    );
    chmodSync(fakeNpm, 0o755);

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK, undefined, {
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
    });

    expect(result.status).toBe(1);
    expect(getDependencyReadiness(projectDirectory).status).toBe('missing');
    expect(readDependencyReadinessState(projectDirectory)).toMatchObject({
      status: 'failed',
      reason: 'install_artifact_missing',
    });
    expect(existsSync(path.join(projectDirectory, 'node_modules/.safeword-deps-fingerprint'))).toBe(
      false,
    );
  });

  it('does not start a second installer while another bootstrap owns the lock', () => {
    writeJson('package.json', {
      name: 'concurrent-install-project',
      packageManager: 'npm@11.0.0',
    });
    writeJson('package-lock.json', {
      name: 'concurrent-install-project',
      lockfileVersion: 3,
      packages: {},
    });
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, '.project/.dependency-bootstrap.lock'), {
      recursive: true,
    });
    writeTestFile(projectDirectory, '.project/.dependency-bootstrap.lock/pid', String(process.pid));

    const result = bootstrapDependencies(projectDirectory);

    expect(result).toEqual({
      status: 'action_required',
      message:
        'another dependency bootstrap is already running; wait for it to finish, then retry.',
    });
    expect(existsSync(path.join(projectDirectory, 'node_modules'))).toBe(false);
  });

  it('host-neutral bootstrap abstains successfully for unsupported projects', () => {
    markSafewordProject();

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('host-neutral bootstrap fails loudly when a fresh worktree cannot be prepared', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(DEPENDENCY_BOOTSTRAP_HOOK);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dependency bootstrap failed while running `bun ci`.');
    expect(result.stderr).toContain('Run the install command manually');
    expect(result.stdout).not.toContain('hookSpecificOutput');
  });

  it('session hook reports an attempted install that fails', () => {
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

  it('pre-tool hook allows an install followed by a guarded retry over &&', () => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    const past = new Date(Date.now() - 60_000);
    utimesSync(path.join(projectDirectory, 'node_modules'), past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'bun ci && bun run test',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('pre-tool hook keeps safeword setup reachable when dependencies are missing', () => {
    writeBunProject();
    markSafewordProject();

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'bunx safeword@latest setup',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('pre-tool hook keeps independent retro delivery reachable when dependencies are stale', () => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    writeTestFile(projectDirectory, 'node_modules/.safeword-deps-fingerprint', 'old-fingerprint');
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'bunx --bun safeword@0.82.0 retro run --transcript session.jsonl --auto-extract',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('pre-tool hook allows the documented touch recovery followed by a guarded retry over &&', () => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    const past = new Date(Date.now() - 60_000);
    utimesSync(path.join(projectDirectory, 'node_modules'), past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          command: 'touch node_modules && bun run test',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('pre-tool hook still blocks the touch recovery when node_modules is missing', () => {
    writeBunProject();
    markSafewordProject();
    expect(getDependencyReadiness(projectDirectory).status).toBe('missing');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          // `touch` would create an empty regular FILE named node_modules and
          // exit 0, so the retry would run with nothing installed.
          command: 'touch node_modules && bun run test',
        },
      }),
    );

    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('pre-tool hook allows an install and retry when node_modules is missing', () => {
    writeBunProject();
    markSafewordProject();
    expect(getDependencyReadiness(projectDirectory).status).toBe('missing');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'bun ci && bun run test' },
      }),
    );

    expect(result.stdout.trim()).toBe('');
  });

  it('pre-tool hook allows a guarded retry that redirects with 2>&1', () => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    const past = new Date(Date.now() - 60_000);
    utimesSync(path.join(projectDirectory, 'node_modules'), past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: {
          // `&` here duplicates a file descriptor; it does not background the
          // list, so it must not cost the retry its exemption.
          command: 'bun ci && bun run test > out.log 2>&1',
        },
      }),
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it.each([
    'bun ci || bun run test',
    'bun ci; bun run test',
    'bun ci | bun run test',
    // `&` ends the `&&` list: bash runs `(bun ci && bun run dev) &` and then
    // `bun run test` at once, whether or not the install succeeded.
    'bun ci && bun run dev & bun run test',
    'touch node_modules && bun run dev & bun run test',
  ])('pre-tool hook blocks a guarded retry when the recovery chain uses %s', command => {
    writeBunProject();
    markSafewordProject();
    mkdirSync(path.join(projectDirectory, 'node_modules'), { recursive: true });
    const past = new Date(Date.now() - 60_000);
    utimesSync(path.join(projectDirectory, 'node_modules'), past, past);
    expect(getDependencyReadiness(projectDirectory).status).toBe('stale');

    const result = runHook(
      PRE_TOOL_HOOK,
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command },
      }),
    );

    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
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
        'command npm ci',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(true);
      }
    });

    it('ignores non-install commands', () => {
      for (const command of [
        'bun run test',
        'eslint .',
        'git commit -m x',
        'pnpm add zod',
        // Report-only flags print-and-exit — stamping after them would mark
        // stale deps ready without an install. True for every manager, not
        // just classic bare yarn (EDDABK).
        'yarn --version',
        'command yarn --version',
        'npm ci --help',
        'bun install --help',
        'pnpm install -h',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('ignores compound installs whose segment success is masked by the shell', () => {
      for (const command of ['bun ci || true', 'npm ci; true', 'pnpm install || echo failed']) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('ignores lockfile-only / dry-run installs (they do not materialize node_modules)', () => {
      for (const command of [
        'bun install --dry-run',
        'npm ci --dry-run',
        'pnpm install --lockfile-only',
        'npm install --package-lock-only',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('ignores installs that omit dependencies or skip Yarn linking', () => {
      for (const command of [
        'bun install --production',
        'bun install --omit dev',
        'npm ci --omit=dev',
        'npm ci --only production',
        'pnpm install --prod',
        'pnpm install --no-optional',
        'yarn install --mode=update-lockfile',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('ignores workspace-scoped installs that cannot reconcile the project root', () => {
      for (const command of [
        'bun --cwd packages/cli install',
        'npm --prefix packages/cli ci',
        'npm install -w packages/cli',
        'pnpm install --filter @app/web',
      ]) {
        expect(isDependencyInstallCommand(command), command).toBe(false);
      }
    });

    it('does NOT stamp after a dry-run install (no sticky false-ready)', () => {
      makeStaleAfterNoopInstall();

      runHook(POST_TOOL_HOOK, postInput('bun install --dry-run', { exit_code: 0, success: true }));

      expect(readTestFile(projectDirectory, MARKER)).toBe('old-fingerprint');
      expect(getDependencyReadiness(projectDirectory).status).toBe('stale');
    });

    it('stamps the current fingerprint after a successful no-op install (clears the block)', () => {
      const fingerprint = makeStaleAfterNoopInstall();
      writeDependencyReadinessState(projectDirectory, {
        status: 'failed',
        reason: 'install_artifact_stale',
        fingerprint,
        installCommand: 'bun ci',
      });

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

    it('does NOT stamp when a failed install is masked by a successful shell segment', () => {
      makeStaleAfterNoopInstall();

      runHook(POST_TOOL_HOOK, postInput('bun ci || true', { exit_code: 0, success: true }));

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

describe('isDependencyReadinessRecoveryCommand', () => {
  // Unit pins for the shell-shape edges. The hook-process tests above pin the
  // wiring; spawning a hook per edge case would cost seconds for no more signal.
  it.each([
    'bun ci && bun run test',
    'pnpm install --frozen-lockfile && pnpm exec safeword doctor',
    'yarn && yarn test',
    'bun ci && bun run lint && bun run test',
    'bun ci && bun run test > out.log 2>&1',
  ])('exempts %s', command => {
    expect(isDependencyReadinessRecoveryCommand(command, 'stale')).toBe(true);
  });

  it.each([
    // The retry must be conditional on the recovery.
    'bun ci || bun run test',
    'bun ci; bun run test',
    'bun ci | bun run test',
    'bun ci && bun run dev & bun run test',
    'bun ci & bun run test',
    // The recovery must lead.
    'bun run test && bun ci',
    'cd packages/cli && bun ci && bun run test',
    // A recovery that never materializes node_modules is not a recovery.
    'bun install --dry-run && bun run test',
    'bun install --help && bun run test',
    'bun install --production && bun run test',
    'npm ci --omit=dev && npm test',
    'pnpm install --prod && pnpm test',
    'yarn install --mode=update-lockfile && yarn test',
    'bun --cwd packages/cli install && bun run test',
    'pnpm install --filter @app/web && pnpm test',
    // Shell forms the tokenizer cannot resolve stay denied.
    '( bun ci || true ) && bun run test',
    '{ bun ci; } && bun run test',
    'if bun ci; then bun run test; fi',
  ])('denies %s', command => {
    expect(isDependencyReadinessRecoveryCommand(command, 'stale')).toBe(false);
  });

  it('exempts the touch recovery only for a stale marker', () => {
    expect(
      isDependencyReadinessRecoveryCommand('touch node_modules && bun run test', 'stale'),
    ).toBe(true);
    expect(
      isDependencyReadinessRecoveryCommand('touch node_modules && bun run test', 'missing'),
    ).toBe(false);
    // An install recovers either status.
    expect(isDependencyReadinessRecoveryCommand('bun ci && bun run test', 'missing')).toBe(true);
  });

  it('matches only the exact documented touch recovery', () => {
    for (const command of [
      'touch node_modules/ && bun run test',
      'touch ./node_modules && bun run test',
      'touch -m node_modules && bun run test',
      'touch node_modules other && bun run test',
    ]) {
      expect(isDependencyReadinessRecoveryCommand(command, 'stale')).toBe(false);
    }
  });
});
