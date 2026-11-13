/**
 * Integration Test: ticket gates honor a configured namespace root.
 *
 * A project that sets `paths.projectRoot` (here `knowledge/`) keeps its tickets
 * under `knowledge/tickets/`. The edit-path gates must treat those files
 * exactly as they treat `.project/tickets/` — before this fix they matched only
 * the default and legacy roots, so every gate silently skipped such projects.
 */

import { execSync, spawnSync } from 'node:child_process';
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

const ROOT = 'knowledge';
const SESSION = 'custom-root-session';

function runHook(script: string, event: string, cwd: string, toolName: string, filePath: string) {
  return spawnSync('bun', [script], {
    input: JSON.stringify({
      session_id: SESSION,
      hook_event_name: event,
      tool_name: toolName,
      tool_input: { file_path: filePath },
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
      'PreToolUse',
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
      'PreToolUse',
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
      'PreToolUse',
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
      'PostToolUse',
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
      'PreToolUse',
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, `${ROOT}/tickets/099-test/notes.md`),
    );
    expect(ticketEdit.status).toBe(0);
    expect(ticketEdit.stdout).toBe('');

    const codeEdit = runHook(
      PRE_TOOL_QUALITY,
      'PreToolUse',
      projectDirectory,
      'Edit',
      nodePath.join(projectDirectory, 'src/app.ts'),
    );
    expect(JSON.parse(codeEdit.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });
});
