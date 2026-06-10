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
});
