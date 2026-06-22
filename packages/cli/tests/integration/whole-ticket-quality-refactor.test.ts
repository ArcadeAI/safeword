/**
 * Integration: whole-ticket quality-review + refactor gate end-to-end (W610WW)
 *
 * Exercises the wired done-gate path:
 *  - The cross-scenario ledger validation now runs for TASKS too (the isFeature
 *    fence is gone), so a multi-loop task with a missing refactor row is blocked.
 *  - The skill-invocation requirement is annotation-aware (wholeTicketPassApplies):
 *    a ticket with >=2 ANNOTATED loops needs /quality-review; single-loop and
 *    pure-legacy (unannotated) tickets do not.
 */

import { execSync, spawnSync } from 'node:child_process';
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

const shared: { projectDirectory: string; ticketSeq: number } = {
  projectDirectory: '',
  ticketSeq: 0,
};

beforeAll(async () => {
  shared.projectDirectory = createTemporaryDirectory();
  createTypeScriptPackageJson(shared.projectDirectory);
  initGitRepo(shared.projectDirectory);
  await setupOrThrow(shared.projectDirectory);
});

afterAll(() => {
  if (shared.projectDirectory) removeTemporaryDirectory(shared.projectDirectory);
});

// A legacy scenario block (bare [x], no annotations) — ledger-exempt, but it
// still counts as one RGR loop. Lets us drive the loop count without minting
// reachable SHAs.
const legacyLoop = (name: string) =>
  [`### Scenario: ${name}`, '', '- [x] RED', '- [x] GREEN', '- [x] REFACTOR'].join('\n');

// An annotated loop with two reachable SHAs for RED/GREEN — used where the
// ledger must actually validate (not legacy-exempt).
const annotatedLoop = (name: string, red: string, green: string) =>
  [
    `### Scenario: ${name}`,
    '',
    `- [x] RED ${red}`,
    `- [x] GREEN ${green}`,
    '- [x] REFACTOR skip: trivial',
  ].join('\n');

// Each fixture stays in_progress, so the hook's most-recent-in_progress
// resolution must pick the ticket under test — give each a strictly increasing
// last_modified so the newest write wins.

function writeTicket(
  ticketId: string,
  type: 'feature' | 'task',
  body: string,
  crossScenarioRow?: string,
): void {
  shared.ticketSeq += 1;
  const lastModified = `2026-06-20T10:${String(shared.ticketSeq).padStart(2, '0')}:00Z`;
  const folder = `.project/tickets/${ticketId}`;
  execSync(`mkdir -p "${shared.projectDirectory}/${folder}"`, { cwd: shared.projectDirectory });
  writeTestFile(
    shared.projectDirectory,
    `${folder}/ticket.md`,
    `---\nid: ${ticketId}\ntype: ${type}\nphase: done\nstatus: in_progress\nlast_modified: ${lastModified}\n---\n# Test\n`,
  );
  const testDefs = [
    '# Test Definitions',
    '',
    '## Rule: R',
    '',
    body,
    '',
    '## Feature-level cross-scenario refactor',
    '',
    ...(crossScenarioRow === undefined ? [] : [crossScenarioRow, '']),
  ].join('\n');
  writeTestFile(shared.projectDirectory, `${folder}/test-definitions.md`, testDefs);
  writeTestFile(
    shared.projectDirectory,
    `${folder}/verify.md`,
    'Verified\n\n## Verify Checklist\n\n**Test Suite:** ✓ 1/1 tests pass\n',
  );
}

function writeSkillLog(entries: string[]): void {
  const dir = nodePath.join(shared.projectDirectory, '.project');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    nodePath.join(dir, 'skill-invocations.log'),
    entries.length > 0 ? `${entries.join('\n')}\n` : '',
  );
}

function twoReachableShas(): [string, string] {
  execSync('git commit --allow-empty -q -m loop-c1', { cwd: shared.projectDirectory });
  const a = execSync('git rev-parse --short HEAD', { cwd: shared.projectDirectory })
    .toString()
    .trim();
  execSync('git commit --allow-empty -q -m loop-c2', { cwd: shared.projectDirectory });
  const b = execSync('git rev-parse --short HEAD', { cwd: shared.projectDirectory })
    .toString()
    .trim();
  return [a, b];
}

function runDoneGate(sessionId: string): { exitCode: number; reason: string } {
  const transcriptPath = nodePath.join(shared.projectDirectory, 'transcript.jsonl');
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
  const result = spawnSync('bun', ['.safeword/hooks/stop-quality.ts'], {
    input: JSON.stringify({
      transcript_path: transcriptPath,
      session_id: sessionId,
      // Tasks fall back to text evidence when no test command runs — supply it
      // so the task fixtures reach the ledger/skill gates under test.
      last_assistant_message: '1/1 tests pass',
    }),
    cwd: shared.projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: shared.projectDirectory },
    encoding: 'utf8',
  });
  const exitCode = result.status ?? 0;
  try {
    return { exitCode, reason: JSON.parse(result.stdout.trim()).reason ?? '' };
  } catch {
    return { exitCode, reason: '' };
  }
}

