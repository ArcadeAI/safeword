import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectHookDeny, TIMEOUT_QUICK } from '../helpers.js';

const HOOK_PATH = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/pre-tool-quality.ts',
);
const SESSION_ID = 'coding-authorization';
const TICKET_ID = 'AUTH01';
const RED_ACTION = 'bun run test tests/integration/guarded-edit.test.ts';

describe('coding authorization edit hook', () => {
  let projectRoot: string;
  let pluginRoot: string;
  let sourcePath: string;
  let ticketPath: string;

  function writeCliResponse(response: Record<string, unknown>): void {
    writeFileSync(nodePath.join(pluginRoot, 'response.json'), JSON.stringify(response));
  }

  function runEdit(filePath = sourcePath) {
    return spawnSync('bun', [HOOK_PATH], {
      cwd: projectRoot,
      input: JSON.stringify({
        session_id: SESSION_ID,
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: {
          file_path: filePath,
          old_string: 'export const value = 1;',
          new_string: 'export const value = 2;',
        },
      }),
      encoding: 'utf8',
      timeout: TIMEOUT_QUICK,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PROJECT_DIR: projectRoot,
      },
    });
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-coding-hook-'));
    pluginRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-coding-hook-cli-'));
    const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', `${TICKET_ID}-gate`);
    ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
    sourcePath = nodePath.join(projectRoot, 'src', 'application.ts');
    mkdirSync(ticketDirectory, { recursive: true });
    mkdirSync(nodePath.dirname(sourcePath), { recursive: true });
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(pluginRoot, 'runtime'), { recursive: true });
    writeFileSync(nodePath.join(projectRoot, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(nodePath.join(projectRoot, '.safeword', 'config.json'), '{}\n');
    writeFileSync(
      ticketPath,
      [
        '---',
        `id: ${TICKET_ID}`,
        'type: feature',
        'phase: implement',
        'status: in_progress',
        '---',
        '',
      ].join('\n'),
    );
    writeFileSync(nodePath.join(ticketDirectory, 'execution-plan.md'), '# Execution Plan\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'test-definitions.md'),
      [
        '# Test Definitions',
        '',
        '### Scenario: guarded edit',
        '',
        `- [ ] RED — ${RED_ACTION}`,
        '- [ ] GREEN',
        '- [ ] REFACTOR',
        '',
      ].join('\n'),
    );
    writeFileSync(
      nodePath.join(projectRoot, '.project', `quality-state-${SESSION_ID}.json`),
      JSON.stringify({ activeTicket: TICKET_ID }),
    );
    writeFileSync(sourcePath, 'export const value = 1;\n');
    writeFileSync(
      nodePath.join(pluginRoot, 'runtime', 'cli.js'),
      [
        "import { appendFileSync, readFileSync } from 'node:fs';",
        "import nodePath from 'node:path';",
        'const root = nodePath.join(import.meta.dirname, "..");',
        'appendFileSync(nodePath.join(root, "calls.log"), `${JSON.stringify(process.argv.slice(2))}\\n`);',
        'process.stdout.write(readFileSync(nodePath.join(root, "response.json"), "utf8"));',
      ].join('\n'),
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('blocks production work under a stale affected plan and names plan repair first', () => {
    writeCliResponse({
      schema_version: 1,
      ok: true,
      state: 'action_required',
      changed: false,
      findings: [
        {
          code: 'missing_accepted_approach',
          message: 'The accepted Implementation Plan changed after review.',
          severity: 'warning',
        },
      ],
      effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
      errors: [],
      recovery: [],
      next_actions: [
        {
          command:
            'safeword review run plan-implementation -- .project/tickets/AUTH01-gate/impl-plan.md',
          mutates: true,
          requires_human: false,
        },
      ],
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'denied',
        grants_authority: false,
        authorization_input_identity: 'stale-implementation-plan',
      },
    });

    const result = runEdit();

    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(
      result.stdout,
      'a stale affected plan must block the production edit before implementation continues',
    ).not.toBe('');
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { permissionDecisionReason: string; additionalContext?: string };
    };
    const reason = output.hookSpecificOutput.permissionDecisionReason;
    expect(reason.startsWith('The accepted Implementation Plan changed after review.')).toBe(true);
    expect(reason).not.toContain(RED_ACTION);
    expect(output.hookSpecificOutput.additionalContext?.startsWith('safeword review run')).toBe(
      true,
    );
    const callsPath = nodePath.join(pluginRoot, 'calls.log');
    expect(
      existsSync(callsPath),
      'a production edit under a contracted feature must ask the public coding-authorization command',
    ).toBe(true);
    expectHookDeny(result, 'The accepted Implementation Plan changed after review.');
    expect(result.stdout).toContain(
      'safeword review run plan-implementation -- .project/tickets/AUTH01-gate/impl-plan.md',
    );
    const calls = readFileSync(callsPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as string[]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      '--json',
      '--no-input',
      '--cwd',
      projectRoot,
      'ticket',
      'coding-authorization',
      TICKET_ID,
    ]);
  });

  it('reports the named RED after the public coding-authorization command authorizes it', () => {
    writeCliResponse({
      schema_version: 1,
      ok: true,
      state: 'healthy',
      changed: false,
      findings: [],
      effects: { files: [], packages: [], configuration: [], network: [], destructive: [] },
      errors: [],
      recovery: [],
      next_actions: [],
      data: {
        command: 'ticket coding-authorization',
        coding_authorization: 'authorized',
        achieved_independence: 'cross-agent',
        grants_authority: false,
        authorization_input_identity: 'current-plans',
      },
    });

    const result = runEdit();

    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expectHookDeny(result, RED_ACTION);
    expect(result.stdout).not.toContain('The accepted Implementation Plan changed after review.');
    const calls = readFileSync(nodePath.join(pluginRoot, 'calls.log'), 'utf8').trim().split('\n');
    expect(calls).toHaveLength(1);
  });

  it.each(['define-behavior', 'scenario-gate'])(
    'allows feature-source repair during %s after execution planning has begun',
    phase => {
      writeFileSync(
        ticketPath,
        readFileSync(ticketPath, 'utf8').replace('implement', () => phase),
      );
      const featurePath = nodePath.join(projectRoot, 'features', 'feature.feature');
      mkdirSync(nodePath.dirname(featurePath), { recursive: true });
      writeFileSync(featurePath, 'Feature: Original behavior\n');
      writeCliResponse({
        schema_version: 1,
        ok: true,
        state: 'action_required',
        findings: [
          {
            code: 'missing_accepted_scenarios',
            message: 'Accepted scenarios are required before execution.',
            severity: 'warning',
          },
        ],
        errors: [],
        next_actions: [],
      });

      const result = runEdit(featurePath);

      expect(result.error, result.stderr).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe('');
      expect(existsSync(nodePath.join(pluginRoot, 'calls.log'))).toBe(false);
    },
  );
});
