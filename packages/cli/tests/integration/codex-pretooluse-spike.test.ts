/**
 * Codex PreToolUse deny spike (ticket N12G95).
 *
 * Spawns the Codex-shaped hook adapter with an `apply_patch` payload and
 * verifies it preserves the existing safeword phase-gate behavior.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const HOOK_PATH = nodePath.resolve(__dirname, '../../templates/hooks/codex/pre-tool-quality.ts');

const TICKET_ID = 'ABC123';

const TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: .project/tickets/${TICKET_ID}/test-definitions.md
+# Test Definitions
*** End Patch
`;

const COMPLETE_TICKET_FRONTMATTER = [
  'id: ABC123',
  'type: feature',
  'phase: define-behavior',
  'status: in_progress',
  'scope:',
  '  - prove the Codex hook adapter',
  'out_of_scope:',
  '  - full Codex config generation',
  'done_when:',
  '  - the adapter gates edits',
].join('\n');

const PERSONAS = '# Personas\n\n## Safeword Maintainer (SM)\n\n**Role:** Maintains safeword.\n';

const SPEC = [
  '# Spec: Codex Hook Adapter',
  '',
  '## Jobs To Be Done',
  '',
  '### codex-hook.SM1 - Prove edit gate reuse',
  '',
  '**Persona:** Safeword Maintainer (SM)',
  '',
  '> When I add a Codex hook path, I want it to reuse the existing phase gate, so I can trust parity work is measured.',
  '',
  '#### codex-hook.SM1.AC1 - Existing phase gate behavior is preserved',
  '',
].join('\n');

function runCodexHook(projectRoot: string, options: { fallbackMode?: boolean } = {}): HookResult {
  const result = spawnSync('bun', [HOOK_PATH], {
    cwd: projectRoot,
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: {
        command: TEST_DEFINITIONS_PATCH,
      },
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      ...(options.fallbackMode ? { SAFEWORD_CODEX_DENY_MODE: 'exit-code' } : {}),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('Codex PreToolUse deny spike (N12G95)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'codex-pretooluse-'));
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
    mkdirSync(ticketDirectory, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('denies supported Codex edits when safeword intake prerequisites are missing', () => {
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      [
        '---',
        'id: ABC123',
        'type: feature',
        'phase: define-behavior',
        'status: in_progress',
        '---',
        '',
      ].join('\n'),
    );

    expectHookDeny(runCodexHook(projectRoot), 'scope');
  });

  it('allows supported Codex edits when safeword intake prerequisites are complete', () => {
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      `---\n${COMPLETE_TICKET_FRONTMATTER}\n---\n`,
    );
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), SPEC);
    writeFileSync(nodePath.join(projectRoot, '.project', 'personas.md'), PERSONAS);

    expectHookAllow(runCodexHook(projectRoot));
  });

  it('can report the same denial through Codex exit-code fallback mode', () => {
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      [
        '---',
        'id: ABC123',
        'type: feature',
        'phase: define-behavior',
        'status: in_progress',
        '---',
        '',
      ].join('\n'),
    );

    const result = runCodexHook(projectRoot, { fallbackMode: true });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('scope');
    expect(result.stdout.trim()).toBe('');
  });
});
