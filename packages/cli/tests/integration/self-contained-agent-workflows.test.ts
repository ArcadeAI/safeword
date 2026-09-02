import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { installOpenCodeProfile } from '../../src/opencode/profile.js';
import { VERSION } from '../../src/version.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  SKIP_INSTALL_ENV,
} from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CLI = nodePath.join(REPO_ROOT, 'packages/cli/dist/cli.js');
const SOURCE_CLI = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const CODEX_PLUGIN = nodePath.join(REPO_ROOT, 'packages/cli/codex-plugin');
const CLAUDE_PLUGIN = nodePath.join(REPO_ROOT, 'plugin');
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

function enrolledProject(): string {
  const project = temporaryDirectory();
  initGitRepo(project);
  mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(project, '.safeword/SAFEWORD.md'), '# enrolled\n');
  writeFileSync(nodePath.join(project, 'README.md'), '# fixture\n');
  return project;
}

function expectNoProjectRuntime(project: string): void {
  for (const relativePath of [
    '.safeword/hooks',
    '.safeword/skills',
    '.safeword/scripts',
    '.safeword/guides',
  ]) {
    expect(existsSync(nodePath.join(project, relativePath))).toBe(false);
  }
}

function commitProject(project: string): void {
  expect(spawnSync('git', ['add', '.'], { cwd: project }).status).toBe(0);
  expect(
    spawnSync('git', ['commit', '--no-verify', '-m', 'fixture'], { cwd: project }).status,
  ).toBe(0);
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function installCodexRuntime(): string {
  const codexHome = temporaryDirectory();
  const pluginRoot = nodePath.join(codexHome, 'plugins/cache/safeword/safeword', VERSION);
  mkdirSync(nodePath.dirname(pluginRoot), { recursive: true });
  cpSync(CODEX_PLUGIN, pluginRoot, { recursive: true });
  return codexHome;
}

function codexAuditCommand(): string {
  const skill = readFileSync(nodePath.join(CODEX_PLUGIN, 'skills/audit/SKILL.md'), 'utf8');
  const line = skill
    .split('\n')
    .find(candidate => candidate.includes('project audit-scope)'))
    ?.trim();
  if (line === undefined) throw new Error('Generated Codex audit command is missing');
  return line;
}

function installLegacyAuditRuntime(project: string, fixture: 'complete' | 'partially missing') {
  const helper = nodePath.join(project, '.safeword/hooks/lib/audit-scope.sh');
  const marker = nodePath.join(project, 'legacy-runtime-used');
  mkdirSync(nodePath.dirname(helper), { recursive: true });
  if (fixture === 'complete') {
    writeFileSync(
      helper,
      `audit_scope_initialize() { printf used > ${JSON.stringify(marker)}; return 9; }\n`,
    );
  } else {
    writeFileSync(nodePath.join(project, '.safeword/hooks/partial.txt'), 'legacy fragment\n');
  }
  return marker;
}

function runCodexAudit(project: string, codexHome: string) {
  return spawnSync(
    'bash',
    [
      '-c',
      [
        codexAuditCommand(),
        'source_status=$?',
        '[ "$source_status" -eq 0 ] || exit "$source_status"',
        'audit_scope_initialize "$PROJECT_DIR"',
        'scope_status=$?',
        String.raw`printf "mode=%s\nsha=%s\nfiles=%s\n" "$AUDIT_SCOPE_MODE" "$AUDIT_BASE_SHA" "$AUDIT_CHANGED_FILES"`,
        'exit "$scope_status"',
      ].join('; '),
    ],
    {
      cwd: project,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        PROJECT_DIR: project,
        SAFEWORD_AUDIT_BASE_REF: 'main',
      },
      encoding: 'utf8',
    },
  );
}

function installReviewerAndPackageShim(): { bin: string; log: string } {
  const root = createTrustedReviewerDirectory('safeword-authority-reviewer-');
  const bin = nodePath.join(root, 'bin');
  const log = nodePath.join(root, 'review.log');
  mkdirSync(bin, { recursive: true });
  const reviewer = nodePath.join(bin, 'codex');
  writeFileSync(
    reviewer,
    `#!/bin/sh
set -eu
if [ "\${1-}" = "--version" ]; then printf 'codex 1.0.0\\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')
printf 'codex\\n' >> "$SAFEWORD_REVIEW_LOG"
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"codex","verdict":"approve","summary":"reviewed","findings":[]}\\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(reviewer, 0o755);
  const bunx = nodePath.join(bin, 'bunx');
  writeFileSync(
    bunx,
    `#!/bin/sh
set -eu
if [ "\${1-}" = "--bun" ]; then shift; fi
case "\${1-}" in safeword@*) shift ;; *) exit 64 ;; esac
exec bun "$SAFEWORD_TEST_CLI" "$@"
`,
    { mode: 0o755 },
  );
  chmodSync(bunx, 0o755);
  return { bin, log };
}

function runnableReviewCommand(skillPath: string): string {
  const line = readFileSync(skillPath, 'utf8')
    .split('\n')
    .find(candidate => candidate.includes('review run quality-review ['))
    ?.trim();
  if (line === undefined)
    throw new Error(`Generated quality-review command is missing: ${skillPath}`);
  return line
    .replace('[--context path/to/evidence] ', '')
    .replace('changed-file [more-changed-files...]', 'review-input.md');
}

function runReviewWorkflow(
  project: string,
  command: string,
  options: { bin: string; log: string; extraEnvironment?: NodeJS.ProcessEnv },
) {
  return spawnSync('bash', ['-c', command], {
    cwd: project,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      PATH: `${options.bin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
      PROJECT_DIR: project,
      SAFEWORD_AGENT_RUNTIME: 'claude',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_LOG: options.log,
      SAFEWORD_TEST_CLI: CLI,
      ...options.extraEnvironment,
    },
  });
}

