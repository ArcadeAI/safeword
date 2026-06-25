/**
 * Integration test for the done-gate dependency-readiness check wired into the
 * real stop-quality hook (issue #325). When a fresh worktree lacks installed
 * dependencies, the done-gate's own test run fails with `command not found`
 * (exit 127) and was mislabeled as "Tests failed". The gate now fails closed
 * with the install recovery instead, and does not fire when dependencies are
 * present.
 *
 * Spawns `.safeword/hooks/stop-quality.ts` against a Bun fixture project at the
 * done phase, toggling whether `node_modules` is present.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  dependencyInputFingerprint,
  detectDependencyPlan,
} from '../../../../.safeword/hooks/lib/dependency-readiness';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');

interface HookRun {
  status: number | null;
  stdout: string;
}

/** A Bun task project at the done phase. `installed` controls node_modules. */
function buildProject(installed: boolean): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);

  writeTestFile(
    cwd,
    'package.json',
    JSON.stringify({ packageManager: 'bun@1.3.14', scripts: { 'test:done': 'echo ok' } }),
  );
  writeTestFile(cwd, 'bun.lock', '{}\n');
  writeTestFile(cwd, '.gitignore', 'node_modules\nquality-state-*.json\n');
  writeTestFile(cwd, '.safeword/.gitkeep', ''); // hook's "is this a safeword project?" guard
  // A task (not feature) so the feature-artifact / scenario gates don't fire
  // first; the readiness check is the first gate in the done branch.
  writeTestFile(
    cwd,
    '.safeword-project/tickets/099-test/ticket.md',
    ['---', 'id: 099', 'status: in_progress', 'type: task', 'phase: done', '---'].join('\n'),
  );
  writeTestFile(
    cwd,
    '.safeword-project/quality-state-test-session.json',
    JSON.stringify({ activeTicket: '099', locSinceCommit: 0, locAtLastReview: 0 }),
  );
  writeTestFile(cwd, 'transcript.jsonl', transcriptLine());

  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });

  if (installed) {
    // Mark node_modules present AND fresh: stamp the fingerprint marker so
    // readiness resolves to `ready` deterministically (not mtime-dependent).
    const plan = detectDependencyPlan(cwd);
    if (!plan) throw new Error('expected a Bun dependency plan for the fixture');
    const fingerprint = dependencyInputFingerprint(cwd, plan);
    writeTestFile(cwd, 'node_modules/.safeword-deps-fingerprint', fingerprint);
  }

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

function runStop(cwd: string): HookRun {
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
  return { status: result.status, stdout: result.stdout ?? '' };
}

describe('stop-quality done-gate dependency readiness (#325)', () => {
  let cwd = '';
  afterEach(() => {
    if (cwd) removeTemporaryDirectory(cwd);
    cwd = '';
  });
  beforeEach(() => {
    cwd = '';
  });

  it('blocks with the install recovery — not "Tests failed" — when node_modules is missing', () => {
    cwd = buildProject(false);

    const run = runStop(cwd);

    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    // UJSZXB reworded this to plain language ("this project's tools aren't
    // installed yet …"); the install command is still surfaced verbatim.
    expect(parsed.reason).toContain("tools aren't installed");
    expect(parsed.reason).toContain('bun ci');
    // The whole point: a missing toolchain must not masquerade as a red test.
    expect(parsed.reason).not.toContain('Tests failed');
  });

  it('does not fire the readiness block when dependencies are present', () => {
    cwd = buildProject(true);

    const run = runStop(cwd);

    // Positively assert it advanced PAST the readiness gate to a later one: a
    // task at done with no verify.md blocks on that instead. (A negative-only
    // "no recovery message" check could pass even if the gate were skipped.)
    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout) as { decision?: string; reason?: string };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).not.toContain("tools aren't installed");
    expect(parsed.reason).toContain('verify.md');
  });
});