describe('whole-ticket quality-review + refactor gate (W610WW)', () => {
  it('a two-loop task with a missing cross-scenario row is blocked by the same validator as a feature', () => {
    const [a, b] = twoReachableShas();
    // Two annotated loops, NO cross-scenario row → required at >=2 loops.
    writeTicket(
      'w1',
      'task',
      [annotatedLoop('one', a, b), annotatedLoop('two', a, b)].join('\n\n'),
    );
    writeSkillLog(['2026-06-20T00:00:00Z session-w1 quality-review']);

    const result = runDoneGate('session-w1');

    expect(result.reason).toMatch(/cross-scenario/i);
    expect(result.reason).toMatch(/missing/i);
  });

  it('an annotated two-loop task without a logged quality review is blocked for it', () => {
    const [a, b] = twoReachableShas();
    writeTicket(
      'w2',
      'task',
      [annotatedLoop('one', a, b), annotatedLoop('two', a, b)].join('\n\n'),
      `- [x] cross-scenario ${a}`,
    );
    writeSkillLog([]); // no /quality-review entry

    const result = runDoneGate('session-w2');

    expect(result.reason).toContain('/quality-review');
    expect(result.reason.toLowerCase()).toContain('missing');
  });

  it('an annotated two-loop feature without a logged quality review is blocked for it', () => {
    const [a, b] = twoReachableShas();
    writeTicket(
      'w3',
      'feature',
      [annotatedLoop('one', a, b), annotatedLoop('two', a, b)].join('\n\n'),
      `- [x] cross-scenario ${a}`,
    );
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w3 verify',
      '2026-06-20T00:00:01Z session-w3 audit',
    ]); // verify + audit, but no quality-review

    const result = runDoneGate('session-w3');

    expect(result.reason).toContain('/quality-review');
  });

  it('an annotated two-loop feature with a logged quality review passes the review check', () => {
    const [a, b] = twoReachableShas();
    writeTicket(
      'w4',
      'feature',
      [annotatedLoop('one', a, b), annotatedLoop('two', a, b)].join('\n\n'),
      `- [x] cross-scenario ${a}`,
    );
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w4 verify',
      '2026-06-20T00:00:01Z session-w4 audit',
      '2026-06-20T00:00:02Z session-w4 quality-review',
    ]);

    const result = runDoneGate('session-w4');

    expect(result.reason).not.toMatch(/quality-review/);
  });

  it('a legacy unannotated multi-scenario TASK is NOT blocked for a missing quality review', () => {
    // The S1 regression guard: bare-[x] loops are exempt from BOTH halves of the
    // whole-ticket pass. A legacy task must not be newly gated on /quality-review.
    writeTicket('w7', 'task', [legacyLoop('one'), legacyLoop('two')].join('\n\n'));
    writeSkillLog([]); // nothing logged

    const result = runDoneGate('session-w7');

    expect(result.reason).not.toMatch(/quality-review/);
    expect(result.reason).not.toMatch(/cross-scenario/i);
  });

  it('a legacy unannotated multi-scenario FEATURE needs verify+audit but NOT quality-review', () => {
    writeTicket('w8', 'feature', [legacyLoop('one'), legacyLoop('two')].join('\n\n'));
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w8 verify',
      '2026-06-20T00:00:01Z session-w8 audit',
    ]); // verify + audit only — legacy ticket, no review required

    const result = runDoneGate('session-w8');

    expect(result.reason).not.toMatch(/quality-review/);
  });

  it('a single-loop feature is not blocked for a missing quality review', () => {
    writeTicket('w5', 'feature', legacyLoop('only'), '- [x] cross-scenario skip: none');
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w5 verify',
      '2026-06-20T00:00:01Z session-w5 audit',
    ]); // no quality-review, but single loop → not required

    const result = runDoneGate('session-w5');

    expect(result.reason).not.toMatch(/quality-review/);
  });

  it('a two-loop task with valid ledger, a filled row, and a logged review is not over-blocked', () => {
    const [a, b] = twoReachableShas();
    // Everything a >=2-loop task needs: valid annotated ledger, a filled
    // cross-scenario row, and a logged /quality-review. The de-fenced ledger
    // validation must not over-block a well-formed task.
    writeTicket(
      'w6',
      'task',
      [annotatedLoop('one', a, b), annotatedLoop('two', a, b)].join('\n\n'),
      `- [x] cross-scenario ${a}`,
    );
    writeSkillLog(['2026-06-20T00:00:00Z session-w6 quality-review']);

    const result = runDoneGate('session-w6');

    expect(result.reason).not.toMatch(/cross-scenario|quality-review|ledger/i);
  });
});
