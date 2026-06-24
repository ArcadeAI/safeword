/**
 * Integration test for the NMSD94 Tier 2 phase-advance gate, wired into the real
 * pre-tool-quality hook. A ticket.md edit that changes `phase:` is blocked until
 * an independent phase-exit review stamp exists for the phase being left — across
 * both Write and Edit, default-off, with a skip valve and the end-to-end loop via
 * write-review-stamp --phase.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, it } from 'vitest';

import { reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const STAMP_PATH = nodePath.resolve(__dirname, '../../templates/hooks/write-review-stamp.ts');
const TICKET_ID = 'ABC123';

const ticketBody = (phase: string): string =>
  [
    '---',
    'id: ABC123',
    'type: feature',
    `phase: ${phase}`,
    'status: in_progress',
    'last_modified: 2026-06-03T00:00:00.000Z',
    'scope:',
    '  - does a thing',
    '---',
    '',
    '# Ticket',
    '',
  ].join('\n');

describe('NMSD94 Tier 2 phase-advance gate (wired)', () => {
  let projectRoot: string;
  let ticketDirectory: string;
  let ticketFile: string;

  function runGateWrite(
    newPhase: string,
    extraEnvironment: Record<string, string> = {},
  ): HookResult {
    // Control the ambient author model: tests that exercise cross-model pass it
    // explicitly; everything else runs with it unset so same-model defaults are
    // deterministic regardless of the dev's SessionStart env.
    const childEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      ...extraEnvironment,
    };
    if (!('SAFEWORD_AUTHOR_MODEL' in extraEnvironment))
      delete childEnvironment.SAFEWORD_AUTHOR_MODEL;
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: ticketFile, content: ticketBody(newPhase) },
      }),
      encoding: 'utf8',
      env: childEnvironment,
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function runGateEdit(fromPhase: string, toPhase: string): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketFile,
          old_string: `phase: ${fromPhase}`,
          new_string: `phase: ${toPhase}`,
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function stampPhase(phase: string, ...skip: string[]): void {
    spawnSync('bun', [STAMP_PATH, '--phase', phase, ...skip], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot, CLAUDE_SESSION_ID: 'sess-1' },
    });
  }

  function stampPhaseModel(phase: string, model: string): void {
    spawnSync('bun', [STAMP_PATH, '--model', model, '--phase', phase], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot, CLAUDE_SESSION_ID: 'sess-1' },
    });
  }

  function writeConfig(reviewGate: boolean, crossModelReview = false): void {
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectRoot, '.safeword', 'config.json'),
      JSON.stringify({ reviewGate, crossModelReview }),
    );
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'phase-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', TICKET_ID);
    mkdirSync(ticketDirectory, { recursive: true });
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
    writeFileSync(ticketFile, ticketBody('define-behavior'));
    writeConfig(true);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('blocks a Write that advances the phase with no stamp (DEV2.AC1)', () => {
    expectHookDeny(runGateWrite('implement'), 'define-behavior');
  });

  it('blocks an Edit that advances the phase with no stamp', () => {
    expectHookDeny(runGateEdit('define-behavior', 'implement'), 'no independent review stamp');
  });

  it('allows the advance once a phase-exit stamp exists', () => {
    writeFileSync(
      nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log'),
      `2026-06-03T00:00:00Z sess review:${reviewScope(TICKET_ID, 'phase', 'define-behavior')}\n`,
    );
    expectHookAllow(runGateWrite('implement'));
  });

  it('end to end: write-review-stamp --phase earns a stamp the gate accepts', () => {
    expectHookDeny(runGateWrite('implement'), 'define-behavior');
    stampPhase('define-behavior');
    expectHookAllow(runGateWrite('implement'));
  });

  it('a skip stamp clears the phase gate', () => {
    stampPhase('define-behavior', 'docs-only', 'phase');
    expectHookAllow(runGateWrite('implement'));
  });

  it('allows a ticket.md edit that does not change the phase', () => {
    expectHookAllow(runGateWrite('define-behavior'));
  });

  it('is inert when reviewGate is off (default)', () => {
    writeConfig(false);
    expectHookAllow(runGateWrite('implement'));
  });

  describe('cross-model (7A0B2K) — phase-exit review must be a different model', () => {
    it('blocks when the phase stamp model equals the author model', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookDeny(
        runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });

    it('allows when the phase stamp model differs from the author model', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-sonnet-4-6');
      expectHookAllow(runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('blocks when the phase stamp records no model (fails closed)', () => {
      writeConfig(true, true);
      stampPhase('define-behavior');
      expectHookDeny(
        runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });

    it('allows when crossModelReview is OFF even if stamp model equals author', () => {
      writeConfig(true, false);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookAllow(runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('a logged skip bypasses the cross-model requirement', () => {
      writeConfig(true, true);
      stampPhase('define-behavior', 'docs-only', 'phase');
      expectHookAllow(runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('passes when a different-model re-review follows a same-model stamp', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      stampPhaseModel('define-behavior', 'claude-sonnet-4-6');
      expectHookAllow(runGateWrite('implement', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });
  });
});
