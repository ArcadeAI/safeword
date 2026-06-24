/**
 * Live Codex parity smoke (ticket CXP9LM / GitHub #394).
 *
 * This is deliberately opt-in: it launches a real `codex exec` session and may
 * spend tokens. Run with:
 *
 *   SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 bun run --cwd packages/cli test:smoke:live
 *
 * The smoke distinguishes supported hook-adapter behavior from current Codex
 * runtime gaps. Unsupported paths are reported as findings instead of silently
 * skipped, because that is the point of CXP9LM's live customer-repo check.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const TICKET_ID = 'ABC123';
const TEST_DEFINITIONS_PATH = `.project/tickets/${TICKET_ID}/test-definitions.md`;
const TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: ${TEST_DEFINITIONS_PATH}
+# Test Definitions
*** End Patch
`;

function resolveCodex(): string | undefined {
  const candidates = [process.env.SMOKE_CODEX_BIN, 'codex'].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && /\b0\.(?:13[3-9]|1[4-9]\d|\d{3,})\./.test(probe.stdout)) {
      return candidate;
    }
  }
  return undefined;
}

function run(
  command: string,
  args: string[],
  options: { cwd: string; input?: string; timeout?: number },
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeout ?? 60_000,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function assertSuccess(
  result: { status: number | null; stdout: string; stderr: string },
  label: string,
): void {
  expect(
    result.status,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0);
}

function createFixture(): string {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-live-'));
  run('git', ['init', '-q'], { cwd: projectRoot });
  writeFileSync(
    nodePath.join(projectRoot, 'package.json'),
    JSON.stringify({ name: 'codex-live-fixture', version: '1.0.0' }, undefined, 2),
  );
  return projectRoot;
}

function setupSafeword(projectRoot: string) {
  const result = spawnSync(process.execPath, [CLI_PATH, 'setup', '--yes', '--no-modify'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function writeIncompleteTicket(projectRoot: string): void {
  const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      '---',
      '',
      '# Live smoke fixture',
      '',
    ].join('\n'),
  );
}

function writeCompleteTicket(projectRoot: string): void {
  const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      'scope:',
      '  - prove the live Codex parity smoke',
      'out_of_scope:',
      '  - changing production hook policy',
      'done_when:',
      '  - Codex hook behavior is observed',
      '---',
      '',
      '# Live smoke fixture',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
  writeFileSync(
    nodePath.join(ticketDirectory, 'spec.md'),
    [
      '# Spec: Codex Live Smoke',
      '',
      '## Jobs To Be Done',
      '',
      '### codex-live-smoke.SM1 - Observe Codex hook behavior',
      '',
      '**Persona:** Safeword Maintainer (SM)',
      '',
      '> When I run a live Codex smoke, I want hook behavior recorded, so I can close parity honestly.',
      '',
      '#### codex-live-smoke.SM1.AC1 - Hook behavior is observable',
      '',
    ].join('\n'),
  );
  writeFileSync(
    nodePath.join(projectRoot, '.project', 'personas.md'),
    '# Personas\n\n## Safeword Maintainer (SM)\n\n**Role:** Maintains safeword.\n',
  );
}

function runInstalledCodexHook(projectRoot: string) {
  return run('bun', [nodePath.join(projectRoot, '.safeword/hooks/codex/pre-tool-quality.ts')], {
    cwd: projectRoot,
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: { command: TEST_DEFINITIONS_PATCH },
    }),
  });
}

function inspectPromptInput(codex: string, projectRoot: string): string {
  const result = run(codex, ['debug', 'prompt-input', 'List visible safeword context.'], {
    cwd: projectRoot,
    timeout: 60_000,
  });
  assertSuccess(result, 'codex debug prompt-input');
  return `${result.stdout}\n${result.stderr}`;
}

function runLiveEditAttempt(codex: string, projectRoot: string): string {
  const prompt = [
    `Use the apply_patch tool to create ${TEST_DEFINITIONS_PATH}.`,
    'The file content must be exactly: # Test Definitions',
    'Do not use a shell command.',
  ].join(' ');

  const result = run(
    codex,
    [
      'exec',
      '--json',
      '--dangerously-bypass-hook-trust',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      projectRoot,
      prompt,
    ],
    { cwd: projectRoot, timeout: 180_000 },
  );
  assertSuccess(result, 'codex exec live edit attempt');
  return `${result.stdout}\n${result.stderr}`;
}

const CODEX = resolveCodex();
const CAN_RUN = process.env.SAFEWORD_RUN_CODEX_LIVE_SMOKE === '1' && CODEX !== undefined;

describe.skipIf(!CAN_RUN)('live smoke: Codex customer-repo parity', () => {
  let projectRoot: string;

  beforeAll(() => {
    projectRoot = createFixture();
    const setup = setupSafeword(projectRoot);
    assertSuccess(setup, 'safeword setup');
    expect(`${setup.stdout}\n${setup.stderr}`).toContain('run `/hooks`');
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('installs Codex assets and exposes current live execution gaps', () => {
    if (!CODEX) throw new Error('unreachable: CAN_RUN guards codex presence');

    expect(existsSync(nodePath.join(projectRoot, '.codex/config.toml'))).toBe(true);
    expect(existsSync(nodePath.join(projectRoot, '.agents/skills/explain/SKILL.md'))).toBe(true);
    expect(
      existsSync(nodePath.join(projectRoot, '.safeword/hooks/codex/pre-tool-quality.ts')),
    ).toBe(true);

    const promptInput = inspectPromptInput(CODEX, projectRoot);
    const seesProjectInstructions =
      promptInput.includes('.safeword/SAFEWORD.md') || promptInput.includes('.safeword/AGENTS.md');
    const seesRepoExplainSkill = promptInput.includes('.agents/skills/explain');
    if (!seesProjectInstructions || !seesRepoExplainSkill) {
      console.warn(
        [
          'Codex live smoke finding:',
          `projectInstructionsVisible=${seesProjectInstructions}`,
          `repoExplainSkillVisible=${seesRepoExplainSkill}`,
        ].join(' '),
      );
    }

    writeIncompleteTicket(projectRoot);
    const directDeny = runInstalledCodexHook(projectRoot);
    expect(directDeny.stdout).toContain('permissionDecision');
    expect(directDeny.stdout).toContain('Run `$explain`');

    writeCompleteTicket(projectRoot);
    const directAllow = runInstalledCodexHook(projectRoot);
    expect(directAllow.stdout.trim()).toBe('');
    expect(directAllow.stderr.trim()).toBe('');

    rmSync(nodePath.join(projectRoot, TEST_DEFINITIONS_PATH), { force: true });
    writeIncompleteTicket(projectRoot);

    const liveOutput = runLiveEditAttempt(CODEX, projectRoot);
    const liveDenied = liveOutput.includes('Command blocked by PreToolUse hook');
    const usedFileChangePath = liveOutput.includes('"type":"file_change"');

    expect(
      liveDenied || usedFileChangePath,
      `Codex neither denied the edit nor exposed the known file_change path.\n${liveOutput}`,
    ).toBe(true);

    if (usedFileChangePath && !liveDenied) {
      expect(readFileSync(nodePath.join(projectRoot, TEST_DEFINITIONS_PATH), 'utf8')).toContain(
        '# Test Definitions',
      );
      console.warn(
        'Codex live smoke finding: codex exec used file_change and bypassed PreToolUse for the requested edit.',
      );
    }
  });
});
