import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

describe('SessionStart lint configuration warnings', () => {
  const projectDirectories: string[] = [];

  afterEach(() => {
    for (const directory of projectDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  const runHook = (files: Record<string, string>): string => {
    const projectDirectory = mkdtempSync(path.join(tmpdir(), 'session-lint-check-'));
    projectDirectories.push(projectDirectory);
    mkdirSync(path.join(projectDirectory, '.safeword'));

    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(projectDirectory, name), content);
    }

    const script = path.resolve(import.meta.dirname, '../../templates/hooks/session-lint-check.ts');

    return execFileSync('bun', [script], {
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
      encoding: 'utf8',
    });
  };

  it('stays silent in a Go-only worktree without a root package.json', () => {
    const output = runHook({
      'go.mod': 'module example.com/service\n',
      'main.go': 'package main\n',
    });

    expect(output).toBe('');
  });

  it('retains ESLint and Prettier setup warnings for a JavaScript project', () => {
    const output = runHook({
      'package.json': '{}\n',
      'index.js': 'console.log("hello");\n',
    });

    expect(output).toContain('ESLint config not found');
    expect(output).toContain('Prettier config not found');
    expect(output).toContain('ESLint not in package.json');
    expect(output).toContain('Prettier not in package.json');
  });

  it('does not emit missing-config warnings when JavaScript tooling is configured', () => {
    const output = runHook({
      'package.json': '{"devDependencies":{"eslint":"^10.0.0","prettier":"^3.0.0"}}\n',
      'eslint.config.js': 'export default [];\n',
      '.prettierrc': '{}\n',
    });

    expect(output).toBe('');
  });
});
