import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
const GO_SKILL_DESC = 'Idiomatic Go: goroutines, channels, generics, error handling.';

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
  // Go is a single-skill pack (golang-pro, no dispatcher) — the sole installed dir
  // is the entry, and its SKILL.md description is surfaced. Same shape as Py/TS/Rust.
  //
  // Model the REAL `--copy` layout: the skill is copied into BOTH agent roots
  // (.claude/skills for claude-code, .agents/skills shared by codex+cursor). The
  // hook must treat that as one skill, not two — a regression guard for the bug
  // where duplicate dirs made entrySkillFor return null and the description nudge
  // silently degraded to the generic fallback in every real install.
  for (const root of ['.claude/skills/golang-pro', '.agents/skills/golang-pro']) {
    const skill = nodePath.join(fixture.dir, root);
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      nodePath.join(skill, 'SKILL.md'),
      `---\nname: golang-pro\ndescription: "${GO_SKILL_DESC}"\n---\n# Go\n`,
    );
  }
});

afterAll(() => {
  if (fixture.dir) rmSync(fixture.dir, { recursive: true, force: true });
});

describe('skill nudge fires across all three agents on a .go edit (single-skill entry + description)', () => {
  it('Claude — emits hookSpecificOutput.additionalContext naming golang-pro + its description', () => {
    const out = run(claudeHook, {
      tool_input: { file_path: goFile('a.go') },
      session_id: 'claude-1',
    });
    const context = JSON.parse(out).hookSpecificOutput.additionalContext;
    expect(context).toContain('golang-pro');
    expect(context).toContain(GO_SKILL_DESC);
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
    expect(JSON.parse(out).additional_context).toContain(GO_SKILL_DESC);
  });

  it('Codex — forwards it as hookSpecificOutput.additionalContext', () => {
    const out = run(codexHook, {
      tool_name: 'Edit',
      tool_input: { file_path: goFile('c.go') },
      session_id: 'codex-1',
    });
    expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain(GO_SKILL_DESC);
  });

  it('stays silent for a non-Go (.py) edit — Claude', () => {
    const out = run(claudeHook, {
      tool_input: { file_path: goFile('d.py') },
      session_id: 'claude-2',
    });
    expect(out.trim()).toBe('');
  });
});

describe('single-skill path (no dispatcher) — the sole installed dir is the entry', () => {
  // Python/TS/Rust install ONE skill with no dispatcher: the nudge discovers the
  // sole `<prefix>-*` dir from disk as the entry and inlines its SKILL.md
  // description. This spawns the real Claude hook end-to-end for that path (the
  // dispatcher path above does the same for Go), and covers BOTH description
  // shapes a real source uses — Python's inline scalar and Rust's folded block
  // scalar (the only shape exercised in production, previously unit-tested only).
  const CASES = [
    {
      lang: 'Python',
      ext: 'py',
      skillDir: 'python-pro',
      frontmatter: 'description: "Use when writing idiomatic Python: typing, async, packaging."',
      expected: 'Use when writing idiomatic Python: typing, async, packaging.',
    },
    {
      lang: 'Rust',
      ext: 'rs',
      skillDir: 'rust-skills',
      // Folded block scalar (`>`): the parser joins the wrapped lines with spaces.
      frontmatter:
        'description: >\n  Rust idioms: ownership and borrowing, Result and the ?\n  operator, traits, lifetimes, async.',
      expected:
        'Rust idioms: ownership and borrowing, Result and the ? operator, traits, lifetimes, async.',
    },
  ];

  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it.each(CASES)('Claude — $lang names $skillDir and inlines its description', testCase => {
    dir = mkdtempSync(nodePath.join(tmpdir(), 'sw-nudge-single-'));
    mkdirSync(nodePath.join(dir, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(dir, '.project'), { recursive: true });
    const skill = nodePath.join(dir, '.claude/skills', testCase.skillDir);
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      nodePath.join(skill, 'SKILL.md'),
      `---\nname: ${testCase.skillDir}\n${testCase.frontmatter}\n---\n# skill\n`,
    );

    const result = spawnSync('bun', [claudeHook], {
      input: JSON.stringify({
        tool_input: { file_path: nodePath.join(dir, `x.${testCase.ext}`) },
        session_id: `single-${testCase.ext}`,
      }),
      encoding: 'utf8',
      cwd: dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      timeout: 30_000,
    });
    const context = JSON.parse(result.stdout ?? '').hookSpecificOutput.additionalContext;
    expect(context).toContain(testCase.skillDir);
    expect(context).toContain(testCase.expected);
    // Single-skill packs have no dispatcher, so the Go orchestrator never appears.
    expect(context).not.toContain('golang-how-to');
  });
});
