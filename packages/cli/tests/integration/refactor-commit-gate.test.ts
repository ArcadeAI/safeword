/**
 * Integration tests for the commit-time REFACTOR gate
 * (ticket J7VBGJ, Rule 2 after scope reduction).
 *
 * Exercises the pre-tool-quality.ts hook against Bash(git commit *) calls
 * when the active TDD step is REFACTOR. The only file-path rule that
 * survived the scope reduction: REFACTOR commits must not touch test
 * files (prevents test-behavior drift during cleanup).
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, it } from 'vitest';

import {
  createTemporaryDirectory,
  expectHookAllow,
  expectHookDeny,
  type HookResult,
  initGitRepo,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

/* eslint-disable unicorn/no-null -- State file uses JSON null values by design */

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');

/** Invoke pre-tool-quality with a Bash(git commit) payload. */
function runBashCommitHook(cwd: string, command: string, sessionId = 'test-session'): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Build a temp project with:
 *  - a ticket in implement phase
 *  - test-definitions.md with R/G done, REFACTOR pending (so parser-derived step = refactor)
 *  - quality-state.json pointing at the ticket
 *  - the specified files staged in git
 */
function setupRefactorProject(stagedFiles: Record<string, string>): {
  cwd: string;
} {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  writeTestFile(cwd, 'init.txt', 'init');
  execSync('git add . && git commit -m "init"', { cwd, stdio: 'pipe' });

  // Ticket folder
  writeTestFile(
    cwd,
    '.safeword-project/tickets/TST002/ticket.md',
    [
      '---',
      'id: TST002',
      'slug: refactor-gate-fixture',
      'type: feature',
      'phase: implement',
      'status: in_progress',
      '---',
      '',
      'Scope: fixture',
      'Out of Scope: nothing',
      'Done When: tests pass',
    ].join('\n'),
  );

  // test-definitions.md showing REFACTOR is the current step
  writeTestFile(
    cwd,
    '.safeword-project/tickets/TST002/test-definitions.md',
    [
      '## Scenario: example',
      '',
      '- [x] RED abc1234',
      '- [x] GREEN def5678',
      '- [ ] REFACTOR',
      '',
    ].join('\n'),
  );

  // State file with activeTicket set
  writeTestFile(
    cwd,
    '.safeword-project/quality-state-test-session.json',
    JSON.stringify(
      {
        locSinceCommit: 0,
        lastCommitHash: 'abc123',
        activeTicket: 'TST002',
        gate: null,
        locAtLastReview: 0,
        recentFailures: [],
        incrementedPatterns: [],
      },
      null,
      2,
    ),
  );

  // Write + stage the requested files
  for (const [path, content] of Object.entries(stagedFiles)) {
    writeTestFile(cwd, path, content);
  }
  execSync(`git add ${Object.keys(stagedFiles).join(' ')}`, { cwd, stdio: 'pipe' });

  return { cwd };
}

describe('commit-time REFACTOR gate', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = '';
  });

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('Scenario 7: REFACTOR-step commit touching only app code passes', () => {
    const setup = setupRefactorProject({
      'src/foo.ts': 'export const foo = 1;',
      'src/bar.ts': 'export const bar = 2;',
    });
    projectDirectory = setup.cwd;
    const result = runBashCommitHook(setup.cwd, 'git commit -m "refactor: clean up foo"');
    expectHookAllow(result);
  });

  it('Scenario 8: REFACTOR-step commit touching any test file is blocked', () => {
    const setup = setupRefactorProject({
      'src/foo.ts': 'export const foo = 1;',
      'tests/foo.test.ts': 'import { foo } from "../src/foo";',
    });
    projectDirectory = setup.cwd;
    const result = runBashCommitHook(setup.cwd, 'git commit -m "refactor: clean up foo"');
    expectHookDeny(result, 'tests/foo.test.ts');
  });
});

/* eslint-enable unicorn/no-null */
