import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

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
