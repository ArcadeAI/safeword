import { createHash } from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { VERSION } from '../../src/version.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  runCliWithoutInstall,
} from '../helpers.js';

interface Effect {
  readonly kind: string;
  readonly target: string;
  readonly operation?: string;
}

interface LifecycleEnvelope {
  readonly effects: Record<string, Effect[]>;
  readonly data: { readonly plan: { readonly effects: Record<string, Effect[]> } };
}

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

function writeJson(directory: string, target: string, value: unknown): void {
  const path = nodePath.join(directory, target);
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`);
}

function readJson(directory: string, target: string): unknown {
  return JSON.parse(readFileSync(nodePath.join(directory, target), 'utf8'));
}

function configureProject(directory: string, installedPacks: string[] = []): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(directory, '.safeword/version'), `${VERSION}\n`);
  writeJson(directory, '.safeword/config.json', { installedPacks });
}

function treeDigest(root: string): string {
  const hash = createHash('sha256');
  const visit = (path: string): void => {
    const relative = nodePath.relative(root, path);
    const stat = lstatSync(path);
    hash.update(relative);
    hash.update(String(stat.mode));
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(path));
      return;
    }
    if (stat.isDirectory()) {
      const entries = readdirSync(path).toSorted((left, right) => left.localeCompare(right));
      for (const entry of entries) visit(nodePath.join(path, entry));
      return;
    }
    hash.update(readFileSync(path));
  };
  visit(root);
  return hash.digest('hex');
}

function effectIdentity(effect: Effect): string {
  return `${effect.kind}\0${effect.target}\0${effect.operation ?? ''}`;
}

async function planProject(
  directory: string,
  agents = 'none',
  options: readonly string[] = [],
): Promise<{ envelope: LifecycleEnvelope; stdout: string }> {
  const before = treeDigest(directory);
  const result = await runCliWithoutInstall(
    [
      'plan',
      `--agents=${agents}`,
      '--scope=project',
      ...options,
      '--json',
      '--offline',
      '--cwd',
      directory,
    ],
    { cwd: directory },
  );
  expect(result.exitCode).toBe(2);
  expect(treeDigest(directory)).toBe(before);
  return { envelope: JSON.parse(result.stdout) as LifecycleEnvelope, stdout: result.stdout };
}

function expectEffectsInclude(
  envelope: LifecycleEnvelope,
  category: string,
  expected: readonly Effect[],
): void {
  expect(envelope.data.plan.effects[category]).toEqual(expect.arrayContaining([...expected]));
}

describe('install plan completeness', () => {
  it('previews package.json creation for a fresh project', async () => {
    const directory = temporaryDirectory();

    const { envelope: planEnvelope } = await planProject(directory);
    expectEffectsInclude(planEnvelope, 'files', [{ kind: 'create', target: 'package.json' }]);

    const installed = await runCliWithoutInstall(
      ['install', '--agents=none', '--no-input', '--no-modify', '--json', '--cwd', directory],
      { cwd: directory },
    );
    expect(installed.exitCode).toBe(0);
    const installEnvelope = JSON.parse(installed.stdout) as LifecycleEnvelope;
    const planned = new Set((planEnvelope.data.plan.effects.files ?? []).map(effectIdentity));
    expect(
      (installEnvelope.effects.files ?? []).filter(effect => !planned.has(effectIdentity(effect))),
    ).toEqual([]);
  });

  it('previews namespace migration and version-marker repair options', async () => {
    const directory = temporaryDirectory();
    configureProject(directory, ['typescript']);
    writeFileSync(nodePath.join(directory, '.safeword/version'), 'not-semver\n');
    mkdirSync(nodePath.join(directory, '.safeword-project/tickets'), { recursive: true });
    writeFileSync(nodePath.join(directory, '.safeword-project/tickets/legacy.md'), '# Legacy\n');
    writeJson(directory, '.safeword/config.json', {
      installedPacks: ['typescript'],
      paths: { tickets: '.safeword-project/tickets' },
    });

    const options = ['--migrate-namespace', '--repair-version-marker'] as const;
    const { envelope: planEnvelope, stdout } = await planProject(directory, 'none', options);
    expectEffectsInclude(planEnvelope, 'files', [
      { kind: 'update', target: '.safeword/version' },
      { kind: 'move', target: '.safeword-project → .project' },
      { kind: 'delete', target: '.safeword-project/tickets/legacy.md' },
      { kind: 'create', target: '.project/tickets/legacy.md' },
      { kind: 'update', target: '.safeword/config.json' },
    ]);
    expect(stdout).toContain('--migrate-namespace');
    expect(stdout).toContain('--repair-version-marker');

    const installed = await runCliWithoutInstall(
      [
        'install',
        '--agents=none',
        '--no-input',
        '--no-modify',
        ...options,
        '--json',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );
    expect(installed.exitCode).toBe(0);
    const installEnvelope = JSON.parse(installed.stdout) as LifecycleEnvelope;
    const planned = new Set((planEnvelope.data.plan.effects.files ?? []).map(effectIdentity));
    expect(
      (installEnvelope.effects.files ?? []).filter(effect => !planned.has(effectIdentity(effect))),
    ).toEqual([]);
  });

  it('previews every project effect that install applies from the unchanged state', async () => {
    const directory = temporaryDirectory();
    configureProject(directory, ['typescript']);
    mkdirSync(nodePath.join(directory, 'packages/app'), { recursive: true });
    writeJson(directory, 'package.json', {
      name: 'polyglot',
      private: true,
      workspaces: ['packages/*'],
    });
    writeJson(directory, 'packages/app/package.json', { name: 'app', private: true });
    writeFileSync(nodePath.join(directory, 'pyproject.toml'), '[project]\nname = "polyglot"\n');

    const { envelope: planEnvelope } = await planProject(directory);
    expectEffectsInclude(planEnvelope, 'files', [
      { kind: 'update', target: '.safeword/config.json' },
      { kind: 'create', target: '.codex/config.toml' },
      { kind: 'create', target: '.safeword/depcruise-config.cjs' },
      { kind: 'create', target: '.dependency-cruiser.cjs' },
      { kind: 'update', target: 'packages/app/package.json' },
    ]);

    const installed = await runCliWithoutInstall(
      [
        'install',
        '--agents=none',
        '--scope=project',
        '--no-input',
        '--no-modify',
        '--json',
        '--cwd',
        directory,
      ],
      { cwd: directory },
    );
    expect(installed.exitCode).toBe(0);

    const installEnvelope = JSON.parse(installed.stdout) as LifecycleEnvelope;
    for (const category of ['files', 'packages', 'configuration', 'network'] as const) {
      const plannedEffects = new Set(
        (planEnvelope.data.plan.effects[category] ?? []).map(effectIdentity),
      );
      expect(
        (installEnvelope.effects[category] ?? []).filter(
          effect => !plannedEffects.has(effectIdentity(effect)),
        ),
        `unplanned ${category} effects`,
      ).toEqual([]);
    }
  });

  it('previews the complete project surface for the documented agent combination', async () => {
    const directory = temporaryDirectory();
    configureProject(directory, ['typescript']);
    mkdirSync(nodePath.join(directory, 'packages/app'), { recursive: true });
    writeJson(directory, 'package.json', {
      name: 'polyglot',
      private: true,
      workspaces: ['packages/*'],
    });
    writeJson(directory, 'packages/app/package.json', { name: 'app', private: true });
    writeFileSync(nodePath.join(directory, 'pyproject.toml'), '[project]\nname = "polyglot"\n');

    const { envelope } = await planProject(directory, 'claude,codex,cursor');

    expectEffectsInclude(envelope, 'files', [
      { kind: 'update', target: '.safeword/config.json' },
      { kind: 'create', target: '.codex/config.toml' },
      { kind: 'update', target: 'packages/app/package.json' },
    ]);
  });

  it.each([
    { manager: 'uv', lockfile: 'uv.lock' },
    { manager: 'poetry', lockfile: 'poetry.lock' },
    { manager: 'pipenv', lockfile: 'Pipfile.lock' },
  ])('previews $manager package, network, manifest, and lockfile effects', async ({ lockfile }) => {
    const directory = temporaryDirectory();
    configureProject(directory, ['python']);
    writeFileSync(nodePath.join(directory, 'pyproject.toml'), '[project]\nname = "python-app"\n');
    writeFileSync(nodePath.join(directory, lockfile), 'fixture\n');
    if (lockfile === 'Pipfile.lock') writeFileSync(nodePath.join(directory, 'Pipfile'), '');
    mkdirSync(nodePath.join(directory, 'src/python_app'), { recursive: true });
    writeFileSync(nodePath.join(directory, 'src/python_app/__init__.py'), '');

    const { envelope } = await planProject(directory);
    const tools = ['ruff', 'mypy', 'deadcode', 'import-linter'];

    expectEffectsInclude(envelope, 'files', [
      { kind: 'update', target: 'pyproject.toml' },
      { kind: 'update', target: lockfile },
    ]);
    expectEffectsInclude(
      envelope,
      'packages',
      tools.map(target => ({ kind: 'install', target })),
    );
    expectEffectsInclude(
      envelope,
      'network',
      tools.map(target => ({ kind: 'package-registry', target, operation: 'install' })),
    );
  });

  it('previews every Cargo manifest that Rust pack adoption will update', async () => {
    const directory = temporaryDirectory();
    configureProject(directory);
    mkdirSync(nodePath.join(directory, 'crates/api/src'), { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/*"]\nresolver = "2"\n',
    );
    writeFileSync(
      nodePath.join(directory, 'crates/api/Cargo.toml'),
      '[package]\nname = "api"\nversion = "0.1.0"\n',
    );
    writeFileSync(nodePath.join(directory, 'crates/api/src/lib.rs'), 'pub fn api() {}\n');

    const { envelope } = await planProject(directory);

    expectEffectsInclude(envelope, 'files', [
      { kind: 'update', target: 'Cargo.toml' },
      { kind: 'update', target: 'crates/api/Cargo.toml' },
    ]);
  });

  it('previews conservative ESLint writes without inventing unrelated targets', async () => {
    const directory = temporaryDirectory();
    configureProject(directory, ['typescript']);
    writeJson(directory, 'package.json', { name: 'eslint-app', private: true });
    writeFileSync(nodePath.join(directory, 'index.js'), 'export const value = 1;\n');
    writeFileSync(nodePath.join(directory, 'eslint.config.js'), 'export default [];\n');

    const { envelope } = await planProject(directory);
    const eslintEffects = (envelope.data.plan.effects.files ?? []).filter(effect =>
      effect.target.startsWith('eslint.config.js'),
    );

    expect(eslintEffects).toEqual([
      { kind: 'update', target: 'eslint.config.js' },
      { kind: 'create', target: 'eslint.config.js.safeword-bak' },
    ]);
  });

  it('executes a package-manager update and previews every resulting file, package, and network effect', async () => {
    const directory = temporaryDirectory();
    configureProject(directory, ['typescript']);
    writeJson(directory, 'package.json', {
      name: 'stale-safeword',
      private: true,
      devDependencies: {
        '@cucumber/cucumber': '^13.0.0',
        '@types/node': '^25.0.0',
        'dependency-cruiser': '^17.0.0',
        eslint: '^9.22.0',
        jiti: '^2.2.0',
        knip: '^6.0.0',
        prettier: '^3.0.0',
        safeword: '^0.1.0',
        tsx: '^4.0.0',
        typescript: '^5.0.0',
      },
    });
    writeJson(directory, 'package-lock.json', { lockfileVersion: 3, packages: {} });
    const bin = nodePath.join(directory, 'bin');
    const log = nodePath.join(directory, 'npm.log');
    mkdirSync(bin);
    const npm = nodePath.join(bin, 'npm');
    writeFileSync(
      npm,
      `#!/bin/sh
set -eu
printf '%s\n' "$*" >> ${JSON.stringify(log)}
node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
manifest.devDependencies.safeword = "^${VERSION}";
fs.writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\\n");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
lock.updatedByFixture = true;
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\\n");
'
`,
    );
    chmodSync(npm, 0o755);

    const { envelope: planEnvelope } = await planProject(directory);
    const compatibilityPackage = `safeword@${VERSION}`;
    expectEffectsInclude(planEnvelope, 'files', [
      { kind: 'update', target: 'package.json' },
      { kind: 'update', target: 'package-lock.json' },
    ]);
    expectEffectsInclude(planEnvelope, 'packages', [
      { kind: 'update', target: compatibilityPackage },
    ]);
    expectEffectsInclude(planEnvelope, 'network', [
      { kind: 'package-registry', target: compatibilityPackage, operation: 'update' },
    ]);

    const installed = await runCli(
      [
        'install',
        '--agents=none',
        '--scope=project',
        '--no-input',
        '--no-modify',
        '--json',
        '--cwd',
        directory,
      ],
      {
        cwd: directory,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '',
          SAFEWORD_SKIP_SKILLS: '1',
        },
      },
    );
    expect(installed.exitCode).toBe(0);
    expect(readFileSync(log, 'utf8')).toContain(compatibilityPackage);

    const installEnvelope = JSON.parse(installed.stdout) as LifecycleEnvelope;
    for (const category of ['files', 'packages', 'network'] as const) {
      const planned = new Set((planEnvelope.data.plan.effects[category] ?? []).map(effectIdentity));
      const applied = (installEnvelope.effects[category] ?? []).map(effectIdentity);
      expect(
        applied.filter(effect => !planned.has(effect)),
        `unplanned ${category} effects`,
      ).toEqual([]);
    }

    expect(installEnvelope.effects.packages).toEqual(planEnvelope.data.plan.effects.packages);
    expect(installEnvelope.effects.network).toEqual(planEnvelope.data.plan.effects.network);
    const packageJson = readJson(directory, 'package.json') as {
      devDependencies: { safeword: string };
    };
    const packageLock = readJson(directory, 'package-lock.json') as {
      updatedByFixture?: boolean;
    };
    expect(packageJson.devDependencies.safeword).toBe(`^${VERSION}`);
    expect(packageLock.updatedByFixture).toBe(true);
  });
});
