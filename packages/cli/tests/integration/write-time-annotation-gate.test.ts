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
import { symlinkSync } from 'node:fs';
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
const PRE_TOOL_QUALITY = nodePath.join(
  SAFEWORD_ROOT,
  'packages/cli/templates/hooks/pre-tool-quality.ts',
);
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

function runReplaceAllEditHook(
  cwd: string,
  filePath: string,
  oldString: string,
  newString: string,
  environment: NodeJS.ProcessEnv,
): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: {
        file_path: filePath,
        old_string: oldString,
        new_string: newString,
        replace_all: true,
      },
    }),
    cwd,
    env: { ...process.env, ...environment, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runMultiEditHook(
  cwd: string,
  filePath: string,
  edits: { old_string: string; new_string: string }[],
  environment: NodeJS.ProcessEnv = {},
): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'MultiEdit',
      tool_input: { file_path: filePath, edits },
    }),
    cwd,
    env: { ...process.env, ...environment, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runWriteHook(
  cwd: string,
  filePath: string,
  content: string,
  environment: NodeJS.ProcessEnv = {},
): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: filePath, content },
    }),
    cwd,
    env: { ...process.env, ...environment, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runNotebookEditHook(cwd: string, filePath: string): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      hook_event_name: 'PreToolUse',
      tool_name: 'NotebookEdit',
      tool_input: { notebook_path: filePath, content: '- [x] GREEN def5678' },
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
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
  const gateDirectories: string[] = [];

  beforeEach(() => {
    projectDirectory = '';
  });

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
    for (const directory of gateDirectories.splice(0)) removeTemporaryDirectory(directory);
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

    it('ignores checkbox examples inside fenced code blocks', () => {
      const setup = setupProject(
        '### Scenario: example\n\n```markdown\n- [ ] GREEN\n```\n\n- [ ] RED\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN',
      );
      expectHookAllow(result);
    });

    it('ignores checkbox examples inside balanced tilde fences', () => {
      const setup = setupProject(
        '### Scenario: example\n\n~~~markdown\n- [ ] GREEN\n~~~\n\n- [ ] RED\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN',
      );
      expectHookAllow(result);
    });
  });

  describe('Executable RED GREEN admission', () => {
    function gateStub(
      _cwd: string,
      state: 'healthy' | 'action_required',
      expectedScenario?: string,
      expectedLedger?: string,
      relativePath = 'gate-stub.mjs',
    ): string {
      const directory = createTemporaryDirectory();
      gateDirectories.push(directory);
      const path = nodePath.join(directory, relativePath);
      const expectedCheck =
        expectedScenario === undefined
          ? 'true'
          : `process.argv.includes(${JSON.stringify(expectedScenario)})`;
      const ledgerCheck =
        expectedLedger === undefined
          ? 'true'
          : `process.argv.includes(${JSON.stringify(expectedLedger)})`;
      writeTestFile(
        directory,
        relativePath,
        `const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; }; const approved = ${state === 'healthy'} && ${expectedCheck} && ${ledgerCheck}; console.log(JSON.stringify({ schemaVersion: 1, ok: approved, changed: false, state: approved ? 'healthy' : 'action_required', findings: [], effects: { files: [], packages: [], configuration: [], network: [], destructive: [] }, errors: [], recovery: [], nextActions: [], data: { command: 'review gate executable-red', status: approved ? 'approved' : 'blocked', scenario: value('--scenario'), ledger: value('--ledger') } }));\n`,
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

    it('does not let an unclosed fence hide a GREEN transition', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '```\n- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it.each(['manual', 'live'])(
      'allows GREEN when prior %s RED evidence names a durable record',
      mode => {
        const setup = setupProject(
          `### Scenario: example\n\n- [x] RED skip: ${mode} — see timestamped work log\n- [ ] GREEN\n- [ ] REFACTOR\n`,
        );
        projectDirectory = setup.cwd;
        const result = runEditHook(
          setup.cwd,
          setup.testDefinitionsPath,
          '- [ ] GREEN',
          '- [x] GREEN skip: evidence passed',
          { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
        );
        expectHookAllow(result);
      },
    );

    it('does not treat a word beginning with manual as the manual evidence mode', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED skip: manually reproduced later\n- [ ] GREEN\n- [ ] REFACTOR\n',
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

    it('does not exempt manual evidence without a durable reference', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED skip: manual — reproduced later\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN skip: evidence passed',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('blocks retroactively relabeling checked RED as manual evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] RED abc1234',
        '- [x] RED skip: manual — see timestamped work log',
      );
      expectHookDeny(result, 'retroactively relabel');
    });

    it('allows a new manual RED record beside older executable RED evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] RED',
        '- [x] RED skip: manual — see timestamped work log',
      );
      expectHookAllow(result);
    });

    it('allows a new manual RED record inserted above older executable RED evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] RED',
        '- [x] RED skip: manual — see timestamped work log',
      );
      expectHookAllow(result);
    });

    it('blocks removing previously checked RED evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] RED abc1234',
        '- [ ] RED abc1234',
      );
      expectHookDeny(result, 'RED row that already carries historical evidence');
    });

    it('blocks moving checked RED evidence to another scenario', () => {
      const setup = setupProject(
        [
          '### Scenario: alpha',
          '',
          '- [x] RED skip: manual — see timestamped work log',
          '',
          '### Scenario: beta',
          '',
          '- [ ] RED',
          '- [ ] GREEN',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        [
          '### Scenario: alpha',
          '',
          '- [x] RED skip: manual — see timestamped work log',
          '',
          '### Scenario: beta',
          '',
          '- [ ] RED',
        ].join('\n'),
        [
          '### Scenario: alpha',
          '',
          '### Scenario: beta',
          '',
          '- [x] RED skip: manual — see timestamped work log',
        ].join('\n'),
      );
      expectHookDeny(result, 'RED row that already carries historical evidence');
    });

    it('blocks swapping historical RED evidence onto a newly checked row', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] RED abc1234\n- [ ] RED',
        '- [ ] RED abc1234\n- [x] RED',
      );
      expectHookDeny(result, 'RED row that already carries historical evidence');
    });

    it('blocks rewriting the annotation on historical RED evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] RED abc1234',
        '- [x] RED def5678',
      );
      expectHookDeny(result, 'historical evidence');
    });

    it('blocks rewriting the annotation on historical REFACTOR evidence', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [x] GREEN def5678\n- [x] REFACTOR 9876fed\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] REFACTOR 9876fed',
        '- [x] REFACTOR 123abcd',
      );
      expectHookDeny(result, 'REFACTOR row that already carries historical evidence');
    });

    it('does not let a new manual RED row exempt GREEN in the same edit', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] RED\n- [ ] GREEN',
        '- [x] RED skip: manual — see timestamped work log\n- [x] GREEN skip: observed',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('does not let an earlier MultiEdit add manual RED evidence that exempts GREEN', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runMultiEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        [
          {
            old_string: '- [ ] RED',
            new_string: '- [x] RED skip: manual — see timestamped work log',
          },
          { old_string: '- [ ] GREEN', new_string: '- [x] GREEN skip: observed' },
        ],
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required') },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('checks a whole-file Write that authors a heading and GREEN credit', () => {
      const setup = setupProject('- [ ] GREEN\n');
      projectDirectory = setup.cwd;
      const result = runWriteHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '### Scenario: authored\n\n- [x] GREEN def5678\n',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy') },
      );
      expectHookDeny(result, 'could not identify the active scenario');
    });

    it('blocks a whole-file Write that drops checked RED evidence', () => {
      const setup = setupProject('### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n');
      projectDirectory = setup.cwd;
      const result = runWriteHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '### Scenario: example\n\n- [ ] GREEN\n',
      );
      expectHookDeny(result, 'RED row that already carries historical evidence');
    });

    it('blocks transplanting checked GREEN credit onto a reopened row', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [x] GREEN def5678\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [x] GREEN def5678\n- [ ] GREEN',
        '- [ ] GREEN def5678\n- [x] GREEN 9876fed',
      );
      expectHookDeny(result, 'GREEN row that already carries historical evidence');
    });

    it('blocks ledger edits attempted through NotebookEdit', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      expectHookDeny(runNotebookEditHook(setup.cwd, setup.testDefinitionsPath), 'NotebookEdit');
    });

    it('blocks an annotated GREEN transition when the receipt gate process fails', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const unavailableDirectory = createTemporaryDirectory();
      gateDirectories.push(unavailableDirectory);
      const unavailableGate = nodePath.join(unavailableDirectory, 'unavailable-gate.mjs');
      writeTestFile(unavailableDirectory, 'unavailable-gate.mjs', 'process.exit(1);\n');

      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: unavailableGate },
      );
      expectHookDeny(result, 'could not produce a valid result');
    });

    it('reports a missing local Safeword CLI without attempting a package fetch', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: '' },
      );
      expectHookDeny(result, 'could not find its local CLI');
    });

    it('discovers the bundled CLI from CLAUDE_PLUGIN_ROOT', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const gate = gateStub(setup.cwd, 'healthy', undefined, undefined, 'runtime/cli.js');
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        {
          SAFEWORD_PLUGIN_CLI: '',
          CLAUDE_PLUGIN_ROOT: nodePath.dirname(nodePath.dirname(gate)),
        },
      );
      expectHookAllow(result);
    });

    it('rejects a project-writable CLI that claims the receipt is approved', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      writeTestFile(
        setup.cwd,
        'packages/cli/src/cli.ts',
        `console.log(JSON.stringify({ state: 'healthy', data: { status: 'approved', scenario: 'Scenario: example', ledger: '.safeword-project/tickets/TST001/test-definitions.md' } }));\n`,
      );
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: nodePath.join(setup.cwd, 'packages/cli/src/cli.ts') },
      );
      expectHookDeny(result, 'could not find its local CLI');
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

    it('gates every GREEN transition produced by replace_all', () => {
      const setup = setupProject(
        [
          '### Scenario: first',
          '',
          '- [x] RED abc1234',
          '- [ ] GREEN',
          '',
          '### Scenario: second',
          '',
          '- [x] RED 9876fed',
          '- [ ] GREEN',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const result = runReplaceAllEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        {
          SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy', 'Scenario: first'),
        },
      );
      expectHookDeny(result, 'receipt check did not approve this scenario');
    });

    it('does not bypass the canonical ledger gate through a symlink alias', () => {
      const setup = setupProject(
        '### Scenario: example\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const alias = nodePath.join(setup.cwd, 'ledger-notes.md');
      symlinkSync(setup.testDefinitionsPath, alias);
      const result = runEditHook(setup.cwd, alias, '- [ ] GREEN', '- [x] GREEN def5678', {
        SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'action_required'),
      });
      expectHookDeny(result, 'without either prior manual/live evidence');
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

    it('blocks a GREEN transition that tries to adopt an approved scenario heading', () => {
      const setup = setupProject(
        '### Scenario: original\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '### Scenario: approved elsewhere\n- [x] GREEN def5678',
        {
          SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy', 'Scenario: approved elsewhere'),
        },
      );
      expectHookDeny(result, 'executable RED');
    });

    it('binds later MultiEdit transitions to content produced by earlier edits', () => {
      const setup = setupProject(
        '### Scenario: original\n\n- [x] RED abc1234\n- [ ] GREEN\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runMultiEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        [
          {
            old_string: '### Scenario: original',
            new_string: '### Scenario: renamed boundary',
          },
          {
            old_string: '- [x] RED abc1234\n- [ ] GREEN',
            new_string: '- [x] RED abc1234\n- [x] GREEN def5678',
          },
        ],
        {
          SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy', 'Scenario: renamed boundary'),
        },
      );
      expectHookAllow(result);
    });

    it('blocks GREEN when MultiEdit creates a duplicate approved scenario heading', () => {
      const setup = setupProject(
        [
          '### Scenario: approved',
          '',
          '- [x] RED abc1234',
          '- [ ] GREEN',
          '- [ ] REFACTOR',
          '',
          '### Scenario: other',
          '',
          '- [x] RED 987fedc',
          '- [ ] GREEN',
          '- [ ] REFACTOR',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const result = runMultiEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        [
          { old_string: '### Scenario: other', new_string: '### Scenario: approved' },
          {
            old_string: '- [x] RED 987fedc\n- [ ] GREEN',
            new_string: '- [x] RED 987fedc\n- [x] GREEN def5678',
          },
        ],
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy', 'Scenario: approved') },
      );
      expectHookDeny(result, 'historical evidence');
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

    it('allows a rename-only edit after GREEN has been checked', () => {
      const setup = setupProject(
        '### Scenario: original\n\n- [x] RED abc1234\n- [x] GREEN def5678\n- [ ] REFACTOR\n',
      );
      projectDirectory = setup.cwd;
      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '### Scenario: original',
        '### Scenario: approved elsewhere',
      );
      expectHookAllow(result);
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

    it('rejects an approved scenario supplied only by ambiguous apply_patch context', () => {
      const setup = setupProject(
        [
          '### Scenario: approved elsewhere',
          '',
          '- [x] RED abc1234',
          '- [ ] GREEN',
          '',
          '### Scenario: actual boundary',
          '',
          '- [x] RED 9876fed',
          '- [ ] GREEN',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        ' ### Scenario: approved elsewhere',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');

      const result = runCodexPatchHook(
        setup.cwd,
        patch,
        gateStub(setup.cwd, 'healthy', 'Scenario: approved elsewhere'),
      );

      expectHookDeny(result, 'could not identify the active scenario');
    });

    it('rejects a disk-derived apply_patch binding when the scenario heading is duplicated', () => {
      const setup = setupProject(
        [
          '### Scenario: duplicate',
          '',
          '- [x] RED abc1234',
          '',
          '### Scenario: duplicate',
          '',
          '- [ ] GREEN',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        ' ### Scenario: duplicate',
        ' non-contiguous context',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');

      const result = runCodexPatchHook(
        setup.cwd,
        patch,
        gateStub(setup.cwd, 'healthy', 'Scenario: duplicate'),
      );

      expectHookDeny(result, 'could not identify the active scenario');
    });

    it('does not carry manual evidence across non-contiguous apply_patch context', () => {
      const setup = setupProject(
        [
          '### Scenario: alpha',
          '',
          '- [x] RED skip: manual — see timestamped work log',
          '',
          '### Scenario: beta',
          '',
          '- [x] RED abc1234',
          '- [ ] GREEN',
          '',
        ].join('\n'),
      );
      projectDirectory = setup.cwd;
      const patch = [
        '*** Begin Patch',
        `*** Update File: ${setup.testDefinitionsPath}`,
        '@@',
        ' - [x] RED skip: manual — see timestamped work log',
        '@@',
        '-- [ ] GREEN',
        '+- [x] GREEN def5678',
        '*** End Patch',
      ].join('\n');

      const result = runCodexPatchHook(setup.cwd, patch, gateStub(setup.cwd, 'action_required'));

      expectHookDeny(result, 'executable RED');
    });

    it('binds GREEN beneath a level-four scenario heading', () => {
      const setup = setupProject(
        '#### Scenario: nested boundary\n\n- [x] RED abc1234\n- [ ] GREEN\n',
      );
      projectDirectory = setup.cwd;

      const result = runEditHook(
        setup.cwd,
        setup.testDefinitionsPath,
        '- [ ] GREEN',
        '- [x] GREEN def5678',
        { SAFEWORD_PLUGIN_CLI: gateStub(setup.cwd, 'healthy', 'Scenario: nested boundary') },
      );

      expectHookAllow(result);
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
