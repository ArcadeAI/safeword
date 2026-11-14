/**
 * Integration Test: ticket gates honor a configured namespace root.
 *
 * A project that sets `paths.projectRoot` (here `knowledge/`) keeps its tickets
 * under `knowledge/tickets/`. The edit-path gates must treat those files
 * exactly as they treat `.project/tickets/` — before this fix they matched only
 * the default and legacy roots, so every gate silently skipped such projects.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeGateConfig,
  writeTestFile,
} from '../helpers';

const PACKAGE_ROOT = nodePath.resolve(import.meta.dirname, '../..');
const POST_TOOL_QUALITY = nodePath.join(PACKAGE_ROOT, 'templates/hooks/post-tool-quality.ts');
const PRE_TOOL_QUALITY = nodePath.join(PACKAGE_ROOT, 'templates/hooks/pre-tool-quality.ts');
const POST_TOOL_WORK_LOG = nodePath.join(PACKAGE_ROOT, 'templates/hooks/post-tool-work-log.ts');

const ROOT = 'knowledge';
const SESSION = 'custom-root-session';

function runHook(
  script: string,
  cwd: string,
  toolName: string,
  filePath: string,
  extraInput: Record<string, unknown> = {},
) {
  return spawnSync('bun', [script], {
    input: JSON.stringify({
      session_id: SESSION,
      hook_event_name: script === PRE_TOOL_QUALITY ? 'PreToolUse' : 'PostToolUse',
      tool_name: toolName,
      tool_input: { file_path: filePath, ...extraInput },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

function createProject(): string {
  const directory = createTemporaryDirectory();
  writeGateConfig(directory, { reviewGate: false, paths: { projectRoot: ROOT } });
  initGitRepo(directory);
  writeTestFile(directory, `${ROOT}/.gitkeep`, '');
  writeTestFile(directory, '.safeword/SAFEWORD.md', '# enrolled\n');
  execSync('git add . && git commit -m "init"', { cwd: directory, stdio: 'pipe' });
  return directory;
}

describe('ticket gates under a custom paths.projectRoot', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('intake gate denies test-definitions.md while ticket scope fields are missing', () => {
    writeTestFile(
      projectDirectory,
      `${ROOT}/tickets/099-test/ticket.md`,
      ['---', 'id: 099', 'type: task', 'phase: intake', '---', '# Test'].join('\n'),
    );

    const result = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Write',
      nodePath.join(projectDirectory, `${ROOT}/tickets/099-test/test-definitions.md`),
    );

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    const reason: string = output.hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain('scope');
    expect(reason).toContain('out_of_scope');
    expect(reason).toContain('done_when');
  });

  it('intake gate also resolves a project-relative ticket path', () => {
    const result = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Write',
      `${ROOT}/tickets/099-test/test-definitions.md`,
    );

    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain(
      'Cannot create test definitions',
    );
  });

  it('a lookalike directory outside the configured root is not gated', () => {
    const result = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Write',
      nodePath.join(projectDirectory, `not-${ROOT}/tickets/099-test/test-definitions.md`),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('editing a ticket artifact binds the session to its in-progress ticket', () => {
    writeTestFile(
      projectDirectory,
      `${ROOT}/tickets/099-test/ticket.md`,
      ['---', 'id: 099', 'type: task', 'status: in_progress', '---', '# Test'].join('\n'),
    );
    writeTestFile(projectDirectory, `${ROOT}/tickets/099-test/spec.md`, '# Spec\n');

    const result = runHook(
      POST_TOOL_QUALITY,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, `${ROOT}/tickets/099-test/spec.md`),
    );

    expect(result.status).toBe(0);
    const state = JSON.parse(
      readTestFile(projectDirectory, `${ROOT}/quality-state-${SESSION}.json`),
    );
    expect(state.activeTicket).toBe('099');
  });

  it('ticket files under the configured root stay exempt from the LOC gate', () => {
    const head = execSync('git rev-parse --short HEAD', {
      cwd: projectDirectory,
      encoding: 'utf8',
    }).trim();
    const lockedState = {
      locSinceCommit: 500,
      lastCommitHash: head,
      gate: 'loc',
    };
    writeTestFile(
      projectDirectory,
      `${ROOT}/quality-state-${SESSION}.json`,
      JSON.stringify(lockedState),
    );

    const ticketEdit = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, `${ROOT}/tickets/099-test/notes.md`),
    );
    expect(ticketEdit.status).toBe(0);
    expect(ticketEdit.stdout).toBe('');

    const codeEdit = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, 'src/app.ts'),
    );
    expect(JSON.parse(codeEdit.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('ledger gate refuses a NotebookEdit of test-definitions.md', () => {
    const ledger = `${ROOT}/tickets/099-test/test-definitions.md`;
    writeTestFile(projectDirectory, ledger, '# Test definitions\n');

    const result = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'NotebookEdit',
      nodePath.join(projectDirectory, ledger),
    );

    const output = JSON.parse(result.stdout);
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain(
      'R/G/R ledger through NotebookEdit',
    );
  });

  it('a phase edit to ticket.md is stamped in its work log', () => {
    const ticket = `${ROOT}/tickets/099-test/ticket.md`;
    writeTestFile(projectDirectory, ticket, '---\nid: 099\nphase: define-behavior\n---\n# Test\n');

    const result = runHook(
      POST_TOOL_WORK_LOG,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, ticket),
      { old_string: 'phase: intake', new_string: 'phase: define-behavior' },
    );

    expect(result.status).toBe(0);
    expect(readTestFile(projectDirectory, ticket)).toContain('Phase: intake → define-behavior');
  });

  it('editing a learning under the configured root arms the novel-claim nudge', () => {
    const learning = nodePath.join(projectDirectory, `${ROOT}/learnings/caching.md`);
    writeTestFile(projectDirectory, `${ROOT}/learnings/caching.md`, '# Caching\n');

    runHook(POST_TOOL_QUALITY, projectDirectory, 'Edit', learning);

    const state = JSON.parse(
      readTestFile(projectDirectory, `${ROOT}/quality-state-${SESSION}.json`),
    );
    expect(state.learningsNudgesPending).toEqual([learning]);
  });
});

describe('configured-root edge cases', () => {
  let projectDirectory: string;

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('a repo-root paths.projectRoot does not exempt code from the LOC gate', () => {
    projectDirectory = createTemporaryDirectory();
    writeGateConfig(projectDirectory, { reviewGate: false, paths: { projectRoot: '.' } });
    initGitRepo(projectDirectory);
    writeTestFile(projectDirectory, '.safeword/SAFEWORD.md', '# enrolled\n');
    execSync('git add . && git commit -m "init"', { cwd: projectDirectory, stdio: 'pipe' });
    const head = execSync('git rev-parse --short HEAD', {
      cwd: projectDirectory,
      encoding: 'utf8',
    }).trim();
    writeTestFile(
      projectDirectory,
      `quality-state-${SESSION}.json`,
      JSON.stringify({ locSinceCommit: 500, lastCommitHash: head, gate: 'loc' }),
    );

    const codeEdit = runHook(
      PRE_TOOL_QUALITY,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, 'src/app.ts'),
    );

    expect(JSON.parse(codeEdit.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('stamps the work log of a custom-root ticket inside a nested worktree', () => {
    projectDirectory = createProject();
    // The launch checkout uses the default root; only the worktree configures one.
    writeGateConfig(projectDirectory, { reviewGate: false, paths: {} });
    const worktree = nodePath.join(projectDirectory, '.claude/worktrees/w');
    writeTestFile(worktree, '.git', 'gitdir: elsewhere\n');
    writeTestFile(worktree, '.safeword/SAFEWORD.md', '# enrolled\n');
    writeGateConfig(worktree, { paths: { projectRoot: ROOT } });
    const ticket = nodePath.join(worktree, `${ROOT}/tickets/099-test/ticket.md`);
    writeTestFile(
      worktree,
      `${ROOT}/tickets/099-test/ticket.md`,
      '---\nphase: define-behavior\n---\n',
    );

    runHook(POST_TOOL_WORK_LOG, projectDirectory, 'Edit', ticket, {
      old_string: 'phase: intake',
      new_string: 'phase: define-behavior',
    });

    expect(readFileSync(ticket, 'utf8')).toContain('Phase: intake → define-behavior');
  });

  it('ticket edits under the configured root do not count toward the LOC gate', () => {
    projectDirectory = createProject();
    const ticket = `${ROOT}/tickets/099-test/notes.md`;
    writeTestFile(projectDirectory, ticket, '# Notes\n');
    execSync('git add . && git commit -m "ticket"', { cwd: projectDirectory, stdio: 'pipe' });
    writeTestFile(projectDirectory, ticket, `# Notes\n${'line\n'.repeat(450)}`);

    runHook(POST_TOOL_QUALITY, projectDirectory, 'Edit', nodePath.join(projectDirectory, ticket));

    const state = JSON.parse(
      readTestFile(projectDirectory, `${ROOT}/quality-state-${SESSION}.json`),
    );
    expect(state.locSinceCommit).toBe(0);
    expect(state.gate).toBeNull();
  });

  it('resolves a relative work-log target against the session cwd, not the launch checkout', () => {
    projectDirectory = createProject();
    const relativeTicket = `${ROOT}/tickets/099-test/ticket.md`;
    const launchContent = '---\nphase: define-behavior\n---\n';
    writeTestFile(projectDirectory, relativeTicket, launchContent);
    const worktree = nodePath.join(projectDirectory, '.claude/worktrees/w');
    writeTestFile(worktree, '.git', 'gitdir: elsewhere\n');
    writeTestFile(worktree, '.safeword/SAFEWORD.md', '# enrolled\n');
    writeGateConfig(worktree, { paths: { projectRoot: ROOT } });
    writeTestFile(worktree, relativeTicket, launchContent);

    spawnSync('bun', [POST_TOOL_WORK_LOG], {
      input: JSON.stringify({
        session_id: SESSION,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        cwd: worktree,
        tool_input: {
          file_path: relativeTicket,
          old_string: 'phase: intake',
          new_string: 'phase: define-behavior',
        },
      }),
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    expect(readTestFile(worktree, relativeTicket)).toContain('Phase: intake → define-behavior');
    expect(readTestFile(projectDirectory, relativeTicket)).toBe(launchContent);
  });

  it('a symlinked configured root is excluded from the LOC count by its real path', () => {
    projectDirectory = createTemporaryDirectory();
    writeGateConfig(projectDirectory, { reviewGate: false, paths: { projectRoot: ROOT } });
    initGitRepo(projectDirectory);
    writeTestFile(projectDirectory, '.safeword/SAFEWORD.md', '# enrolled\n');
    mkdirSync(nodePath.join(projectDirectory, 'docs'));
    symlinkSync('docs', nodePath.join(projectDirectory, ROOT));
    writeTestFile(projectDirectory, 'docs/tickets/099-test/notes.md', '# Notes\n');
    execSync('git add . && git commit -m "init"', { cwd: projectDirectory, stdio: 'pipe' });
    writeTestFile(
      projectDirectory,
      'docs/tickets/099-test/notes.md',
      `# Notes\n${'line\n'.repeat(450)}`,
    );

    runHook(
      POST_TOOL_QUALITY,
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, `${ROOT}/tickets/099-test/notes.md`),
    );

    const state = JSON.parse(readTestFile(projectDirectory, `docs/quality-state-${SESSION}.json`));
    expect(state.locSinceCommit).toBe(0);
  });

  it('arms the learnings nudge for a relative edit made from inside the configured root', () => {
    projectDirectory = createProject();
    writeTestFile(projectDirectory, `${ROOT}/learnings/caching.md`, '# Caching\n');

    spawnSync('bun', [POST_TOOL_QUALITY], {
      input: JSON.stringify({
        session_id: SESSION,
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        cwd: nodePath.join(projectDirectory, ROOT),
        tool_input: { file_path: 'learnings/caching.md' },
      }),
      cwd: projectDirectory,
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
    });

    const state = JSON.parse(
      readTestFile(projectDirectory, `${ROOT}/quality-state-${SESSION}.json`),
    );
    expect(state.learningsNudgesPending).toEqual(['learnings/caching.md']);
  });
});
