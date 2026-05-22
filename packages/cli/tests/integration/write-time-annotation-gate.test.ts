/**
 * Integration tests for the write-time SHA-or-skip annotation gate
 * (ticket J7VBGJ, Rule 1).
 *
 * Exercises the pre-tool-quality.ts hook against Edit calls that flip
 * `- [ ] STEP` → `- [x] STEP <annotation>` in a ticket's test-definitions.md.
 *
 * Rule: a [x] transition must carry either a SHA or `skip: <non-empty reason>`.
 * Pre-existing bare [x] (written before this feature shipped) is silently
 * allowed — the validation is forward-looking.
 */

import { spawnSync } from 'node:child_process';
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

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PRE_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/pre-tool-quality.ts');

/** Invoke pre-tool-quality with an Edit payload simulating a checkbox transition. */
function runEditHook(
  cwd: string,
  filePath: string,
  oldString: string,
  newString: string,
): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Build a temp project with a ticket folder + test-definitions.md initial content. */
function setupProject(initialTestDefinitions: string): {
  cwd: string;
  testDefinitionsPath: string;
} {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);

  // Ticket folder + ticket.md so the artifact-prerequisite gate (which fires on
  // CREATE of test-definitions.md) doesn't interfere with our EDIT tests.
  writeTestFile(
    cwd,
    '.safeword-project/tickets/TST001/ticket.md',
    [
      '---',
      'id: TST001',
      'slug: write-time-gate-fixture',
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

  const testDefinitionsPath = nodePath.join(
    cwd,
    '.safeword-project/tickets/TST001/test-definitions.md',
  );
  writeTestFile(
    cwd,
    '.safeword-project/tickets/TST001/test-definitions.md',
    initialTestDefinitions,
  );
  return { cwd, testDefinitionsPath };
}

describe('write-time annotation gate', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = '';
  });

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  describe('Rule 1: Marking a TDD checkbox requires a SHA or skip reason', () => {
    it('Scenario 1: valid SHA annotation passes the write-time hook', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] RED',
        '- [x] RED abc1234',
      );
      expectHookAllow(result);
    });

    it('Scenario 2: bare checkmark transition is blocked', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN',
      );
      expectHookDeny(result, 'GREEN');
    });

    it('Scenario 3: skip with non-empty reason passes', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] REFACTOR',
        '- [x] REFACTOR skip: trivial — no structural change',
      );
      expectHookAllow(result);
    });

    it('Scenario 4: skip with empty reason is blocked at write-time', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] REFACTOR',
        '- [x] REFACTOR skip:',
      );
      expectHookDeny(result, 'skip');
    });

    it('Scenario 5: skip with whitespace-only reason is blocked at write-time', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] REFACTOR',
        '- [x] REFACTOR skip:    ',
      );
      expectHookDeny(result, 'skip');
    });

    it('Scenario 6: pre-existing bare [x] is silently allowed on unrelated edits', () => {
      // File already has `- [x] RED` (legacy, no annotation). An unrelated edit
      // (changing a heading) must not trigger the gate — only [ ] → [x]
      // transitions are validated.
      const setup = setupProject(
        '### Scenario: legacy\n\n- [x] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '### Scenario: legacy',
        '### Scenario: legacy (renamed)',
      );
      expectHookAllow(result);
    });
  });
});
