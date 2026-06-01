/**
 * Integration tests for the Stop-hook review backstop (ticket SXSCJQ). After
 * the LOC throttle was removed, the Stop review fires for any boundary not
 * already reviewed by PostToolUse — deduped via lastReviewedStep /
 * lastReviewedPhase — and is no longer gated by LOC delta.
 *
 * Non-TS project (no tsconfig) so the SW1SE5 typecheck gate stays silent and
 * the boundary backstop is the only thing that can speak.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');

interface BuildOptions {
  phase: string;
  testDefinitions?: string;
  state?: Record<string, unknown>;
}

function transcriptLine(): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name: 'Edit', id: 'toolu_1' },
        { type: 'text', text: 'Made changes.' },
      ],
    },
  });
}

function buildProject({ phase, testDefinitions, state }: BuildOptions): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  writeTestFile(cwd, '.gitignore', 'quality-state-*.json\n');
  writeTestFile(cwd, '.safeword/.gitkeep', ''); // "is this a safeword project?" guard
  writeTestFile(
    cwd,
    '.safeword-project/tickets/099-test/ticket.md',
    ['---', 'id: 099', 'status: in_progress', 'type: task', `phase: ${phase}`, '---'].join('\n'),
  );
  if (testDefinitions !== undefined) {
    writeTestFile(cwd, '.safeword-project/tickets/099-test/test-definitions.md', testDefinitions);
  }
  writeTestFile(cwd, 'transcript.jsonl', transcriptLine());
  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });

  writeTestFile(
    cwd,
    '.safeword-project/quality-state-test-session.json',
    JSON.stringify({
      activeTicket: '099',
      locSinceCommit: 0,
      lastCommitHash: '',
      gate: undefined,
      recentFailures: [],
      incrementedPatterns: [],
      ...state,
    }),
  );
  return cwd;
}

function runStop(cwd: string): { status: number | null; stdout: string } {
  const result = spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      transcript_path: nodePath.join(cwd, 'transcript.jsonl'),
      last_assistant_message: 'Made changes.',
      stop_hook_active: false,
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, stdout: (result.stdout ?? '').trim() };
}

const SCENARIO_GREEN = [
  '### Scenario: demo',
  '- [x] RED aaa1111',
  '- [x] GREEN bbb2222',
  '- [ ] REFACTOR',
  '',
].join('\n');

const SCENARIO_RED = [
  '### Scenario: demo',
  '- [x] RED aaa1111',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
].join('\n');

describe('Stop review backstop (SXSCJQ)', () => {
  let cwd = '';
  afterEach(() => {
    if (cwd) removeTemporaryDirectory(cwd);
    cwd = '';
  });

  it('skips the step review when PostToolUse already reviewed it (S3.1)', () => {
    // deriveTddStep → "green" (RED+GREEN checked); marker says green already reviewed.
    cwd = buildProject({
      phase: 'implement',
      testDefinitions: SCENARIO_GREEN,
      state: { lastReviewedStep: 'green' },
    });

    const run = runStop(cwd);

    expect(run.status).toBe(0);
    expect(run.stdout).toBe(''); // no decision:block — deduped
  });

  it('fires the phase review for an un-reviewed boundary — backstop (S3.2)', () => {
    cwd = buildProject({ phase: 'define-behavior' }); // no lastReviewedPhase marker

    const run = runStop(cwd);

    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('define-behavior');
  });

  it('fires a step review on a tiny change — no LOC throttle (S4.1)', () => {
    // deriveTddStep → "red"; only 3 LOC changed — the old throttle (>50) would
    // have suppressed this. No lastReviewedStep marker, so it must fire.
    cwd = buildProject({
      phase: 'implement',
      testDefinitions: SCENARIO_RED,
      state: { locSinceCommit: 3, locAtLastReview: 0 },
    });

    const run = runStop(cwd);

    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('TDD: RED');
  });
});
