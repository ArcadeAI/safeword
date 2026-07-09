/**
 * TXRHMD (#480) transition gate: a new-flow feature ticket may only advance
 * plan-implementation → implement once impl-plan.md parses valid with status
 * `planned`. Wiring test — spawns the real pre-tool-quality hook with real
 * hook-lib collaborators; only the filesystem (temp project) is controlled.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, it } from 'vitest';

import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const TICKET_ID = 'TX480G';

const ticketBody = (phase: string, type = 'feature'): string =>
  [
    '---',
    `id: ${TICKET_ID}`,
    `type: ${type}`,
    `phase: ${phase}`,
    'status: in_progress',
    'scope:',
    '  - gate the implement entry',
    'out_of_scope:',
    '  - unrelated',
    'done_when:',
    '  - gated',
    '---',
    '',
    '# Ticket',
    '',
  ].join('\n');

const VALID_PLAN = [
  '# Impl Plan: gate the implement entry',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'Riskiest assumption: the gate fires → scenario 1.',
  '',
  '## Decisions',
  '',
  '| Decision | Choice | Alternatives considered | Rejected because |',
  '| - | - | - | - |',
  '| gate | pre-tool | stop-only | too late |',
  '',
  '## Arch alignment',
  '',
  'skip: no ADRs in this project yet',
  '',
  '## Known deviations',
  '',
  'skip: no deviations planned',
  '',
  '## Assessment triggers',
  '',
  'Revisit when a second gate consumer appears.',
  '',
].join('\n');

describe('TXRHMD plan-implementation → implement transition gate (wired)', () => {
  let projectRoot: string;
  let ticketDirectory: string;
  let ticketFile: string;

  function runAdvance(fromPhase: string, toPhase: string): HookResult {
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

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'sw-plan-gate-'));
    ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', `${TICKET_ID}-gate`);
    mkdirSync(ticketDirectory, { recursive: true });
    ticketFile = nodePath.join(ticketDirectory, 'ticket.md');
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('allows implement entry when a valid planned impl-plan.md exists', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), VALID_PLAN);
    expectHookAllow(runAdvance('plan-implementation', 'implement'));
  });

  it('denies implement entry without impl-plan.md, naming the artifact and scaffold', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    const result = runAdvance('plan-implementation', 'implement');
    expectHookDeny(result, 'impl-plan.md');
    expectHookDeny(result, 'impl-plan-template.md');
  });

  it('denies implement entry when the plan is missing a required section, naming it', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace('## Decisions', '## Notes'),
    );
    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'Decisions');
  });

  it('denies implement entry when the plan status is still implemented from a replan loop', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Spec\n');
    writeFileSync(
      nodePath.join(ticketDirectory, 'impl-plan.md'),
      VALID_PLAN.replace('**Status:** planned', '**Status:** implemented'),
    );
    expectHookDeny(runAdvance('plan-implementation', 'implement'), 'implemented');
  });

  it('grandfathers a legacy feature without spec.md', () => {
    writeFileSync(ticketFile, ticketBody('plan-implementation'));
    expectHookAllow(runAdvance('plan-implementation', 'implement'));
  });

  it('leaves task tickets unpoliced', () => {
    writeFileSync(ticketFile, ticketBody('scenario-gate', 'task'));
    expectHookAllow(runAdvance('scenario-gate', 'implement'));
  });
});
