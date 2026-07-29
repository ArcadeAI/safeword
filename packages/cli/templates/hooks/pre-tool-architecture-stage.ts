#!/usr/bin/env bun
// Safeword: Architecture doc commit-time auto-fix (PreToolUse on `git commit`)
// When the agent commits, regenerate a stale generated architecture doc
// (.project/architecture.generated.md) and stage it into the in-flight commit so
// the commit lands fresh — the "block later" half of inform-early/block-later,
// implemented as auto-fix rather than a block. Honors the per-project opt-out
// (architectureDocEnforcement: false, read by the CLI). Best-effort: never
// blocks the commit (always exits 0); CI `safeword architecture --check` is the
// hard backstop for a bypassed hook or a hand-written commit.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { stagedChangeAffectsArchitecture } from './lib/architecture-staged-scope.ts';

/**
 * Matches a simple executable `git commit` command, but rejects quoted command
 * text, shell prefixes, `git commit-tree`, `git commit-graph`, etc.
 */
const GIT_COMMIT_COMMAND = /^\s*git\s+commit\b(?!-)/;

/** Whether the commit command asks Git to stage every tracked modification. */
function stagesTrackedWorktreeChanges(command: string): boolean {
  const match = GIT_COMMIT_COMMAND.exec(command);
  if (match === null) return false;
  const tokens = shellTokens(command.slice(match.index + match[0].length));
  let skipNextValue = false;
  let stagesAll = false;
  let nonCommitting = false;

  for (const token of tokens) {
    if (skipNextValue) {
      skipNextValue = false;
      continue;
    }
    if (token === '--') break;
    if (token === '--all') {
      stagesAll = true;
      continue;
    }
    if (isNonCommittingLongOption(token)) {
      nonCommitting = true;
      continue;
    }
    if (token.startsWith('--')) {
      skipNextValue = isLongOptionWithValue(token);
      if (token.includes('=')) skipNextValue = false;
      continue;
    }
    if (!token.startsWith('-') || token === '-') continue;

    const cluster = token.slice(1);
    for (const [index, option] of [...cluster].entries()) {
      if (option === 'a') {
        stagesAll = true;
        continue;
      }
      if (option === 'h' || option === 'z') {
        nonCommitting = true;
        continue;
      }
      if (SHORT_OPTIONS_WITH_ATTACHED_VALUES.has(option)) break;
      if (SHORT_OPTIONS_WITH_VALUES.has(option)) {
        skipNextValue = index === cluster.length - 1;
        break;
      }
    }
  }
  return stagesAll && !nonCommitting;
}

const SHORT_OPTIONS_WITH_VALUES = new Set(['C', 'F', 'c', 'm', 't']);
const SHORT_OPTIONS_WITH_ATTACHED_VALUES = new Set(['S', 'u']);
const NON_COMMITTING_LONG_OPTIONS = new Set([
  '--dry-run',
  '--help',
  '--long',
  '--null',
  '--porcelain',
  '--short',
]);

/** Git accepts an unambiguous prefix of a long option (for example `--dry`). */
function isNonCommittingLongOption(token: string): boolean {
  return (
    !token.includes('=') &&
    [...NON_COMMITTING_LONG_OPTIONS].some(option => option.startsWith(token))
  );
}

const LONG_OPTIONS_WITH_VALUES = new Set([
  '--author',
  '--cleanup',
  '--date',
  '--file',
  '--fixup',
  '--message',
  '--pathspec-from-file',
  '--reedit-message',
  '--reuse-message',
  '--squash',
  '--template',
  '--trailer',
]);

/** Git also accepts unambiguous prefixes of value-taking long options. */
function isLongOptionWithValue(token: string): boolean {
  const optionName = token.split('=', 1)[0] ?? token;
  return [...LONG_OPTIONS_WITH_VALUES].some(option => option.startsWith(optionName));
}

/** Minimal shell tokenizer: honors quoting/escaping and stops at a command separator. */
function shellTokens(commandTail: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: "'" | '"' | undefined;
  let escaped = false;

  const flush = (): void => {
    if (token.length > 0) tokens.push(token);
    token = '';
  };

  for (const character of commandTail) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === '\\' && quote !== "'") {
      escaped = true;
    } else if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ';' || character === '|' || character === '&' || character === '\n') {
      flush();
      break;
    } else if (/\s/.test(character)) {
      flush();
    } else {
      token += character;
    }
  }
  flush();
  return tokens;
}

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
const gitCommand = input.tool_input?.command ?? '';
if (!GIT_COMMIT_COMMAND.test(gitCommand)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project — nothing to do.
if (!existsSync(nodePath.join(projectDir, '.safeword'))) process.exit(0);

// PreToolUse runs before `git commit -a` performs its automatic staging. Mirror
// that documented tracked-file update now so the scope gate and architecture
// snapshot see the same tree the commit will record. This does not add
// untracked files, matching Git's `-a` semantics.
if (stagesTrackedWorktreeChanges(gitCommand)) {
  try {
    execFileSync('git', ['add', '-u', '--', ':/'], { cwd: projectDir, stdio: 'ignore' });
  } catch {
    // Best effort: the hook never blocks. CI remains the freshness backstop.
  }
}

// Scope the auto-fix to commits that actually move the architecture shape (#425).
// A routine commit (version bump, docs/config edit) stages nothing that feeds the
// fingerprint, so regenerating and staging the generated doc into it would leak
// unrelated churn. CI `architecture --check` remains the backstop for any drift
// this skips.
if (!stagedChangeAffectsArchitecture(projectDir)) process.exit(0);

// Prefer local source in dev/dogfood, fall back to the published CLI. The CLI
// owns the regenerate-and-stage logic (and the opt-out check); this hook is glue.
//
// The CLI stages the doc into the index, which lands in a plain `git commit` /
// `git commit -m`. A `git commit <pathspec>` can still override the index; CI
// catches that explicitly path-limited escape hatch.
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
