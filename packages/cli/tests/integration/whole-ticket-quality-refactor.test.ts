/**
 * Integration: whole-ticket quality-review + refactor gate end-to-end (W610WW)
 *
 * Exercises the wired done-gate path:
 *  - The cross-scenario ledger validation now runs for TASKS too (the isFeature
 *    fence is gone), so a multi-loop task with a missing refactor row is blocked.
 *  - The skill-invocation requirement is loop-count-aware: a >=2-loop ticket
 *    needs /quality-review; a single-loop ticket does not.
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

// A legacy scenario block (bare [x], no annotations) — ledger-exempt, but it
// still counts as one RGR loop. Lets us drive the loop count without minting
// reachable SHAs.
const legacyLoop = (name: string) =>
  [`### Scenario: ${name}`, '', '- [x] RED', '- [x] GREEN', '- [x] REFACTOR'].join('\n');

// Each fixture stays in_progress, so the hook's most-recent-in_progress
// resolution must pick the ticket under test — give each a strictly increasing
// last_modified so the newest write wins.
let ticketSeq = 0;

function writeTicket(
  ticketId: string,
  type: 'feature' | 'task',
  body: string,
  crossScenarioRow?: string,
): void {
  ticketSeq += 1;
  const lastModified = `2026-06-20T10:${String(ticketSeq).padStart(2, '0')}:00Z`;
  const folder = `.project/tickets/${ticketId}`;
  execSync(`mkdir -p "${projectDirectory}/${folder}"`, { cwd: projectDirectory });
  writeTestFile(
    projectDirectory,
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
  writeTestFile(projectDirectory, `${folder}/test-definitions.md`, testDefs);
  writeTestFile(
    projectDirectory,
    `${folder}/verify.md`,
    'Verified\n\n## Verify Checklist\n\n**Test Suite:** ✓ 1/1 tests pass\n',
  );
}

function writeSkillLog(entries: string[]): void {
  const dir = nodePath.join(projectDirectory, '.project');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    nodePath.join(dir, 'skill-invocations.log'),
    entries.length > 0 ? `${entries.join('\n')}\n` : '',
  );
}

function twoReachableShas(): [string, string] {
  execSync('git commit --allow-empty -q -m loop-c1', { cwd: projectDirectory });
  const a = execSync('git rev-parse --short HEAD', { cwd: projectDirectory }).toString().trim();
  execSync('git commit --allow-empty -q -m loop-c2', { cwd: projectDirectory });
  const b = execSync('git rev-parse --short HEAD', { cwd: projectDirectory }).toString().trim();
  return [a, b];
}

function runDoneGate(sessionId: string): { exitCode: number; reason: string } {
  const transcriptPath = nodePath.join(projectDirectory, 'transcript.jsonl');
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
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
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
    const annotated = (name: string) =>
      [
        `### Scenario: ${name}`,
        '',
        `- [x] RED ${a}`,
        `- [x] GREEN ${b}`,
        '- [x] REFACTOR skip: trivial',
      ].join('\n');
    // Two annotated loops, NO cross-scenario row → required at >=2 loops.
    writeTicket('w1', 'task', [annotated('one'), annotated('two')].join('\n\n'));
    writeSkillLog(['2026-06-20T00:00:00Z session-w1 quality-review']);

    const result = runDoneGate('session-w1');

    expect(result.reason).toMatch(/cross-scenario/i);
    expect(result.reason).toMatch(/missing/i);
  });

  it('a two-loop task without a logged quality review is blocked for it', () => {
    writeTicket(
      'w2',
      'task',
      [legacyLoop('one'), legacyLoop('two')].join('\n\n'),
      '- [x] cross-scenario skip: none',
    );
    writeSkillLog([]); // no /quality-review entry

    const result = runDoneGate('session-w2');

    expect(result.reason).toContain('/quality-review');
    expect(result.reason.toLowerCase()).toContain('missing');
  });

  it('a two-loop feature without a logged quality review is blocked for it', () => {
    writeTicket(
      'w3',
      'feature',
      [legacyLoop('one'), legacyLoop('two')].join('\n\n'),
      '- [x] cross-scenario skip: none',
    );
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w3 verify',
      '2026-06-20T00:00:01Z session-w3 audit',
    ]); // verify + audit, but no quality-review

    const result = runDoneGate('session-w3');

    expect(result.reason).toContain('/quality-review');
  });

  it('a two-loop feature with a logged quality review passes the review check', () => {
    writeTicket(
      'w4',
      'feature',
      [legacyLoop('one'), legacyLoop('two')].join('\n\n'),
      '- [x] cross-scenario skip: none',
    );
    writeSkillLog([
      '2026-06-20T00:00:00Z session-w4 verify',
      '2026-06-20T00:00:01Z session-w4 audit',
      '2026-06-20T00:00:02Z session-w4 quality-review',
    ]);

    const result = runDoneGate('session-w4');

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
});