type Host = 'Codex' | 'Claude Code' | 'OpenCode' | 'Cursor';

type StateWorkflow = { command: string; env: NodeJS.ProcessEnv };

function commandFromSkill(skillPath: string, marker: string, host: Host): string {
  const command = readFileSync(skillPath, 'utf8')
    .split('\n')
    .findLast(line => line.includes(marker))
    ?.trim();
  if (command === undefined) throw new Error(`${host} state command is missing`);
  return command;
}

function codexStateWorkflow(): StateWorkflow {
  return {
    command: commandFromSkill(
      nodePath.join(CODEX_PLUGIN, 'skills/verify/SKILL.md'),
      'project record-skill-invocation',
      'Codex',
    ),
    env: { CODEX_HOME: installCodexRuntime() },
  };
}

function claudeStateWorkflow(): StateWorkflow {
  return {
    command: commandFromSkill(
      nodePath.join(CLAUDE_PLUGIN, 'skills/verify/SKILL.md'),
      'runtime/hooks/record-skill-invocation.ts',
      'Claude Code',
    ),
    env: { CLAUDE_PLUGIN_ROOT: CLAUDE_PLUGIN },
  };
}

function openCodeStateWorkflow(): StateWorkflow {
  const profile = temporaryDirectory();
  expect(installOpenCodeProfile(profile).state).toBe('changed');
  const { bin } = installReviewerAndPackageShim();
  return {
    command: commandFromSkill(
      nodePath.join(profile, 'skills/safeword-verify/SKILL.md'),
      'project record-skill-invocation',
      'OpenCode',
    ),
    env: { PATH: `${bin}:${process.env.PATH ?? ''}`, SAFEWORD_TEST_CLI: CLI },
  };
}

function cursorStateWorkflow(project: string): StateWorkflow {
  const installed = spawnSync(
    'bun',
    [
      SOURCE_CLI,
      'install',
      '--agents=cursor',
      '--no-modify',
      '--no-input',
      '--cwd',
      project,
      '--json',
    ],
    // Only fixture setup skips application packages; the workflow below runs normally.
    { cwd: project, encoding: 'utf8', env: { ...process.env, ...SKIP_INSTALL_ENV } },
  );
  expect(installed.status, installed.stderr || installed.stdout).toBe(0);
  return {
    command: commandFromSkill(
      nodePath.join(project, '.safeword/skills/verify/SKILL.md'),
      '.safeword/hooks/record-skill-invocation.ts',
      'Cursor',
    ),
    env: {},
  };
}

