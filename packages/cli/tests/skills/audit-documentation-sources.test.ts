import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractFencedBashBlock } from '../helpers/fenced-bash.js';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
];

function readAuditSurface(relativePath: string): string {
  return readFileSync(nodePath.join(ROOT, relativePath), 'utf8');
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

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
}

function auditToolStubBody(command: string): string {
  if (command === 'bunx') {
    return 'if [ "$1" = "knip" ]; then echo "[fake-knip] cwd=$PWD args=$@"; else echo "[fake-bunx] $@"; fi';
  }
  if (command === 'bun') {
    return String.raw`case "$1" in
  */resolve-namespace-root.ts)
    if [ -n "$3" ]; then
      if [ -n "$4" ]; then domain_basename="$4"; else domain_basename="$3.md"; fi
      printf '%s\n' "$2/.project/$domain_basename"
    else
      printf '%s\n' "$2/.project"
    fi
    ;;
  */packages/cli/src/cli.ts) [ "$2" = "feature-directories" ] && printf '%s\n' "$PWD/features" ;;
  *) echo "[fake-bun] $@" ;;
esac`;
  }
  return `echo "[fake-${command}] $@"`;
}

function writeAuditToolStubs(binDirectory: string): void {
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
    writeExecutable(binDirectory, command, auditToolStubBody(command));
  }
  writeExecutable(
    binDirectory,
    'yarn',
    'if [ "$1" = "--version" ]; then echo "4.9.0"; else echo "[fake-yarn] $@"; fi',
  );
}

function writeAuditScopeHelper(projectDirectory: string): void {
  const sourcePath = nodePath.join(ROOT, 'packages/cli/templates/hooks/lib/audit-scope.sh');
  if (existsSync(sourcePath)) {
    writeProjectFile(
      projectDirectory,
      '.safeword/hooks/lib/audit-scope.sh',
      readFileSync(sourcePath, 'utf8'),
    );
  }
}

