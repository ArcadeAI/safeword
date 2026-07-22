import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  '.agents/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
];

function readAuditSurface(relativePath: string): string {
  return readFileSync(nodePath.join(ROOT, relativePath), 'utf8');
}

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

function runAuditAutomation(
  files: Record<string, string>,
  options: { missingCommands?: string[] } = {},
): {
  stdout: string;
  stderr: string;
  status: number;
} {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-audit-'));
  const binDirectory = nodePath.join(projectDirectory, 'fake-bin');
  const auditSkillContent = readFileSync(
    nodePath.join(ROOT, 'packages/cli/templates/skills/audit/SKILL.md'),
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
      'cargo-clippy',
      'golangci-lint',
      'deadcode',
    ]) {
      if (options.missingCommands?.includes(command)) continue;
      const body =
        command === 'bunx'
          ? 'if [ "$1" = "knip" ]; then echo "[fake-knip] cwd=$PWD args=$@"; else echo "[fake-bunx] $@"; fi'
          : `echo "[fake-${command}] $@"`;
      writeExecutable(binDirectory, command, body);
    }
    writeExecutable(
      binDirectory,
      'yarn',
      'if [ "$1" = "--version" ]; then echo "4.9.0"; else echo "[fake-yarn] $@"; fi',
    );

    const result = spawnSync('bash', ['-c', extractBashBlock(auditSkillContent, 2)], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDirectory,
        // Keep host-installed analyzers out of the fixture so omitted tools
        // exercise the skill's loud manual-evidence path deterministically.
        PATH: `${binDirectory}:/usr/bin:/bin`,
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
    const content = readAuditSurface(relativePath);

    expect(content).toContain('If `docs.sources` is absent, prompt the user');
    expect(content).toContain('set `docs.sources: []`');
    expect(content).toContain('If `docs.sources: []` is configured, do not prompt');
    expect(content).toContain('Always report docs coverage');
  });

  it.each(AUDIT_SURFACES)('%s reports documentation drift as an error', relativePath => {
    const content = readAuditSurface(relativePath);

    expect(content).toContain('Gap (error)');
    expect(content).toContain('Documentation drift is never a warning');
    expect(content).toContain('[E004] Documentation drift');
    expect(content).toContain('[E005] Dependency gap');
    expect(content).not.toContain('Gap (warn)');
    expect(content).not.toContain('[W004] Gap');
  });

  it.each(AUDIT_SURFACES)('%s reports structural documentation gaps as errors', relativePath => {
    const content = readAuditSurface(relativePath);

    expect(content).toContain('Missing (error)');
    expect(content).toContain('Drifted layer→dir (error)');
    expect(content).toContain('[E006] Structural gap');
    expect(content).toContain('[E007] Drifted layer→dir');
    expect(content).not.toContain('Missing (warn)');
    expect(content).not.toContain('Drifted layer→dir (warn)');
    expect(content).not.toContain('[W008] Structural gap');
    expect(content).not.toContain('[W009] Drifted layer→dir');
  });
});

describe('audit test quality severity', () => {
  it.each(AUDIT_SURFACES)('%s reports sampled test-quality issues as errors', relativePath => {
    const content = readAuditSurface(relativePath);
    const testQualitySection = content
      .split('### 4. Test Quality Review', 2)[1]
      ?.split('### 5. Project Documentation Checks', 2)[0];

    expect(testQualitySection).toBeDefined();
    expect(testQualitySection).not.toContain('| warn');
    expect(testQualitySection).toContain('- Issues found: N (E errors)');
    expect(testQualitySection).toContain('[E] file.test.ts:42');
    expect(testQualitySection).not.toContain('[E/W]');
    expect(testQualitySection).not.toContain('[W] file.test.ts');
  });
});

