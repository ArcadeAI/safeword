#!/usr/bin/env bun
// Safeword: Architecture doc commit-time auto-fix (PreToolUse on `git commit`)
// When the agent commits, regenerate a stale generated architecture doc
// (.project/architecture.generated.md) and stage it into the in-flight commit so
// the commit lands fresh — the "block later" half of inform-early/block-later,
// implemented as auto-fix rather than a block. Honors the per-project opt-out
// (architectureDocEnforcement: false, read by the CLI). Best-effort: never
// blocks the commit (always exits 0); CI `safeword architecture --check` is the
// hard backstop for a bypassed hook or a hand-written commit.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

/**
 * Matches `git commit` (any flags / message after) but rejects `git commit-tree`,
 * `git commit-graph`, etc. The trailing (?!-) lookahead is what distinguishes them.
 */
const GIT_COMMIT_COMMAND = /\bgit\s+commit\b(?!-)/;

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
}

let input: HookInput;
try {
  input = (await Bun.stdin.json()) as HookInput;
} catch {
  process.exit(0); // No/invalid stdin — nothing to gate.
}

// Only the agent's `git commit` is in scope; everything else passes through.
if ((input.tool_name ?? '') !== 'Bash') process.exit(0);
if (!GIT_COMMIT_COMMAND.test(input.tool_input?.command ?? '')) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project — nothing to do.
if (!existsSync(nodePath.join(projectDir, '.safeword'))) process.exit(0);

// Prefer local source in dev/dogfood, fall back to the published CLI. The CLI
// owns the regenerate-and-stage logic (and the opt-out check); this hook is glue.
//
// The CLI stages the doc into the index, which lands in a plain `git commit` /
// `git commit -m`. It can miss two less-common forms: `git commit <pathspec>`
// (the pathspec overrides the index) and `git commit -a` for a brand-new
// untracked doc (`-a` only re-stages tracked files). In those cases the doc is
// regenerated and staged but not committed — caught by the CI `architecture
// --check` backstop, which is exactly why that backstop exists.
const localCli = nodePath.join(projectDir, 'packages/cli/src/cli.ts');
const [command, args] = existsSync(localCli)
  ? ['bun', [localCli, 'architecture', '--stage']]
  : ['bunx', ['safeword@latest', 'architecture', '--stage']];

spawnSync(command as string, args as string[], {
  cwd: projectDir,
  stdio: 'ignore',
  timeout: 30_000,
});

process.exit(0); // Always allow the commit to proceed.
