import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const hooks = path.resolve(__dirname, '../../templates/hooks');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('Python post-edit checks preserve a pending import even when Ruff fixes are configured', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'post-edit-language-'));
  roots.push(root);
  mkdirSync(path.join(root, 'bin'));
  mkdirSync(path.join(root, '.safeword'));
  const original = 'import pending\nuntouched={"x":1}\n';
  const file = path.join(root, 'pending.py');
  writeFileSync(file, original);
  writeFileSync(path.join(root, '.safeword/ruff.toml'), 'fix = true\n');
  const tool = path.join(root, 'bin/ruff');
  // Mock only Ruff's external process. A configured fix also writes unless
  // explicitly disabled, even when --fix is omitted from the invocation.
  writeFileSync(
    tool,
    '#!/bin/sh\ncase "$*" in *--no-fix*--no-fix-only*|format*--check*) ;; *) echo rewritten > pending.py;; esac\ncase "$1" in check) echo pending-import-diagnostic;; format) echo python-format-diagnostic;; esac\nexit 1\n',
  );
  chmodSync(tool, 0o755);
  const result = spawnSync('bun', [path.join(hooks, 'post-tool-lint.ts')], {
    cwd: root,
    input: JSON.stringify({ tool_input: { file_path: file } }),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
    },
    timeout: 15_000,
  });
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(file, 'utf8')).toBe(original);
  expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain(
    'pending-import-diagnostic',
  );
  expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain(
    'python-format-diagnostic',
  );
});