describe('audit installed-project stack awareness', () => {
  it.each(AUDIT_SURFACES)('%s gates JavaScript checks on package.json evidence', relativePath => {
    const content = readAuditSurface(relativePath);

    expect(content).toContain('JavaScript-specific checks');
    expect(content).toContain('[ -f package.json ]');
    expect(content).toContain('skip JavaScript');
  });

  it.each(AUDIT_SURFACES)(
    '%s chooses outdated dependency commands from the project package manager',
    relativePath => {
      const content = readAuditSurface(relativePath);

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
    const content = readAuditSurface(relativePath);

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

  it('runs native checks from nested monorepo manifests', () => {
    const result = runAuditAutomation({
      'apps/engine/go.mod': 'module example.com/engine\n',
      'apps/usage/go.mod': 'module example.com/usage\n',
      'apps/coordinator/pyproject.toml': '[project]\nname = "coordinator"\n',
      'apps/worker/toolkits/example/requirements.txt': 'requests\n',
      'services/api/Cargo.toml': '[package]\nname = "api"\nversion = "0.1.0"\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Go dead-code — ./apps/engine');
    expect(result.stdout).toContain('Go dead-code — ./apps/usage');
    expect(result.stdout).toContain('Python dead-code — ./apps/coordinator');
    expect(result.stdout).toContain('Python dead-code — ./apps/worker');
    expect(result.stdout).toContain('Go outdated dependencies — ./apps/engine');
    expect(result.stdout).toContain('Go outdated dependencies — ./apps/usage');
    expect(result.stdout).toContain('[fake-golangci-lint] run --enable unused');
    expect(result.stdout).toContain('[fake-deadcode] .');
    expect(result.stdout).toContain(
      '[fake-cargo] clippy --all-targets --all-features -- -D warnings',
    );
  });

  it('makes absent native stacks and missing native tools explicit', () => {
    const noManifests = runAuditAutomation({});
    expect(noManifests.stdout).toContain('No Go modules found');
    expect(noManifests.stdout).toContain('No Python projects found');
    expect(noManifests.stdout).toContain('No Rust crates found');

    const missingTools = runAuditAutomation(
      {
        'apps/engine/go.mod': 'module example.com/engine\n',
        'apps/coordinator/pyproject.toml': '[project]\nname = "coordinator"\n',
      },
      { missingCommands: ['deadcode', 'golangci-lint'] },
    );
    expect(missingTools.stdout).toContain(
      'Manual evidence required: golangci-lint not installed — Go dead-code checks skipped',
    );
    expect(missingTools.stdout).toContain(
      'Manual evidence required: deadcode not installed — Python dead-code checks skipped',
    );
  });

  it('ignores manifests in dependency and virtual-environment trees', () => {
    const result = runAuditAutomation({
      'apps/engine/go.mod': 'module example.com/engine\n',
      'node_modules/dependency/go.mod': 'module example.com/dependency\n',
      '.venv/lib/python/pyproject.toml': '[project]\nname = "ignored"\n',
      'vendor/dependency/go.mod': 'module example.com/vendor\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Go dead-code — ./apps/engine');
    expect(result.stdout).not.toContain('./node_modules/dependency');
    expect(result.stdout).not.toContain('./.venv/lib/python');
    expect(result.stdout).not.toContain('./vendor/dependency');
  });

  it('runs Knip from each workspace-local configuration when the root has none', () => {
    const result = runAuditAutomation({
      'package.json': JSON.stringify({ name: 'monorepo' }),
      'apps/dashboard/package.json': JSON.stringify({ name: 'dashboard' }),
      'apps/dashboard/knip.config.ts': 'export default {};\n',
      'apps/admin/package.json': JSON.stringify({ name: 'admin' }),
      'apps/admin/knip.json': '{}\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Knip — ./apps/admin (knip.json)');
    expect(result.stdout).toContain('Knip — ./apps/dashboard (knip.config.ts)');
    expect(result.stdout).toContain('apps/admin args=knip --config knip.json');
    expect(result.stdout).toContain('apps/dashboard args=knip --config knip.config.ts');
    expect(result.stdout).not.toContain('Knip — repository root');
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
