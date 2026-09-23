import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse as parseToml } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { createTemporaryDirectory, removeTemporaryDirectory } from './helpers.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function runNodeFromRepoRoot(source: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

interface CiJob {
  steps?: { with?: { 'node-version'?: string } }[];
  strategy?: { matrix?: { 'node-version'?: string[] } };
}

function directNodeVersions(jobs: Record<string, CiJob>): string[] {
  return Object.values(jobs).flatMap(
    job =>
      job.steps
        ?.map(step => step.with?.['node-version'])
        .filter(
          (version): version is string => typeof version === 'string' && !version.startsWith('${{'),
        ) ?? [],
  );
}

describe('dogfood source worktree package resolution (470)', () => {
  it('routes locked worktree installs through the mise-pinned tools', () => {
    const environment = parseToml(
      readFileSync(nodePath.join(repoRoot, '.codex/environments/safeword.toml'), 'utf8'),
    ) as {
      setup?: { script?: string };
    };
    const fixture = createTemporaryDirectory();
    const callsPath = nodePath.join(fixture, 'mise-calls.txt');
    const misePath = nodePath.join(fixture, 'mise');
    writeFileSync(
      misePath,
      [
        '#!/bin/sh',
        String.raw`printf '%s\n' "$*" >> "$MISE_CALLS"`,
        '[ "${MISE_FAIL_COMMAND:-}" = "$*" ] && exit 23',
        'exit 0',
        '',
      ].join('\n'),
    );
    chmodSync(misePath, 0o755);

    try {
      const result = spawnSync('/bin/sh', ['-c', environment.setup?.script ?? ''], {
        cwd: fixture,
        encoding: 'utf8',
        env: { ...process.env, MISE_CALLS: callsPath, PATH: fixture },
      });

      expect(result.status).toBe(0);
      expect(readFileSync(callsPath, 'utf8').trim().split('\n')).toEqual([
        'install',
        'exec -- bun install --frozen-lockfile',
        'exec -- uv sync --locked',
      ]);

      writeFileSync(callsPath, '');
      const failed = spawnSync('/bin/sh', ['-c', environment.setup?.script ?? ''], {
        cwd: fixture,
        encoding: 'utf8',
        env: { ...process.env, MISE_CALLS: callsPath, MISE_FAIL_COMMAND: 'install', PATH: fixture },
      });

      expect(failed.status).toBe(23);
      expect(readFileSync(callsPath, 'utf8').trim().split('\n')).toEqual(['install']);
    } finally {
      removeTemporaryDirectory(fixture);
    }
  });

  it('keeps pinned core runtimes aligned with package metadata and CI', () => {
    const packageJson = readJson(nodePath.join(repoRoot, 'package.json')) as {
      packageManager?: string;
    };
    const mise = parseToml(readFileSync(nodePath.join(repoRoot, 'mise.toml'), 'utf8')) as {
      tools?: Record<string, string>;
      settings?: { python?: { uv_venv_auto?: string } };
    };
    const workflow = readFileSync(nodePath.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

    expect(packageJson.packageManager).toBeDefined();
    if (packageJson.packageManager === undefined) throw new Error('packageManager is missing');
    expect(mise.tools).toBeDefined();
    if (mise.tools === undefined) throw new Error('mise tools are missing');
    const packageManagerBun = packageJson.packageManager.replace('bun@', '');
    expect(packageManagerBun).not.toBe('');
    expect(mise.tools.bun).not.toBe('');
    expect(mise.tools).toMatchObject({
      bun: packageManagerBun,
      node: '24.18.1',
      go: '1.25',
      python: '3.12',
      uv: '0.12.9',
    });
    expect(workflow).toContain(`node-version: ['22.23.2', '${mise.tools.node}']`);
    expect(workflow).toContain(`go-version: '${mise.tools.go}'`);
    expect(workflow).toContain(`python-version: '${mise.tools.python}'`);
    const ci = parseYaml(workflow) as { jobs?: Record<string, CiJob> };
    expect(ci.jobs).toBeDefined();
    if (ci.jobs === undefined) throw new Error('CI jobs are missing');
    expect(ci.jobs.test?.strategy?.matrix?.['node-version']).toEqual(['22.23.2', mise.tools.node]);
    const configuredNodeVersions = directNodeVersions(ci.jobs ?? {});
    expect(configuredNodeVersions.length).toBeGreaterThan(0);
    expect(new Set(configuredNodeVersions)).toEqual(new Set([mise.tools.node]));
  });

  it('pins Python verification tools and activates the uv environment', () => {
    const mise = parseToml(readFileSync(nodePath.join(repoRoot, 'mise.toml'), 'utf8')) as {
      tools?: Record<string, string>;
      settings?: { python?: { uv_venv_auto?: string } };
    };
    const pyproject = parseToml(
      readFileSync(nodePath.join(repoRoot, 'pyproject.toml'), 'utf8'),
    ) as {
      'dependency-groups'?: { dev?: string[] };
      tool?: { uv?: { 'required-version'?: string } };
    };

    expect(pyproject.tool?.uv?.['required-version']).toBe(`==${mise.tools?.uv}`);
    expect(mise.settings?.python?.uv_venv_auto).toBe('source');
    expect(pyproject['dependency-groups']?.dev).toEqual(
      expect.arrayContaining([
        'deadcode==2.4.1',
        'import-linter==2.14',
        'mypy==2.3.1',
        'pip-audit==2.10.0',
        'ruff==0.16.5',
      ]),
    );
  });

  it('keeps the uv environment outside repository scanners', () => {
    const eslintConfig = readFileSync(nodePath.join(repoRoot, 'eslint.config.ts'), 'utf8');
    const gitignore = readFileSync(nodePath.join(repoRoot, '.gitignore'), 'utf8');
    const prettierignore = readFileSync(nodePath.join(repoRoot, '.prettierignore'), 'utf8');

    expect(eslintConfig).toContain("'**/.venv/'");
    expect(gitignore.split('\n')).toContain('.venv/');
    expect(prettierignore.split('\n')).toContain('.venv/');
  });

  it('installs CI Python tools from the checked lockfile', () => {
    const workflow = readFileSync(nodePath.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const ci = parseYaml(workflow) as {
      jobs?: {
        test?: { steps?: { name?: string; run?: string; with?: Record<string, unknown> }[] };
      };
    };
    const testJob = ci.jobs?.test;
    expect(testJob).toBeDefined();
    if (testJob === undefined) throw new Error('CI test job is missing');
    const steps = testJob.steps ?? [];
    const setupUvIndex = steps.findIndex(step => step.name === 'Setup uv');
    const installPythonIndex = steps.findIndex(step => step.name === 'Install Python tools');
    const testPackagesIndex = steps.findIndex(step => step.name === 'Test all packages');
    expect(setupUvIndex).toBeGreaterThanOrEqual(0);
    expect(installPythonIndex).toBeGreaterThanOrEqual(0);
    expect(testPackagesIndex).toBeGreaterThanOrEqual(0);
    expect(steps[setupUvIndex]?.with?.['version-file']).toBe('pyproject.toml');
    expect(steps[installPythonIndex]?.run).toContain('uv sync --locked');
    expect(steps[installPythonIndex]?.run).toContain('echo "$PWD/.venv/bin" >> "$GITHUB_PATH"');
    expect(setupUvIndex).toBeLessThan(installPythonIndex);
    expect(installPythonIndex).toBeLessThan(testPackagesIndex);
    expect(workflow).not.toContain('requirements-ci.txt');
  });

  it('resolves the real repository mypy lane through uv', () => {
    const output = execFileSync(
      'bun',
      [
        nodePath.join('packages', 'cli', 'src', 'cli.ts'),
        'project',
        'test-plan',
        '.',
        '--kind',
        'typecheck',
        '--format',
        'json',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    const plan = JSON.parse(output) as {
      language: string;
      cwd: string;
      command: string;
      runner: string;
      available: boolean;
    }[];

    expect(plan).toContainEqual(
      expect.objectContaining({
        language: 'python',
        cwd: repoRoot,
        command: 'uv run --locked mypy .',
        runner: 'uv',
      }),
    );
  });

  it('declares the CLI workspace as a root devDependency so Bun links safeword', () => {
    const rootPackageJson = readJson(nodePath.join(repoRoot, 'package.json')) as {
      devDependencies?: Record<string, string>;
      packageManager?: string;
      workspaces?: string[];
    };
    const cliPackageJson = readJson(nodePath.join(repoRoot, 'packages/cli/package.json')) as {
      exports?: Record<string, unknown>;
      name?: string;
    };

    expect(rootPackageJson.packageManager).toMatch(/^bun@/);
    expect(rootPackageJson.workspaces).toContain('packages/*');
    expect(cliPackageJson.name).toBe('safeword');
    expect(cliPackageJson.exports).toHaveProperty('./eslint');
    expect(rootPackageJson.devDependencies?.safeword).toBe('workspace:*');
  });

  it('loads safeword/eslint from the repo root after dependency setup', () => {
    const result = runNodeFromRepoRoot(
      [
        "const resolved = await import.meta.resolve('safeword/eslint');",
        "const mod = await import('safeword/eslint');",
        'console.log(JSON.stringify({ resolved, hasPrettierConfig: !!mod.default?.prettierConfig }));',
      ].join('\n'),
    );

    const parsed = JSON.parse(result) as { hasPrettierConfig: boolean; resolved: string };
    expect(parsed.resolved).toContain('/packages/cli/');
    expect(parsed.hasPrettierConfig).toBe(true);
  });
});
