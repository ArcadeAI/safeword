/**
 * Integration test for the NMSD94 Tier 2 phase-advance gate, wired into the real
 * pre-tool-quality hook. A ticket.md edit that changes `phase:` is blocked until
 * an independent phase-exit review stamp exists for the phase being left — across
 * both Write and Edit, default-off, with a skip valve and the end-to-end loop via
 * write-review-stamp --phase.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
    'out_of_scope:',
    '  - unrelated things',
    'done_when:',
    '  - thing is done',
    '---',
    '',
    '# Ticket',
    '',
  ].join('\n');

describe('NMSD94 Tier 2 phase-advance gate (wired)', () => {
  let projectRoot: string;
  let pluginRoot: string;
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
      CLAUDE_PLUGIN_ROOT: pluginRoot,
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

  function runGateEdit(
    fromPhase: string,
    toPhase: string,
    extraEnvironment: Record<string, string> = {},
  ): HookResult {
    const childEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      ...extraEnvironment,
    };
    if (!('SAFEWORD_AUTHOR_MODEL' in extraEnvironment))
      delete childEnvironment.SAFEWORD_AUTHOR_MODEL;
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
      env: childEnvironment,
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function stampPhase(phase: string, skipReason?: string): void {
    const skip = skipReason === undefined ? [] : ['--skip', skipReason];
    spawnSync('bun', [STAMP_PATH, '--phase', phase, ...skip], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot, CLAUDE_SESSION_ID: 'sess-1' },
    });
  }

  function stampPhaseModel(phase: string, model: string): void {
    stampVerifiedPhase(phase, model);
  }

  function stampVerifiedPhase(phase: string, model?: string): void {
    const reviewId = 'b3f1c2d4-0000-4000-8000-000000000001';
    const target =
      phase === 'implement'
        ? 'packages/cli/src/feature.ts'
        : `.safeword-project/tickets/${TICKET_ID}/feature.feature`;
    writeFileSync(
      nodePath.join(pluginRoot, 'response.json'),
      JSON.stringify({
        data: {
          review_id: reviewId,
          status: 'approved',
          review_kind: 'quality-review',
          review_targets: [target],
          independence: 'cross-agent',
          author_agent: 'claude',
          actual_reviewer: 'codex',
        },
      }),
    );
    const modelArguments = model === undefined ? [] : ['--model', model];
    const result = spawnSync(
      'bun',
      [
        STAMP_PATH,
        '--author-agent',
        'claude',
        '--reviewer-agent',
        'codex',
        '--independence',
        'cross-agent',
        '--review-id',
        reviewId,
        ...modelArguments,
        '--phase',
        phase,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
          CLAUDE_PLUGIN_ROOT: pluginRoot,
          CLAUDE_SESSION_ID: 'sess-1',
        },
      },
    );
    expect(result.status).toBe(0);
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
    pluginRoot = mkdtempSync(nodePath.join(tmpdir(), 'phase-gate-cli-'));
    mkdirSync(nodePath.join(pluginRoot, 'runtime'), { recursive: true });
    writeFileSync(
      nodePath.join(pluginRoot, 'runtime', 'cli.js'),
      [
        "import { readFileSync } from 'node:fs';",
        "import nodePath from 'node:path';",
        "process.stdout.write(readFileSync(nodePath.join(import.meta.dirname, '..', 'response.json'), 'utf8'));",
      ].join('\n'),
    );
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', TICKET_ID);
    mkdirSync(ticketDirectory, { recursive: true });
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
    writeFileSync(ticketFile, ticketBody('define-behavior'));
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n## Jobs To Be Done\n\nskip: phase-review fixture\n',
    );
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: phase-review fixture\n');
    writeFileSync(nodePath.join(ticketDirectory, 'feature.feature'), 'Feature: fixture\n');
    const implementationFile = nodePath.join(projectRoot, 'packages', 'cli', 'src', 'feature.ts');
    mkdirSync(nodePath.dirname(implementationFile), { recursive: true });
    writeFileSync(implementationFile, 'export const value = 1;\n');
    expect(spawnSync('git', ['init', '-b', 'main', projectRoot]).status).toBe(0);
    expect(spawnSync('git', ['-C', projectRoot, 'add', '.']).status).toBe(0);
    expect(
      spawnSync(
        'git',
        ['-C', projectRoot, '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture baseline'],
        {
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'Safeword Test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'Safeword Test',
            GIT_COMMITTER_EMAIL: 'test@example.com',
          },
        },
      ).status,
    ).toBe(0);
    writeFileSync(implementationFile, 'export const value = 2;\n');
    writeConfig(true);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('blocks a Write that advances the phase with no stamp (TB2.AC1)', () => {
    expectHookDeny(runGateWrite('scenario-gate'), 'define-behavior');
  });

  it('blocks an Edit that advances the phase with no stamp', () => {
    expectHookDeny(runGateEdit('define-behavior', 'scenario-gate'), 'no independent review stamp');
  });

  it('allows the advance once a phase-exit stamp exists', () => {
    stampVerifiedPhase('define-behavior');
    expectHookAllow(runGateWrite('scenario-gate'));
  });

  it('allows phase advancement with ABSENT demand after the required review', () => {
    writeFileSync(
      nodePath.join(ticketDirectory, 'spec.md'),
      '# Spec\n\n## Product Bet\n\n**Problem / Why now:** Demand: ABSENT. Validate with a manual pilot.\n\n**Success threshold:** Three teams complete the pilot.\n\n## Jobs To Be Done\n\nskip: phase-review fixture\n',
    );
    expectHookDeny(runGateWrite('scenario-gate'), 'define-behavior');
    stampVerifiedPhase('define-behavior');
    expectHookAllow(runGateWrite('scenario-gate'));
  });

  it('does not accept a claim-free stamp from write-review-stamp --phase', () => {
    expectHookDeny(runGateWrite('scenario-gate'), 'define-behavior');
    stampPhase('define-behavior');
    expectHookDeny(runGateWrite('scenario-gate'), 'no independent review stamp');
  });

  it('a skip stamp clears the phase gate', () => {
    stampPhase('define-behavior', 'docs-only phase');
    expectHookAllow(runGateWrite('scenario-gate'));
  });

  it('allows a ticket.md edit that does not change the phase', () => {
    expectHookAllow(runGateWrite('define-behavior'));
  });

  it('is inert when reviewGate is off (default)', () => {
    writeConfig(false);
    expectHookAllow(runGateWrite('scenario-gate'));
  });

  describe('cross-model (7A0B2K) — phase-exit review must be a different model', () => {
    it('blocks when the phase stamp model equals the author model', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookDeny(
        runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });

    it('allows when the phase stamp model differs from the author model', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-sonnet-4-6');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('blocks when the phase stamp records no model (fails closed)', () => {
      writeConfig(true, true);
      stampVerifiedPhase('define-behavior');
      expectHookDeny(
        runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });

    it('allows when crossModelReview is OFF even if stamp model equals author', () => {
      writeConfig(true, false);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('a logged skip bypasses the cross-model requirement', () => {
      writeConfig(true, true);
      stampPhase('define-behavior', 'docs-only phase');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('a logged skip bypasses an earlier same-model review', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      stampPhase('define-behavior', 'review deliberately waived');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('passes when a different-model re-review follows a same-model stamp', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      stampPhaseModel('define-behavior', 'claude-sonnet-4-6');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('passes regardless of stamp order — cross-model first, same-model after', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-sonnet-4-6');
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookAllow(runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }));
    });

    it('ignores a different-model stamp that is not backed by a coordinator review', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      appendFileSync(
        nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log'),
        '2026-06-03T00:00:00.000Z sess-1 review:ABC123:phase@define-behavior model:claude-sonnet-4-6 author:claude reviewer:codex independence:cross-agent review-id:00000000-0000-4000-8000-000000000000\n',
      );

      expectHookDeny(
        runGateWrite('scenario-gate', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });

    it('blocks via the Edit path too when the stamp model equals the author', () => {
      writeConfig(true, true);
      stampPhaseModel('define-behavior', 'claude-opus-4-8');
      expectHookDeny(
        runGateEdit('define-behavior', 'scenario-gate', {
          SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8',
        }),
        'cross-model',
      );
    });

    it('blocks a backward phase move under cross-model with a same-model stamp', () => {
      writeConfig(true, true);
      writeFileSync(ticketFile, ticketBody('implement'));
      stampPhaseModel('implement', 'claude-opus-4-8');
      expectHookDeny(
        runGateWrite('define-behavior', { SAFEWORD_AUTHOR_MODEL: 'claude-opus-4-8' }),
        'cross-model',
      );
    });
  });
});
