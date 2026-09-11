import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

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

describe('dogfood source worktree package resolution (470)', () => {
  it('pins local runtimes and Python verification tools in repository-owned files', () => {
    const packageJson = readJson(nodePath.join(repoRoot, 'package.json')) as {
      packageManager?: string;
    };
    const mise = parse(readFileSync(nodePath.join(repoRoot, 'mise.toml'), 'utf8')) as {
      tools?: Record<string, string>;
      settings?: { python?: { uv_venv_auto?: string } };
    };
    const pyproject = parse(readFileSync(nodePath.join(repoRoot, 'pyproject.toml'), 'utf8')) as {
      'dependency-groups'?: { dev?: string[] };
      tool?: { uv?: { 'required-version'?: string } };
    };

    expect(mise.tools).toEqual({
      bun: packageJson.packageManager?.replace('bun@', ''),
      node: '24.18.1',
      go: '1.25',
      python: '3.12',
      uv: '0.12.9',
    });
    expect(pyproject.tool?.uv?.['required-version']).toBe(`==${mise.tools?.uv}`);
    expect(mise.settings?.python?.uv_venv_auto).toBe('source');
    expect(pyproject['dependency-groups']?.dev).toEqual([
      'deadcode==2.4.1',
      'import-linter==2.14',
      'mypy==2.3.1',
      'ruff==0.16.5',
    ]);

    const workflow = readFileSync(nodePath.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('version-file: pyproject.toml');
    expect(workflow).toContain('uv sync --frozen');
    expect(workflow).not.toContain('requirements-ci.txt');
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
