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
const CODEX_PRE_TOOL_QUALITY = nodePath.join(
  SAFEWORD_ROOT,
  'packages/cli/templates/hooks/codex/pre-tool-quality.ts',
);

/** Invoke pre-tool-quality with an Edit payload simulating a checkbox transition. */
function runEditHook(
  cwd: string,
  filePath: string,
  oldString: string,
  newString: string,
  environment: NodeJS.ProcessEnv = {},
): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
    }),
    cwd,
    env: { ...process.env, ...environment, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runCodexPatchHook(cwd: string, patch: string, gateCli: string): HookResult {
  const result = spawnSync('bun', [CODEX_PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'codex-test-session',
      tool_name: 'apply_patch',
      tool_input: { command: patch },
    }),
    cwd,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: cwd,
      SAFEWORD_PLUGIN_CLI: gateCli,
    },
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

  describe('Executable RED GREEN admission', () => {
    function gateStub(
      cwd: string,
      state: 'healthy' | 'action_required',
      expectedScenario?: string,
      expectedLedger?: string,
    ): string {
      const path = nodePath.join(cwd, 'gate-stub.mjs');
      const expectedCheck =
        expectedScenario === undefined
          ? 'true'
          : `process.argv.includes(${JSON.stringify(expectedScenario)})`;
      const ledgerCheck =
        expectedLedger === undefined
          ? 'true'
          : `process.argv.includes(${JSON.stringify(expectedLedger)})`;
      writeTestFile(
        cwd,
        'gate-stub.mjs',
        `const approved = ${state === 'healthy'} && ${expectedCheck} && ${ledgerCheck}; console.log(JSON.stringify({ schemaVersion: 1, ok: approved, changed: false, state: approved ? 'healthy' : 'action_required', findings: [], effects: { files: [], packages: [], configuration: [], network: [], destructive: [] }, errors: [], recovery: [], nextActions: [], data: { command: 'review gate executable-red', status: approved ? 'approved' : 'blocked' } }));\n`,
      );
      return path;
    }

    it('blocks an annotated GREEN transition when the receipt gate does not approve it', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('blocks an annotated GREEN transition when the receipt gate process fails', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const unavailableGate = nodePath.join(setup.cwd, 'unavailable-gate.mjs');
      writeTestFile(setup.cwd, 'unavailable-gate.mjs', 'process.exit(1);\n');

      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: unavailableGate },
      );
      expectHookDeny(result, 'could not produce a valid result');
    });

    it('allows an annotated GREEN transition when the exact receipt gate approves it', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy') },
      );
      expectHookAllow(result);
    });

    it('blocks a GREEN transition when the replacement inserts a line before the checkbox', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '\n- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('blocks a GREEN transition when the replacement also introduces its scenario heading', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '### Scenario: example\n- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('blocks checked GREEN credit restored after an unrecognized-step rename', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [x] GREEN2 def5678\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] GREEN2 def5678',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('binds a local Edit to its exact scenario when several GREEN rows remain open', () => {
      const setup = setupProject(
        [
          '### Scenario: first boundary',
          '',
          '- [x] RED abc1234',
          '- [ ] GREEN',
          '',
          '### Scenario: second boundary',
          '',
          '- [x] RED 9876fed',
          '- [ ] GREEN',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] RED 9876fed\n- [ ] GREEN',
        '- [x] RED 9876fed\n- [x] GREEN def5678',
        {
          SAFEWORD_PLUGIN_CLI: gateStub(
            setup.cwd,
            'healthy',
            'Scenario: second boundary',
            '.safeword-project/tickets/TST001/test-definitions.md',
          ),
        },
      );
      expectHookAllow(result);
    });

    it('blocks the same transition through the Codex/OpenCode apply_patch adapter', () => {
      const setup = setupProject(
        '### Scenario: exact boundary\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        '### Scenario: exact boundary',
        '',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');

      const result = runCodexPatchHook(setup.cwd, patch, gateStub(setup.cwd, 'action_required'));

      expectHookDeny(result, 'executable RED');
    });

    it('blocks a line-shifted GREEN transition through the apply_patch adapter', () => {
      const setup = setupProject(
        '### Scenario: exact boundary\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        ' ### Scenario: exact boundary',
        '+proof note',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');

      const result = runCodexPatchHook(setup.cwd, patch, gateStub(setup.cwd, 'action_required'));

      expectHookDeny(result, 'executable RED');
    });

    it('allows apply_patch only when it forwards the exact scenario and ledger', () => {
      const setup = setupProject(
        '### Scenario: exact boundary\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        ' ### Scenario: exact boundary',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');
      const gate = gateStub(
        setup.cwd,
        'healthy',
        'Scenario: exact boundary',
        '.safeword-project/tickets/TST001/test-definitions.md',
      );

      expectHookAllow(runCodexPatchHook(setup.cwd, patch, gate));
    });
  });
});
