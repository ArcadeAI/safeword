/**
 * Integration: impl-plan cumulative gate (ticket XDNSZA)
 *
 * Proves the stop hook requires a valid impl-plan.md for new-flow features
 * (spec.md present) at implement/done, and exempts tasks, grandfathered
 * tickets, and pre-implement phases. Covers test-definitions.md Rule 3.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  removeTemporaryDirectory,
  setupOrThrow,
  writeTestFile,
} from '../helpers.js';

let projectDirectory: string;

beforeAll(async () => {
  projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(projectDirectory);
  initGitRepo(projectDirectory);
  await setupOrThrow(projectDirectory);
});

afterAll(() => {
  if (projectDirectory) removeTemporaryDirectory(projectDirectory);
});

const VALID_PLAN = `# Impl Plan: test

**Status:** planned

## Approach

One slice.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| - | - | - | - |
| Storage | File | DB | Overkill |

## Arch alignment

skip: no ADRs in this project yet

## Known deviations

None planned.

## Assessment triggers

Revisit past 10x load.
`;

interface TicketFixture {
  id: string;
  type: 'feature' | 'task';
  phase: string;
  spec?: boolean;
  implPlan?: string;
}

function writeTicket(fixture: TicketFixture): void {
  const folder = `.safeword-project/tickets/${fixture.id}`;
  mkdirSync(nodePath.join(projectDirectory, folder), { recursive: true });
  writeTestFile(
    projectDirectory,
    `${folder}/ticket.md`,
    `---\nid: ${fixture.id}\ntype: ${fixture.type}\nphase: ${fixture.phase}\nstatus: in_progress\nlast_modified: 2026-01-06T10:00:00Z\n---\n# Test\n`,
  );
  if (fixture.type === 'feature') {
    writeTestFile(
      projectDirectory,
      `${folder}/test-definitions.md`,
      '# Test Definitions\n\n## Rule: Test rule\n\n- [ ] Scenario one\n',
    );
  }
  if (fixture.spec) {
    writeTestFile(
      projectDirectory,
      `${folder}/spec.md`,
      '# Spec\n\n## Jobs To Be Done\n\nskip: fixture\n',
    );
  }
  if (fixture.implPlan !== undefined) {
    writeTestFile(projectDirectory, `${folder}/impl-plan.md`, fixture.implPlan);
  }
}

function runStopHook(ticketId: string): string {
  const sessionId = `session-${ticketId}`;
  const transcriptPath = nodePath.join(projectDirectory, `transcript-${ticketId}.jsonl`);
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'done' },
          { type: 'tool_use', name: 'Edit' },
        ],
      },
    })}\n`,
  );
  writeFileSync(
    nodePath.join(projectDirectory, '.safeword-project', `quality-state-${sessionId}.json`),
    JSON.stringify({ activeTicket: ticketId }),
  );
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({ transcript_path: transcriptPath, session_id: sessionId }),
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
  });
  try {
    return (JSON.parse(result.stdout.trim()).reason as string) ?? '';
  } catch {
    return '';
  }
}

describe('impl-plan cumulative gate (Rule 3)', () => {
  it('blocks a new-flow feature at implement with no impl-plan.md, naming the authoring point', () => {
    writeTicket({ id: 'IPG001', type: 'feature', phase: 'implement', spec: true });
    const reason = runStopHook('IPG001');
    expect(reason).toContain('impl-plan.md');
    expect(reason).toContain('scenario-gate exit');
  });

  it('permits the stop for a new-flow feature at implement with a valid impl-plan.md', () => {
    writeTicket({
      id: 'IPG002',
      type: 'feature',
      phase: 'implement',
      spec: true,
      implPlan: VALID_PLAN,
    });
    const reason = runStopHook('IPG002');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('blocks at implement when the impl-plan has an empty unskipped Decisions section', () => {
    writeTicket({
      id: 'IPG003',
      type: 'feature',
      phase: 'implement',
      spec: true,
      implPlan: VALID_PLAN.replace(
        /## Decisions[\s\S]*?## Arch alignment/u,
        '## Decisions\n\n## Arch alignment',
      ),
    });
    const reason = runStopHook('IPG003');
    expect(reason).toContain('Decisions');
  });

  it('exempts a grandfathered feature (no spec.md) at implement', () => {
    writeTicket({ id: 'IPG004', type: 'feature', phase: 'implement' });
    const reason = runStopHook('IPG004');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('exempts a task ticket at implement', () => {
    writeTicket({ id: 'IPG005', type: 'task', phase: 'implement' });
    const reason = runStopHook('IPG005');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('exempts a new-flow feature before implement (scenario-gate)', () => {
    writeTicket({ id: 'IPG006', type: 'feature', phase: 'scenario-gate', spec: true });
    const reason = runStopHook('IPG006');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('blocks a new-flow feature at done with no impl-plan.md', () => {
    writeTicket({ id: 'IPG007', type: 'feature', phase: 'done', spec: true });
    const reason = runStopHook('IPG007');
    expect(reason).toContain('impl-plan.md');
  });
});

const IMPLEMENTED_PLAN = VALID_PLAN.replace('**Status:** planned', '**Status:** implemented');

describe('reconciliation status gate (ERVA6V, test-definitions Rules 1-2)', () => {
  it('blocks a new-flow feature at verify whose plan is still planned, naming reconciliation', () => {
    writeTicket({
      id: 'RSG001',
      type: 'feature',
      phase: 'verify',
      spec: true,
      implPlan: VALID_PLAN,
    });
    const reason = runStopHook('RSG001');
    expect(reason).toContain('impl-plan.md');
    expect(reason.toLowerCase()).toContain('reconcil');
  });

  it('blocks a new-flow feature at verify with no impl-plan.md (existence extends to verify)', () => {
    writeTicket({ id: 'RSG002', type: 'feature', phase: 'verify', spec: true });
    const reason = runStopHook('RSG002');
    expect(reason).toContain('impl-plan.md');
  });

  it('permits the stop at verify once the plan is implemented', () => {
    writeTicket({
      id: 'RSG003',
      type: 'feature',
      phase: 'verify',
      spec: true,
      implPlan: IMPLEMENTED_PLAN,
    });
    const reason = runStopHook('RSG003');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('allows a planned plan during implement (status check fires at verify+ only)', () => {
    writeTicket({
      id: 'RSG004',
      type: 'feature',
      phase: 'implement',
      spec: true,
      implPlan: VALID_PLAN,
    });
    const reason = runStopHook('RSG004');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('blocks a new-flow feature at done whose plan is still planned', () => {
    writeTicket({ id: 'RSG005', type: 'feature', phase: 'done', spec: true, implPlan: VALID_PLAN });
    const reason = runStopHook('RSG005');
    expect(reason).toContain('impl-plan.md');
    expect(reason.toLowerCase()).toContain('reconcil');
  });

  it('exempts a grandfathered feature (no spec.md) at verify', () => {
    writeTicket({ id: 'RSG006', type: 'feature', phase: 'verify' });
    const reason = runStopHook('RSG006');
    expect(reason).not.toContain('impl-plan.md');
  });

  it('exempts a task ticket at verify', () => {
    writeTicket({ id: 'RSG007', type: 'task', phase: 'verify' });
    const reason = runStopHook('RSG007');
    expect(reason).not.toContain('impl-plan.md');
  });
});
