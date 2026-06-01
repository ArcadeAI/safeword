/**
 * Integration test for the implement-phase-stop typecheck gate wired into the
 * real stop-quality hook (ticket SW1SE5, test-definitions Rules 2-4). Spawns
 * `.safeword/hooks/stop-quality.ts` against a fixture TS project with an
 * uncommitted type error and asserts the error is surfaced as a soft (non-
 * blocking) advice, and not surfaced at the done phase.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');
const ADVICE_MARKER = 'TypeScript errors in your changed files';

interface HookRun {
  status: number | null;
  stdout: string;
}

/** A TS project: git baseline (clean) + an uncommitted type error, ticket at `phase`. */
function buildProject(phase: string): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);

  const cliTsc = nodePath.resolve(import.meta.dirname, '../../node_modules/.bin/tsc');
  mkdirSync(nodePath.join(cwd, 'node_modules/.bin'), { recursive: true });
  symlinkSync(realpathSync(cliTsc), nodePath.join(cwd, 'node_modules/.bin/tsc'));

  writeTestFile(
    cwd,
    'tsconfig.json',
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true, skipLibCheck: true } }),
  );
  writeTestFile(cwd, '.gitignore', 'node_modules\n*.tsbuildinfo\nquality-state-*.json\n');
  writeTestFile(cwd, '.safeword/.gitkeep', ''); // hook's "is this a safeword project?" guard
  writeTestFile(cwd, 'src/app.ts', 'export const ok: string = "ok";\n');
  // A task (not feature) so the feature-artifact gate doesn't fire first; the
  // tsc gate is ticket-type-agnostic.
  writeTestFile(
    cwd,
    '.safeword-project/tickets/099-test/ticket.md',
    ['---', 'id: 099', 'status: in_progress', 'type: task', `phase: ${phase}`, '---'].join('\n'),
  );
  writeTestFile(
    cwd,
    '.safeword-project/quality-state-test-session.json',
    JSON.stringify({ activeTicket: '099', locSinceCommit: 0, locAtLastReview: 0 }),
  );
  writeTestFile(cwd, 'transcript.jsonl', transcriptLine());

  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });

  // Introduce an uncommitted type error in the tracked file.
  writeTestFile(cwd, 'src/app.ts', 'export const ok: string = 1;\n');
  return cwd;
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

function runStop(cwd: string, stopHookActive = false): HookRun {
  const result = spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      session_id: 'test-session',
      transcript_path: nodePath.join(cwd, 'transcript.jsonl'),
      last_assistant_message: 'Made changes.',
      stop_hook_active: stopHookActive,
    }),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout ?? '' };
}

describe('stop-quality implement-stop typecheck gate (SW1SE5 Rules 2-4)', () => {
  let cwd = '';
  afterEach(() => {
    if (cwd) removeTemporaryDirectory(cwd);
    cwd = '';
  });
  beforeEach(() => {
    cwd = '';
  });

  it('surfaces the tsc error as a soft block at an implement-phase stop (Rules 2 + 3)', () => {
    cwd = buildProject('implement');

    const run = runStop(cwd);

    // Soft: emitted as decision:block, process exits 0 (never a non-zero hard fail).
    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain(ADVICE_MARKER);
    expect(parsed.reason).toMatch(/error TS/);
    expect(parsed.reason).toMatch(/app\.ts/);
  });

  it('allows the stop on the next cycle (stop_hook_active) — advisory, not a wall (Rule 3)', () => {
    cwd = buildProject('implement');

    const second = runStop(cwd, true);

    // Bypass cycle: the hook exits 0 with no block, so the agent can stop.
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe('');
  });

  it('does not fire the typecheck-advice path at the done phase (Rule 4)', () => {
    cwd = buildProject('done');

    const run = runStop(cwd);

    expect(run.stdout).not.toContain(ADVICE_MARKER);
  });
});