function stateWorkflow(host: Host, project: string): StateWorkflow {
  const factories: Record<Host, () => StateWorkflow> = {
    Codex: codexStateWorkflow,
    'Claude Code': claudeStateWorkflow,
    OpenCode: openCodeStateWorkflow,
    Cursor: () => cursorStateWorkflow(project),
  };
  return factories[host]();
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

afterAll(cleanupTrustedReviewerDirectories);

describe('self-contained generated workflows', () => {
  it.each(['complete', 'partially missing'] as const)(
    'executes the pinned Codex audit beside %s legacy project runtime',
    fixture => {
      const project = enrolledProject();
      const knowledge = nodePath.join(project, 'knowledge.md');
      writeFileSync(knowledge, 'authored knowledge\n');
      const legacyMarker = installLegacyAuditRuntime(project, fixture);
      writeFileSync(nodePath.join(project, 'first.txt'), 'base\n');
      commitProject(project);
      const mergeBase = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: project,
        encoding: 'utf8',
      }).stdout.trim();
      spawnSync('git', ['branch', '-M', 'main'], { cwd: project });
      spawnSync('git', ['switch', '-c', 'feature'], { cwd: project });
      writeFileSync(nodePath.join(project, 'first.txt'), 'changed\n');
      writeFileSync(nodePath.join(project, 'second.txt'), 'added\n');
      const knowledgeDigest = sha256(knowledge);
      const codexHome = installCodexRuntime();

      const result = runCodexAudit(project, codexHome);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(`sha=${mergeBase}`);
      expect(result.stdout).toContain('files=first.txt\nsecond.txt');
      expect(codexAuditCommand()).toContain(
        `/plugins/cache/safeword/safeword/${VERSION}/runtime/cli.js`,
      );
      expect(existsSync(legacyMarker)).toBe(false);
      expect(sha256(knowledge)).toBe(knowledgeDigest);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/install|dependenc/iu);
    },
  );

  it('fails closed when the pinned Codex package is unavailable beside legacy project runtime', () => {
    const project = enrolledProject();
    const knowledge = nodePath.join(project, 'knowledge.md');
    writeFileSync(knowledge, 'authored knowledge\n');
    const legacyMarker = installLegacyAuditRuntime(project, 'complete');
    commitProject(project);
    const emptyCodexHome = temporaryDirectory();
    const knowledgeDigest = sha256(knowledge);

    const result = runCodexAudit(project, emptyCodexHome);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(`/safeword/${VERSION}/runtime/cli.js`);
    expect(existsSync(legacyMarker)).toBe(false);
    expect(sha256(knowledge)).toBe(knowledgeDigest);
    expect(output).not.toMatch(/safeword install|bun install|dependency change/iu);
  });

  it('executes the generated Claude quality-review workflow through the bundled plugin', () => {
    const project = enrolledProject();
    writeFileSync(nodePath.join(project, 'review-input.md'), 'bounded review input\n');
    commitProject(project);
    const reviewer = installReviewerAndPackageShim();
    const command = runnableReviewCommand(
      nodePath.join(CLAUDE_PLUGIN, 'skills/quality-review/SKILL.md'),
    );

    const result = runReviewWorkflow(project, command, {
      ...reviewer,
      extraEnvironment: { CLAUDE_PLUGIN_ROOT: CLAUDE_PLUGIN },
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: { actual_reviewer: 'codex', reviewer_output: { verdict: 'approve' } },
    });
    expect(readFileSync(reviewer.log, 'utf8')).toBe('codex\n');
    expect(command).toContain('${CLAUDE_PLUGIN_ROOT}"/runtime/hooks/run-review.ts');
    expect(`${result.stdout}${result.stderr}`).not.toMatch(
      /install|CODEX_HOME|OPENCODE_CONFIG_DIR/iu,
    );
    expectNoProjectRuntime(project);
  });

  it('executes the installed OpenCode quality-review workflow through its pinned profile runtime', () => {
    const project = enrolledProject();
    writeFileSync(nodePath.join(project, 'review-input.md'), 'bounded review input\n');
    commitProject(project);
    const profile = temporaryDirectory();
    expect(installOpenCodeProfile(profile).state).toBe('changed');
    const reviewer = installReviewerAndPackageShim();
    const command = runnableReviewCommand(
      nodePath.join(profile, 'skills/safeword-quality-review/SKILL.md'),
    );

    const result = runReviewWorkflow(project, command, reviewer);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'healthy',
      data: { actual_reviewer: 'codex', reviewer_output: { verdict: 'approve' } },
    });
    expect(readFileSync(reviewer.log, 'utf8')).toBe('codex\n');
    expect(command).toContain(`bunx --bun safeword@${VERSION}`);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(
      /install|CLAUDE_PLUGIN_ROOT|CODEX_HOME/iu,
    );
    expectNoProjectRuntime(project);
  });

  it.each(['Codex', 'Claude Code', 'OpenCode', 'Cursor'] as const)(
    'creates missing state through the %s workflow authority',
    host => {
      const project = enrolledProject();
      const workflow = stateWorkflow(host, project);
      rmSync(nodePath.join(project, '.project'), { recursive: true, force: true });
      rmSync(nodePath.join(project, '.safeword-project'), { recursive: true, force: true });
      rmSync(nodePath.join(project, '.gitignore'), { force: true });

      const result = spawnSync('bash', ['-c', workflow.command], {
        cwd: project,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: project,
          CLAUDE_SESSION_ID: 'state-session',
          PROJECT_DIR: project,
          SAFEWORD_NO_UPDATE_CHECK: '1',
          ...workflow.env,
        },
      });

      const statePath = nodePath.join(project, '.project/skill-invocations.log');
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(readFileSync(nodePath.join(project, '.project/.gitignore'), 'utf8')).toBe(
        '/skill-invocations.log\n',
      );
      expect(readFileSync(statePath, 'utf8')).toContain('verify');
      const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        cwd: project,
        encoding: 'utf8',
      }).stdout;
      expect(status).not.toContain('skill-invocations.log');
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/safeword install|bun install/iu);
    },
  );
});
