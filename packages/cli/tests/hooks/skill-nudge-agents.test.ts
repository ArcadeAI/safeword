import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

describe('dispatcher path — points at the entry skill and surfaces its description', () => {
  // The full pack installs the `golang-how-to` orchestrator alongside the atomic
  // skills. With it present, the nudge names it directly and inlines its own
  // SKILL.md description, instead of the generic concerns fallback. One agent
  // (Claude) is enough: the adapters forward the Claude output verbatim, already
  // proven by the cross-agent tests above; the dispatcher-vs-fallback branch lives
  // in the shared pure lib and is agent-independent.
  const disp = { dir: '' };
  const description =
    'Golang skills orchestrator — always active; routes to the most relevant skills.';

  beforeAll(() => {
    disp.dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-nudge-dispatch-'));
    mkdirSync(nodePath.join(disp.dir, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(disp.dir, '.project'), { recursive: true });
    mkdirSync(nodePath.join(disp.dir, '.claude/skills/golang-context'), { recursive: true });
    const howTo = nodePath.join(disp.dir, '.claude/skills/golang-how-to');
    mkdirSync(howTo, { recursive: true });
    writeFileSync(
      nodePath.join(howTo, 'SKILL.md'),
      `---\nname: golang-how-to\ndescription: "${description}"\n---\n# How to\n`,
    );
  });

  afterAll(() => {
    if (disp.dir) rmSync(disp.dir, { recursive: true, force: true });
  });

  it('Claude — names golang-how-to and inlines its description verbatim', () => {
    const result = spawnSync('bun', [claudeHook], {
      input: JSON.stringify({
        tool_input: { file_path: nodePath.join(disp.dir, 'x.go') },
        session_id: 'disp-1',
      }),
      encoding: 'utf8',
      cwd: disp.dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: disp.dir },
      timeout: 30_000,
    });
    const context = JSON.parse(result.stdout ?? '').hookSpecificOutput.additionalContext;
    expect(context).toContain('golang-how-to');
    expect(context).toContain(description);
    // The direct pointer replaces the generic "golang-* skill that fits" fallback.
    expect(context).not.toContain('golang-*');
  });
});
