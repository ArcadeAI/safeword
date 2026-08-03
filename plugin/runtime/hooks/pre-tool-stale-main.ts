#!/usr/bin/env bun
// Safeword: warn (never block) before a `git checkout` / `git switch` to a branch
// that is behind or diverged from its upstream, so "catch up to main" doesn't
// silently repoint the worktree to stale content (#366). Uses already-fetched
// refs (no network); git's own `pull --ff-only` and CI remain the backstops.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import {
  type BranchDivergence,
  decideStaleBranchWarning,
  parseCheckoutTarget,
} from './lib/branch-staleness.ts';

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

if ((input.tool_name ?? '') !== 'Bash') process.exit(0);

const target = parseCheckoutTarget(input.tool_input?.command ?? '');
if (target === null) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(nodePath.join(projectDir, '.safeword'))) process.exit(0);

const divergence = readBranchDivergence(projectDir, target);
if (divergence === null) process.exit(0);

const warning = decideStaleBranchWarning(divergence);
if (warning === null) process.exit(0);

// Non-blocking: surface the warning as context + a system message, but always
// allow the checkout to proceed (the agent may want the stale branch on purpose).
console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: warning },
    systemMessage: warning,
  }),
);
process.exit(0);

function git(cwd: string, args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function readBranchDivergence(cwd: string, branch: string): BranchDivergence | null {
  // Only real local branches have an upstream-staleness story.
  if (git(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]) === null) return null;

  const upstream = git(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    `${branch}@{upstream}`,
  ]);
  if (upstream === null || upstream === '') return null;

  const counts = git(cwd, ['rev-list', '--left-right', '--count', `${branch}...${upstream}`]);
  if (counts === null) return null;
  const [aheadRaw, behindRaw] = counts.split(/\s+/);
  const ahead = Number(aheadRaw);
  const behind = Number(behindRaw);
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return null;

  return { branch, upstream, ahead, behind };
}
