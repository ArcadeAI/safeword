import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const LINT_SURFACES = [
  'packages/cli/templates/skills/lint/SKILL.md',
  'packages/cli/templates/commands/lint.md',
  '.claude/skills/lint/SKILL.md',
  '.cursor/commands/lint.md',
  'packages/cli/codex-plugin/skills/lint/SKILL.md',
] as const;

function extractLintBlock(relativePath: string): string {
  const content = readFileSync(nodePath.join(REPOSITORY_ROOT, relativePath), 'utf8');
  const block = /```bash\n([\s\S]*?)\n```/.exec(content)?.[1];
  if (block === undefined) throw new Error(`Missing lint bash block in ${relativePath}`);
  return block;
}

function writeExecutable(directory: string, name: string, body: string): void {
  const executablePath = nodePath.join(directory, name);
  writeFileSync(executablePath, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(executablePath, 0o755);
}

function runLintInstructions(
  relativePath: string,
  options: { hasGoManifest?: boolean; hasTypeScript?: boolean; lintStatus?: number } = {},
): { status: number | null; bunCommands: string[]; goCommands: string[] } {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-lint-skill-'));
  const binDirectory = nodePath.join(projectDirectory, 'fake-bin');
  const bunCommandsPath = nodePath.join(projectDirectory, 'bun-commands.log');
  const goCommandsPath = nodePath.join(projectDirectory, 'go-commands.log');

  try {
    mkdirSync(binDirectory);
    writeFileSync(nodePath.join(projectDirectory, 'package.json'), '{"scripts":{}}\n');
    if (options.hasTypeScript)
      writeFileSync(nodePath.join(projectDirectory, 'tsconfig.json'), '{}\n');
    if (options.hasGoManifest)
      writeFileSync(nodePath.join(projectDirectory, 'go.mod'), 'module example\n');

    writeExecutable(
      binDirectory,
      'bun',
      String.raw`printf '%s\n' "$*" >> "${bunCommandsPath}"
if [ "$*" = "run lint" ]; then exit ${options.lintStatus ?? 0}; fi`,
    );
    writeExecutable(
      binDirectory,
      'bunx',
      String.raw`printf 'bunx %s\n' "$*" >> "${bunCommandsPath}"`,
    );
    writeExecutable(
      binDirectory,
      'golangci-lint',
      String.raw`printf '%s\n' "$*" >> "${goCommandsPath}"`,
    );

    const result = spawnSync('bash', ['-c', extractLintBlock(relativePath)], {
      cwd: projectDirectory,
      env: { ...process.env, PATH: `${binDirectory}:/usr/bin:/bin` },
      encoding: 'utf8',
    });

    return {
      status: result.status,
      bunCommands: existsSync(bunCommandsPath)
        ? readFileSync(bunCommandsPath, 'utf8').trim().split('\n').filter(Boolean)
        : [],
      goCommands: existsSync(goCommandsPath)
        ? readFileSync(goCommandsPath, 'utf8').trim().split('\n').filter(Boolean)
        : [],
    };
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

describe('lint instructions exit status (#1701)', () => {
  it.each(LINT_SURFACES)('%s succeeds for a JavaScript-only project', relativePath => {
    const result = runLintInstructions(relativePath);

    expect(result.status).toBe(0);
    expect(result.bunCommands).toEqual(['run lint', 'run format --if-present']);
    expect(result.goCommands).toEqual([]);
  });

  it.each(LINT_SURFACES)('%s preserves a lint failure after running later checks', relativePath => {
    const result = runLintInstructions(relativePath, {
      hasTypeScript: true,
      lintStatus: 1,
    });

    expect(result.status).toBe(1);
    expect(result.bunCommands).toEqual([
      'run lint',
      'run format --if-present',
      'bunx tsc --noEmit',
    ]);
  });

  it.each(LINT_SURFACES)('%s preserves an interrupted lint status', relativePath => {
    const result = runLintInstructions(relativePath, { lintStatus: 130 });

    expect(result.status).toBe(130);
  });

  it.each(LINT_SURFACES)(
    '%s runs the existing Go commands when go.mod is present',
    relativePath => {
      const result = runLintInstructions(relativePath, { hasGoManifest: true });

      expect(result.status).toBe(0);
      expect(result.goCommands).toEqual(['run --fix ./...', 'fmt ./...']);
    },
  );
});
