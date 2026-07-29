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
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { stagedChangeAffectsArchitecture } from './lib/architecture-staged-scope.ts';

/**
 * Matches a simple executable `git commit` command, but rejects quoted command
 * text, shell prefixes, `git commit-tree`, `git commit-graph`, etc.
 */
const GIT_COMMIT_COMMAND = /^\s*git\s+commit\b(?!-)/;
const ARCHITECTURE_SOURCE_INDEX_ENV = 'SAFEWORD_ARCHITECTURE_SOURCE_INDEX';

interface ProjectedIndex {
  directory: string;
  path: string;
}

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
      if (SHORT_OPTIONS_WITH_OPTIONAL_ATTACHED_VALUE.has(option)) break;
      if (SHORT_OPTIONS_REQUIRING_VALUE.has(option)) {
        skipNextValue = index === cluster.length - 1;
        break;
      }
    }
  }
  return stagesAll && !nonCommitting;
}

const SHORT_OPTIONS_REQUIRING_VALUE = new Set(['C', 'F', 'c', 'm', 't']);
const SHORT_OPTIONS_WITH_OPTIONAL_ATTACHED_VALUE = new Set(['S', 'u']);
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

/**
 * Build the tree `git commit -a` will attempt in an isolated index. This lets
 * architecture generation see tracked worktree changes without moving them
 * into the user's real index if the eventual commit aborts.
 */
function projectTrackedWorktreeChanges(cwd: string): ProjectedIndex | undefined {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-commit-index-'));
  const projectedIndex = nodePath.join(directory, 'index');
  const projectedEnvironment = { ...process.env, GIT_INDEX_FILE: projectedIndex };
  try {
    const realIndex = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-path', 'index'],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    if (existsSync(realIndex)) {
      copyFileSync(realIndex, projectedIndex);
    } else {
      execFileSync('git', ['read-tree', '--empty'], {
        cwd,
        env: projectedEnvironment,
        stdio: 'ignore',
      });
    }
    execFileSync('git', ['add', '-u', '--', ':/'], {
      cwd,
      env: projectedEnvironment,
      stdio: 'ignore',
    });
    return { directory, path: projectedIndex };
  } catch {
    rmSync(directory, { recursive: true, force: true });
    return undefined;
  }
}

function runArchitectureHook(projectDir: string, gitCommand: string): void {
  const projectedIndex = stagesTrackedWorktreeChanges(gitCommand)
    ? projectTrackedWorktreeChanges(projectDir)
    : undefined;
  try {
    const sourceIndex = projectedIndex?.path;
    // Scope the auto-fix to commits that actually move the architecture shape (#425).
    // A routine commit (version bump, docs/config edit) stages nothing that feeds the
    // fingerprint, so regenerating and staging the generated doc into it would leak
    // unrelated churn. CI `architecture --check` remains the backstop for any drift
    // this skips.
    if (!stagedChangeAffectsArchitecture(projectDir, sourceIndex)) return;

    // Prefer local source in dev/dogfood, fall back to the published CLI. The CLI
    // owns the regenerate-and-stage logic (and the opt-out check); this hook is glue.
    const localCli = nodePath.join(projectDir, 'packages/cli/src/cli.ts');
    const [command, args] = existsSync(localCli)
      ? ['bun', [localCli, 'architecture', '--stage']]
      : ['bunx', ['safeword@latest', 'architecture', '--stage']];

    spawnSync(command as string, args as string[], {
      cwd: projectDir,
      env:
        sourceIndex === undefined
          ? process.env
          : { ...process.env, [ARCHITECTURE_SOURCE_INDEX_ENV]: sourceIndex },
      stdio: 'ignore',
      timeout: 30_000,
    });
  } finally {
    if (projectedIndex !== undefined) {
      rmSync(projectedIndex.directory, { recursive: true, force: true });
    }
  }
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

// The CLI stages the doc into the index, which lands in a plain `git commit` /
// `git commit -m`. A `git commit <pathspec>` can still override the index; CI
// catches that explicitly path-limited escape hatch.
runArchitectureHook(projectDir, gitCommand);

process.exit(0); // Always allow the commit to proceed.