function applyWorktreeChanges(
  projectDirectory: string,
  changedFiles: Record<string, string>,
  deletedFiles: string[] = [],
  typeChangedFiles: Record<string, string> = {},
): void {
  const changedFileEntries = Object.entries(changedFiles);
  for (const [relativePath, content] of changedFileEntries) {
    writeProjectFile(projectDirectory, relativePath, content);
  }
  for (const relativePath of deletedFiles) {
    rmSync(nodePath.join(projectDirectory, relativePath));
  }
  const typeChangedFileEntries = Object.entries(typeChangedFiles);
  for (const [relativePath, target] of typeChangedFileEntries) {
    const absolutePath = nodePath.join(projectDirectory, relativePath);
    rmSync(absolutePath);
    symlinkSync(target, absolutePath);
  }
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

    writeAuditToolStubs(binDirectory);
    writeAuditScopeHelper(projectDirectory);
    const missingCommands = options.missingCommands ?? [];
    for (const command of missingCommands) {
      rmSync(nodePath.join(binDirectory, command), { force: true });
    }

    const result = spawnSync('bash', ['-c', extractFencedBashBlock(auditSkillContent, 2)], {
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

function runDiffScopedAuditAutomation(options: {
  baseRefOverride?: string;
  baselineFiles: Record<string, string>;
  changedFiles: Record<string, string>;
  blockOrdinal?: number;
  blockMarker?: string;
  deletedFiles?: string[];
  includeOriginMain?: boolean;
  staleLocalMain?: boolean;
  stackedBaseFiles?: Record<string, string>;
  scopeRequest?: 'repository';
  typeChangedFiles?: Record<string, string>;
}): { stdout: string; stderr: string; status: number } {
  const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-audit-diff-'));
  const binDirectory = nodePath.join(projectDirectory, 'fake-bin');
  const auditSkillContent = readAuditSurface('packages/cli/templates/skills/audit/SKILL.md');

  try {
    mkdirSync(binDirectory);
    for (const [relativePath, content] of Object.entries(options.baselineFiles)) {
      writeProjectFile(projectDirectory, relativePath, content);
    }
    git(projectDirectory, 'init', '--initial-branch=main', '--quiet');
    git(projectDirectory, 'config', 'user.email', 'test@example.com');
    git(projectDirectory, 'config', 'user.name', 'Test User');
    git(projectDirectory, 'add', '.');
    git(projectDirectory, 'commit', '--quiet', '--message', 'base');
    const baseSha = git(projectDirectory, 'rev-parse', 'HEAD');

    if (options.includeOriginMain) {
      git(projectDirectory, 'update-ref', 'refs/remotes/origin/main', baseSha);
    }
    if (options.staleLocalMain) {
      writeProjectFile(projectDirectory, 'src/stale-main.ts', 'export const stale = true;\n');
      git(projectDirectory, 'add', 'src/stale-main.ts');
      git(projectDirectory, 'commit', '--quiet', '--message', 'stale local main');
    }
    let featureBaseSha = baseSha;
    if (options.stackedBaseFiles) {
      git(projectDirectory, 'checkout', '--quiet', '-b', 'stack-base', baseSha);
      applyWorktreeChanges(projectDirectory, options.stackedBaseFiles);
      git(projectDirectory, 'add', '.');
      git(projectDirectory, 'commit', '--quiet', '--message', 'stack base');
      featureBaseSha = git(projectDirectory, 'rev-parse', 'HEAD');
    }
    git(projectDirectory, 'checkout', '--quiet', '-b', 'feature', featureBaseSha);

    applyWorktreeChanges(
      projectDirectory,
      options.changedFiles,
      options.deletedFiles,
      options.typeChangedFiles,
    );
    writeAuditToolStubs(binDirectory);
    writeAuditScopeHelper(projectDirectory);

    const result = spawnSync(
      'bash',
      [
        '-c',
        extractFencedBashBlock(auditSkillContent, options.blockMarker ?? options.blockOrdinal ?? 2),
      ],
      {
        cwd: projectDirectory,
        env: {
          ...process.env,
          AUDIT_SCOPE_REQUEST: options.scopeRequest ?? 'diff',
          CLAUDE_PROJECT_DIR: projectDirectory,
          PATH: `${binDirectory}:/usr/bin:/bin`,
          SAFEWORD_AUDIT_BASE_REF: options.baseRefOverride ?? '',
        },
        encoding: 'utf8',
      },
    );

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

  it.each(AUDIT_SURFACES)(
    '%s leaves generated inventory out of narrative requirements',
    relativePath => {
      const content = readAuditSurface(relativePath);

      expect(content).toContain('generated document owns the structural inventory');
      expect(content).toContain('Drifted layer→dir (error)');
      expect(content).toContain('[E007] Drifted layer→dir');
      expect(content).not.toContain('Missing (error)');
      expect(content).not.toContain('[E006] Structural gap');
      expect(content).not.toContain('Drifted layer→dir (warn)');
      expect(content).not.toContain('[W008] Structural gap');
      expect(content).not.toContain('[W009] Drifted layer→dir');
    },
  );
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
  it('keeps dogfood agent audit skills synchronized with the shipped template', () => {
    const template = readAuditSurface('packages/cli/templates/skills/audit/SKILL.md');

    expect(readAuditSurface('.claude/skills/audit/SKILL.md')).toBe(template);
  });

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
      'venv/lib/python/pyproject.toml': '[project]\nname = "ignored"\n',
      'vendor/dependency/go.mod': 'module example.com/vendor\n',
      'target/debug/dependency/Cargo.toml': '[package]\nname = "ignored"\nversion = "0.1.0"\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Go dead-code — ./apps/engine');
    expect(result.stdout).not.toContain('./node_modules/dependency');
    expect(result.stdout).not.toContain('./.venv/lib/python');
    expect(result.stdout).not.toContain('./venv/lib/python');
    expect(result.stdout).not.toContain('./vendor/dependency');
    expect(result.stdout).not.toContain('./target/debug/dependency');
  });

  it('excludes dependency and virtual-environment trees from recursive Python dead-code checks', () => {
    const result = runAuditAutomation({
      'apps/coordinator/pyproject.toml': '[project]\nname = "coordinator"\n',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '[fake-deadcode] . --exclude .git */.git node_modules */node_modules .venv */.venv venv */venv vendor */vendor target */target',
    );
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

describe('audit diff scope', () => {
  const javascriptProject = {
    'package.json': JSON.stringify({ name: 'fixture', packageManager: 'npm@11.0.0' }),
    '.dependency-cruiser.cjs': 'module.exports = { forbidden: [] };\n',
    'src/changed.ts': 'export const value = 1;\n',
    'README.md': '# Fixture\n',
  };

  it('prefers origin/main and reports only the feature diff when local main is stale', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: javascriptProject,
      changedFiles: { 'src/changed.ts': 'export const value = 2;\n' },
      includeOriginMain: true,
      staleLocalMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Audit scope: origin/main');
    expect(result.stdout).toContain('src/changed.ts');
    expect(result.stdout).not.toContain('src/stale-main.ts');
    expect(result.stdout).toMatch(/\[fake-bunx\] depcruise .*--affected [0-9a-f]{40}/);
    expect(result.stdout).toContain(
      'Knip: skipped in diff scope — run a repository audit for whole-workspace unused-code discovery',
    );
    expect(result.stdout).toContain(
      'Duplication: skipped in diff scope — run a repository audit for cross-file clone discovery',
    );
  });

  it('falls back to local main when no origin/main ref exists', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: javascriptProject,
      changedFiles: { 'src/changed.ts': 'export const value = 2;\n' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Audit scope: main');
  });

  it('uses an explicit stacked branch base without including the lower stack', () => {
    const result = runDiffScopedAuditAutomation({
      baseRefOverride: 'stack-base',
      baselineFiles: javascriptProject,
      changedFiles: { 'src/changed.ts': 'export const value = 3;\n' },
      includeOriginMain: true,
      stackedBaseFiles: {
        'src/changed.ts': 'export const value = 2;\n',
        'src/lower-stack.ts': 'export const lowerStack = true;\n',
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Audit scope: stack-base');
    expect(result.stdout).toContain('src/changed.ts');
    expect(result.stdout).not.toContain('src/lower-stack.ts');
  });

  it.each(['missing-stack-base', '--help'])(
    'fails closed when the explicit audit base ref does not resolve: %s',
    baseReferenceOverride => {
      const result = runDiffScopedAuditAutomation({
        baseRefOverride: baseReferenceOverride,
        baselineFiles: javascriptProject,
        changedFiles: { 'src/changed.ts': 'export const value = 2;\n' },
        includeOriginMain: true,
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        `SAFEWORD_AUDIT_BASE_REF does not resolve to a Git commit: ${baseReferenceOverride}`,
      );
    },
  );

  it('does not run code-quality analyzers for a documentation-only diff', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: javascriptProject,
      changedFiles: { 'README.md': '# Updated fixture\n' },
      includeOriginMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Code quality scope: no changed source or manifest files');
    expect(result.stdout).not.toContain('[fake-bunx] depcruise');
    expect(result.stdout).not.toContain('[fake-knip]');
    expect(result.stdout).not.toContain('[fake-bunx] jscpd');
  });

  it('retains a whole-repository audit when the user explicitly requests one', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: javascriptProject,
      changedFiles: { 'README.md': '# Updated fixture\n' },
      includeOriginMain: true,
      scopeRequest: 'repository',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'Audit scope: repository (explicit user request; full audit retained)',
    );
    expect(result.stdout).toContain('Knip — repository root');
  });

  it('keeps deleted and type-changed paths out of analyzers but visible for reference review', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        'docs/removed.md': '# Removed\n',
        'docs/type-change.md': '# Type change\n',
      },
      changedFiles: {},
      deletedFiles: ['docs/removed.md'],
      includeOriginMain: true,
      typeChangedFiles: { 'docs/type-change.md': '../README.md' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Reference review scope:');
    expect(result.stdout).toContain('docs/removed.md');
    expect(result.stdout).toContain('docs/type-change.md');
    expect(result.stdout).toContain('Code quality scope: no changed source or manifest files');
    expect(result.stdout).not.toContain('[fake-bunx] depcruise');
  });

  it('skips unrelated domain-doc drift in a diff audit', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        'packages/cli/src/cli.ts': 'export {};\n',
        '.project/surfaces.md': '## Known\n',
        'features/unrelated.feature': '@surface.missing\nFeature: unrelated\n',
      },
      changedFiles: { 'README.md': '# Updated fixture\n' },
      blockMarker: 'domain-docs-check',
      includeOriginMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('[E008] Surface drift');
  });

  it('scans only changed feature inputs when surface definitions are unchanged', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        'packages/cli/src/cli.ts': 'export {};\n',
        '.project/surfaces.md': '## Known\n',
        'features/unrelated.feature': '@surface.missing\nFeature: unrelated\n',
      },
      changedFiles: { 'features/changed.feature': '@surface.known\nFeature: changed\n' },
      blockMarker: 'domain-docs-check',
      includeOriginMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('@surface.missing');
  });

  it('reports surface drift from a changed feature file', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        'packages/cli/src/cli.ts': 'export {};\n',
        '.project/surfaces.md': '## Known\n',
      },
      changedFiles: { 'features/invalid.feature': '@surface.missing\nFeature: invalid\n' },
      blockMarker: 'domain-docs-check',
      includeOriginMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[E008] Surface drift: @surface.missing');
  });

  it('reports persona drift from a changed spec file', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        '.project/personas.md': '## Designer (DES)\n',
      },
      changedFiles: { '.project/tickets/fixture/spec.md': '**Persona:** (GM)\n' },
      blockMarker: 'domain-docs-check',
      includeOriginMain: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[E009] Persona drift: code GM');
  });

  it('runs domain-doc drift checks in an explicit repository audit', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        'packages/cli/src/cli.ts': 'export {};\n',
        '.project/surfaces.md': '## Known surface\n',
        'features/unrelated.feature': '@surface.missing\nFeature: unrelated\n',
      },
      changedFiles: { 'README.md': '# Updated fixture\n' },
      blockMarker: 'domain-docs-check',
      includeOriginMain: true,
      scopeRequest: 'repository',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[E008] Surface drift');
  });

  it('checks unchanged learning files in an explicit repository audit', () => {
    const result = runDiffScopedAuditAutomation({
      baselineFiles: {
        ...javascriptProject,
        '.project/learnings/without-covers.md': '# Learning\n\nMissing Covers line\n',
      },
      changedFiles: { 'README.md': '# Updated fixture\n' },
      blockOrdinal: 3,
      includeOriginMain: true,
      scopeRequest: 'repository',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[W006] Missing Covers: line on line 3');
  });
});
