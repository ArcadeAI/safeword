/**
 * Integration tests for the Bash-channel ledger write gate (ticket W42G34,
 * issue #644 G3).
 *
 * Exercises the pre-tool-quality.ts hook against Bash tool calls that write
 * to a ticket's test-definitions.md (the R/G/R ledger). The Edit path already
 * validates [ ] → [x] transitions (SHA-or-skip); this gate closes the shell
 * channel so `sed -i` can't bulk-tick checkboxes the annotation gate never
 * sees. Mutations are directed to the Edit channel instead.
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
  '.safeword/hooks/codex/pre-tool-quality.ts',
);

/** Invoke pre-tool-quality with a Bash payload. */
function runBashHook(cwd: string, command: string): HookResult {
  const result = spawnSync('bun', [PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
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

/** Invoke the Codex adapter with a Codex-shaped Bash payload. */
function runCodexHook(cwd: string, command: string): HookResult {
  const result = spawnSync('bun', [CODEX_PRE_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
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

/** Temp project with a ticket ledger holding unticked R/G/R checkboxes. */
function setupProject(): { cwd: string; ledgerPath: string } {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  const ledgerRelative = '.project/tickets/GH628F/test-definitions.md';
  writeTestFile(
    cwd,
    ledgerRelative,
    '### Scenario: example\n\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n',
  );
  return { cwd, ledgerPath: nodePath.join(cwd, ledgerRelative) };
}

describe('Bash-channel ledger write gate', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = '';
  });

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  describe('Rule: Only write-shaped references to a ledger file are denied', () => {
    it('Scenario: the bulk-tick sed command from the audit is denied', () => {
      const setup = setupProject();
      projectDirectory = setup.cwd;
      // The literal #644 G3 bypass: one sed -i ticked 24 boxes unvalidated.
      const result = runBashHook(
        setup.cwd,
        String.raw`sed -i 's/^- \[ \] /- [x] /' ${setup.ledgerPath}`,
      );
      expectHookDeny(result, 'ledger');
    });
  });

  describe('Rule: One predicate reaches all three harnesses', () => {
    it('Scenario: the Claude gate denies a ledger write through its Bash branch', () => {
      const setup = setupProject();
      projectDirectory = setup.cwd;
      // A different write shape than the anchor, end to end through the hook —
      // and the read-only counterpart stays silent at the same seam.
      expectHookDeny(
        runBashHook(setup.cwd, `echo '- [x] RED' | tee ${setup.ledgerPath}`),
        'ledger',
      );
      expectHookAllow(runBashHook(setup.cwd, String.raw`grep '^- \[' ${setup.ledgerPath}`));
    });

    it('Scenario: the Codex adapter carries the same denial', () => {
      const setup = setupProject();
      projectDirectory = setup.cwd;
      const result = runCodexHook(setup.cwd, `echo '- [x] RED' >> ${setup.ledgerPath}`);
      expectHookDeny(result, 'ledger');
    });

    it('Scenario: the Codex adapter passes an allowed command through', () => {
      const setup = setupProject();
      projectDirectory = setup.cwd;
      const result = runCodexHook(setup.cwd, String.raw`grep '^- \[' ${setup.ledgerPath}`);
      expectHookAllow(result);
    });
  });

  describe('Rule: The denial names the sanctioned channel', () => {
    it('Scenario: the denial message directs to the Edit channel with the reason', () => {
      const setup = setupProject();
      projectDirectory = setup.cwd;
      const result = runBashHook(
        setup.cwd,
        String.raw`sed -i 's/^- \[ \] /- [x] /' ${setup.ledgerPath}`,
      );
      expectHookDeny(result, 'Edit tool');
      expectHookDeny(result, 'annotation validation');
    });
  });
});
