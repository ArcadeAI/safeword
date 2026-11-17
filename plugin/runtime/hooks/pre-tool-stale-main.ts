#!/usr/bin/env bun
// Safeword: warn (never block) before a `git checkout` / `git switch` to a branch
// that is behind or diverged from its upstream, so "catch up to main" doesn't
// silently repoint the worktree to stale content (#366). Uses already-fetched
// refs (no network); git's own `pull --ff-only` and CI remain the backstops.

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import {
  type BranchDivergence,
  changesDirectoryBeforeCheckout,
  decideStaleBranchWarning,
  parseCheckoutTarget,
} from './lib/branch-staleness.ts';
import { resolveLaunchDirectory, resolveToolProjectDirectory } from './lib/project-directory.ts';

interface HookInput {
  tool_name?: string;
  cwd?: string;
  tool_input?: { command?: string };
}

let input: HookInput;
try {
  input = (await Bun.stdin.json()) as HookInput;
} catch {
  process.exit(0); // No/invalid stdin — nothing to gate.
}

if ((input.tool_name ?? '') !== 'Bash') process.exit(0);

const command = input.tool_input?.command ?? '';
const target = parseCheckoutTarget(command);
if (target === null) process.exit(0);
// `cd repo; git switch x` checks out in another repository than the shell's.
if (changesDirectoryBeforeCheckout(command)) process.exit(0);

// The checkout runs in the shell's repository. Warn only when that repository
// is the Safeword project the shell resolves to: a shell in an unrelated,
// unenrolled repository must not be warned about the launch checkout's branch.
const launchDirectory = resolveLaunchDirectory();
const shellDirectory = nodePath.resolve(launchDirectory, input.cwd ?? '.');
const projectDir = resolveToolProjectDirectory(launchDirectory, {
  tool: 'Bash',
  editedFile: '',
  cwd: shellDirectory,
});
if (!existsSync(nodePath.join(projectDir, '.safeword'))) process.exit(0);
if (!isWithin(shellDirectory, projectDir)) process.exit(0);

const divergence = readBranchDivergence(shellDirectory, target);
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

/** Whether `directory` is `root` or inside it, comparing real paths. */
function isWithin(directory: string, root: string): boolean {
  const relative = nodePath.relative(realPath(root), realPath(directory));
  return relative === '' || (!relative.startsWith('..') && !nodePath.isAbsolute(relative));
}

function realPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return nodePath.resolve(path);
  }
}

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
