import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  'packages/cli/templates/commands/audit.md',
  '.agents/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
  '.cursor/commands/audit.md',
];

function extractBashBlock(content: string, ordinal: number): string {
  const blocks = content
    .matchAll(/```bash\n[\s\S]*?\n```/g)
    .map(match => match[0].replace(/^```bash\n/, '').replace(/\n```$/, ''))
    .toArray();
  const block = blocks[ordinal - 1];
  if (!block) throw new Error(`Missing bash block ${ordinal}`);
  return block;
}

function writeProjectFile(projectDirectory: string, relativePath: string, content: string): void {
  const absolutePath = nodePath.join(projectDirectory, relativePath);
  mkdirSync(nodePath.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function writeExecutable(directory: string, name: string, body: string): void {
  const executablePath = nodePath.join(directory, name);
  writeFileSync(executablePath, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(executablePath, 0o755);
}

function runAuditAutomation(files: Record<string, string>): {
  stdout: string;
  stderr: string;
  status: number;
} {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-audit-'));
  const binDirectory = nodePath.join(projectDirectory, 'fake-bin');
  const commandContent = readFileSync(
    nodePath.join(ROOT, 'packages/cli/templates/commands/audit.md'),
    'utf8',
  );

  try {
    mkdirSync(binDirectory);
    for (const [relativePath, content] of Object.entries(files)) {
      writeProjectFile(projectDirectory, relativePath, content);
    }

    for (const command of [
      'bunx',
      'bun',
      'npm',
      'pnpm',
      'uv',
      'poetry',
      'pipenv',
      'python',
      'pip',
      'go',
      'cargo',
      'golangci-lint',
      'deadcode',
    ]) {
      writeExecutable(binDirectory, command, `echo "[fake-${command}] $@"`);
    }
    writeExecutable(
      binDirectory,
      'yarn',
      'if [ "$1" = "--version" ]; then echo "4.9.0"; else echo "[fake-yarn] $@"; fi',
    );

    const result = spawnSync('bash', ['-c', extractBashBlock(commandContent, 2)], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      },
      encoding: 'utf8',
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      status: result.status ?? 0,
    };
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

describe('audit documentation source guidance', () => {
  it.each(AUDIT_SURFACES)('%s prompts only when docs.sources is absent', relativePath => {
    const content = readFileSync(nodePath.join(ROOT, relativePath), 'utf8');

    expect(content).toContain('If `docs.sources` is absent, prompt the user');
    expect(content).toContain('set `docs.sources: []`');
    expect(content).toContain('If `docs.sources: []` is configured, do not prompt');
    expect(content).toContain('Always report docs coverage');
  });
});

describe('audit installed-project stack awareness', () => {
  it.each(AUDIT_SURFACES)('%s gates JavaScript checks on package.json evidence', relativePath => {
    const content = readFileSync(nodePath.join(ROOT, relativePath), 'utf8');

    expect(content).toContain('JavaScript-specific checks');
    expect(content).toContain('[ -f package.json ]');
    expect(content).toContain('skip JavaScript');
  });

  it.each(AUDIT_SURFACES)(
    '%s chooses outdated dependency commands from the project package manager',
    relativePath => {
      const content = readFileSync(nodePath.join(ROOT, relativePath), 'utf8');

      expect(content.toLowerCase()).toContain('detect package manager');
      expect(content).toContain('bun outdated');
      expect(content).toContain('npm outdated');
      expect(content).toContain('pnpm outdated');
      expect(content).toContain('run_yarn_outdated_check');
      expect(content).toContain('Yarn Classic');
      expect(content).toContain('Yarn modern');
      expect(content).toContain('Manual evidence required');
    },
  );

  it.each(AUDIT_SURFACES)('%s audits supported non-JavaScript stacks', relativePath => {
    const content = readFileSync(nodePath.join(ROOT, relativePath), 'utf8');

    expect(content).toContain('Python-specific checks');
    expect(content).toContain('uv pip list --outdated');
    expect(content).toContain('poetry show --outdated');
    expect(content).toContain('pipenv update --outdated');
    expect(content).toContain('Go-specific checks');
    expect(content).toContain('go list -m -u all');
    expect(content).toContain('Rust-specific checks');
    expect(content).toContain('cargo clippy');
    expect(content).toContain('cargo update --dry-run');
  });

  it('does not run Yarn Classic outdated command for Yarn modern projects', () => {
    const result = runAuditAutomation({
      'package.json': JSON.stringify({ packageManager: 'yarn@4.9.0' }),
      'yarn.lock': '',
      '.yarnrc.yml': 'nodeLinker: node-modules\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Yarn modern detected');
    expect(result.stdout).toContain('Manual evidence required');
    expect(result.stdout).not.toContain('[fake-yarn] outdated');
  });
});
