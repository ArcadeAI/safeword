import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Real-collaborator wiring test: spawn each agent's deployed PostToolUse hook
// against a fixture project that has Go skills installed, and assert the nudge is
// emitted in that agent's output shape. Mocks only the process boundary (we feed
// stdin + a temp project on disk); everything else is the real hook + adapters +
// pure helpers + session-state IO.

const repoRoot = nodePath.join(process.cwd(), '..', '..');
const claudeHook = nodePath.join(repoRoot, '.safeword/hooks/post-tool-skill-nudge.ts');
const cursorHook = nodePath.join(repoRoot, '.safeword/hooks/cursor/post-tool-skill-nudge.ts');
const codexHook = nodePath.join(repoRoot, '.safeword/hooks/codex/post-tool-skill-nudge.ts');

// Holder object so beforeAll can set the path without a top-level reassignment.
const fixture = { dir: '' };
const goFile = (name: string): string => nodePath.join(fixture.dir, name);

function run(hookPath: string, input: unknown, projectDirectory: string = fixture.dir): string {
  const result = spawnSync('bun', [hookPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    cwd: fixture.dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    timeout: 30_000,
  });
  return result.stdout ?? '';
}

beforeAll(() => {
  fixture.dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-nudge-agents-'));
  mkdirSync(nodePath.join(fixture.dir, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(fixture.dir, '.project'), { recursive: true });
  // A single installed Go skill is enough for the `golang` prefix to be detected.
  mkdirSync(nodePath.join(fixture.dir, '.claude/skills/golang-context'), { recursive: true });
});

afterAll(() => {
  if (fixture.dir) rmSync(fixture.dir, { recursive: true, force: true });
});

describe('skill nudge fires across all three agents on a .go edit', () => {
  it('Claude — emits hookSpecificOutput.additionalContext', () => {
    const out = run(claudeHook, {
      tool_input: { file_path: goFile('a.go') },
      session_id: 'claude-1',
    });
    expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain('golang-*');
  });

  it('Cursor — forwards it as additional_context (resolving project from workspace_roots, not a stale CLAUDE_PROJECT_DIR)', () => {
    // Pass a deliberately wrong CLAUDE_PROJECT_DIR: the adapter must pin the
    // project to workspace_roots[0], or the nudge would silently no-op.
    const out = run(
      cursorHook,
      {
        tool_name: 'Write',
        tool_input: { file_path: goFile('b.go') },
        workspace_roots: [fixture.dir],
        conversation_id: 'cursor-1',
      },
      nodePath.join(fixture.dir, 'WRONG-stale-dir'),
    );
    expect(JSON.parse(out).additional_context).toContain('golang-*');
  });

  it('Codex — forwards it as hookSpecificOutput.additionalContext', () => {
    const out = run(codexHook, {
      tool_name: 'Edit',
      tool_input: { file_path: goFile('c.go') },
      session_id: 'codex-1',
    });
    expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain('golang-*');
  });

  it('stays silent for a non-Go (.py) edit — Claude', () => {
    const out = run(claudeHook, {
      tool_input: { file_path: goFile('d.py') },
      session_id: 'claude-2',
    });
    expect(out.trim()).toBe('');
  });
});
