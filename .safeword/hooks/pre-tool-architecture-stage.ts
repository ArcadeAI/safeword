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
import { commandWordIndex, parseShellCommandList, parseShellWords } from './lib/shell-segments.ts';

const ARCHITECTURE_SOURCE_INDEX_ENV = 'SAFEWORD_ARCHITECTURE_SOURCE_INDEX';
const ARCHITECTURE_KEEP_MATERIALIZED_ENV = 'SAFEWORD_ARCHITECTURE_KEEP_MATERIALIZED';

interface ProjectedIndex {
  directory: string;
  path: string;
}

interface GitCommitPlan {
  arguments: string[];
  directory: string;
  environment: Record<string, string>;
  globalArguments: string[];
  precedingAdds: GitInvocation[];
}

interface GitInvocation {
  arguments: string[];
  directory: string;
  environment: Record<string, string>;
  globalArguments: string[];
  name: string;
}

const GIT_GLOBAL_OPTIONS_REQUIRING_VALUE = new Set([
  '-C',
  '-c',
  '--attr-source',
  '--config-env',
  '--git-dir',
  '--namespace',
  '--super-prefix',
  '--work-tree',
]);
const GIT_GLOBAL_FLAGS = new Set([
  '-P',
  '-p',
  '--bare',
  '--glob-pathspecs',
  '--icase-pathspecs',
  '--literal-pathspecs',
  '--no-advice',
  '--no-lazy-fetch',
  '--no-optional-locks',
  '--no-pager',
  '--no-replace-objects',
  '--noglob-pathspecs',
  '--paginate',
]);
const GIT_GLOBAL_NON_COMMAND_OPTIONS = new Set([
  '--exec-path',
  '--help',
  '--html-path',
  '--info-path',
  '--man-path',
  '--version',
]);

/** Return a Git subcommand and effective context after consuming documented global options. */
function gitSubcommand(
  tokens: string[],
  baseDirectory: string,
  environment: Record<string, string>,
): GitInvocation | undefined {
  if (tokens[0] !== 'git') return undefined;
  let directory = baseDirectory;
  const globalArguments: string[] = [];
  const gitEnvironment = { ...environment };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || GIT_GLOBAL_NON_COMMAND_OPTIONS.has(token)) return undefined;
    if (!token.startsWith('-')) {
      return {
        arguments: tokens.slice(index + 1),
        directory,
        environment: gitEnvironment,
        globalArguments,
        name: token,
      };
    }
    if (token === '--bare') return undefined;
    if (GIT_GLOBAL_FLAGS.has(token)) {
      globalArguments.push(token);
      continue;
    }
    if (token.startsWith('-C') && token !== '-C') {
      directory = nodePath.resolve(directory, token.slice(2));
      continue;
    }
    if (token.startsWith('-c') && token !== '-c') {
      globalArguments.push(token);
      continue;
    }

    const optionName = token.split('=', 1)[0] ?? token;
    if (GIT_GLOBAL_OPTIONS_REQUIRING_VALUE.has(optionName)) {
      const value = token.includes('=') ? token.slice(token.indexOf('=') + 1) : tokens[index + 1];
      if (value === undefined) return undefined;
      if (optionName === '-C') {
        directory = nodePath.resolve(directory, value);
      } else if (optionName === '--git-dir') {
        gitEnvironment.GIT_DIR = nodePath.resolve(directory, value);
      } else if (optionName === '--work-tree') {
        gitEnvironment.GIT_WORK_TREE = nodePath.resolve(directory, value);
      } else {
        globalArguments.push(token);
        if (!token.includes('=')) globalArguments.push(value);
      }
      if (!token.includes('=')) index += 1;
      continue;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Find the first commit segment and the `git add` segments that Bash will run
 * before it. The hook executes before the whole command list, so those adds
 * must be projected into an isolated index to see the commit's eventual tree.
 */
function gitCommitPlan(command: string, baseDirectory: string): GitCommitPlan | undefined {
  const precedingAdds: GitInvocation[] = [];
  let directory = baseDirectory;
  for (const segment of parseShellCommandList(command)) {
    const words = parseShellWords(segment.command);
    const commandIndex = commandWordIndex(words);
    const commandWords = words.slice(commandIndex);
    const environment = gitSelectorEnvironment(words.slice(0, commandIndex), directory);
    if (commandWords[0] === 'cd') {
      const changedDirectory = resolveCdDirectory(commandWords.slice(1), directory);
      if (changedDirectory === undefined || segment.operatorAfter === '||') return undefined;
      directory = changedDirectory;
      continue;
    }

    const invocation = gitSubcommand(commandWords, directory, environment);
    if (invocation?.name === 'commit') {
      if (commitOptionEffects(invocation.arguments).nonCommitting) return undefined;
      return {
        arguments: invocation.arguments,
        directory: invocation.directory,
        environment: invocation.environment,
        globalArguments: invocation.globalArguments,
        precedingAdds,
      };
    }
    if (invocation?.name === 'add') {
      if (
        segment.operatorAfter === '|' ||
        segment.operatorAfter === '|&' ||
        segment.operatorAfter === '||'
      ) {
        return undefined;
      }
      precedingAdds.push(invocation);
      continue;
    }
    // An earlier arbitrary command may short-circuit or change shell state.
    // Decline to mutate any repository when the eventual commit is not modeled exactly.
    return undefined;
  }
  return undefined;
}

/** Detect a real committing Git segment when the full shell list is unsafe to model. */
function containsCommittingGitCommand(command: string, baseDirectory: string): boolean {
  let directory = baseDirectory;
  for (const segment of parseShellCommandList(command)) {
    const words = parseShellWords(segment.command);
    const commandIndex = commandWordIndex(words);
    const commandWords = words.slice(commandIndex);
    if (commandWords[0] === 'cd') {
      const changedDirectory = resolveCdDirectory(commandWords.slice(1), directory);
      if (changedDirectory !== undefined) directory = changedDirectory;
      continue;
    }
    const environment = gitSelectorEnvironment(words.slice(0, commandIndex), directory);
    const invocation = gitSubcommand(commandWords, directory, environment);
    if (invocation?.name === 'commit' && !commitOptionEffects(invocation.arguments).nonCommitting) {
      return true;
    }
  }
  return false;
}

function gitSelectorEnvironment(prefixWords: string[], directory: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const word of prefixWords) {
    const match = /^(GIT_DIR|GIT_WORK_TREE)=(.*)$/.exec(word);
    if (match?.[1] === undefined || match[2] === undefined) continue;
    environment[match[1]] = nodePath.resolve(directory, match[2]);
  }
  return environment;
}

function resolveCdDirectory(arguments_: string[], directory: string): string | undefined {
  const normalizedArguments = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  if (normalizedArguments.length !== 1 || normalizedArguments[0] === undefined) return undefined;
  return nodePath.resolve(directory, normalizedArguments[0]);
}

interface CommitOptionEffects {
  nonCommitting: boolean;
  stagesAll: boolean;
}

/** Classify the commit options that change whether or what Git will commit. */
function commitOptionEffects(tokens: string[]): CommitOptionEffects {
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
  return { nonCommitting, stagesAll };
}

/** Whether the commit asks Git to stage every tracked modification. */
function stagesTrackedWorktreeChanges(tokens: string[]): boolean {
  const effects = commitOptionEffects(tokens);
  return effects.stagesAll && !effects.nonCommitting;
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

/**
 * Build the tree the command list will attempt in an isolated index. This
 * models preceding `git add` segments and `git commit -a` without moving
 * source changes into the user's real index if the eventual commit aborts.
 */
function projectCommitIndex(cwd: string, plan: GitCommitPlan): ProjectedIndex | undefined {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-commit-index-'));
  const projectedIndex = nodePath.join(directory, 'index');
  const commitEnvironment = { ...process.env, ...plan.environment };
  const projectedEnvironment = { ...commitEnvironment, GIT_INDEX_FILE: projectedIndex };
  try {
    const realIndex = execFileSync(
      'git',
      [...plan.globalArguments, 'rev-parse', '--path-format=absolute', '--git-path', 'index'],
      {
        cwd,
        encoding: 'utf8',
        env: commitEnvironment,
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
    for (const add of plan.precedingAdds) {
      if (gitWorktreeRoot(add) !== cwd) continue;
      execFileSync('git', [...add.globalArguments, 'add', ...add.arguments], {
        cwd: add.directory,
        env: { ...projectedEnvironment, ...add.environment },
        stdio: 'ignore',
      });
    }
    if (stagesTrackedWorktreeChanges(plan.arguments)) {
      execFileSync('git', ['add', '-u', '--', ':/'], {
        cwd,
        env: projectedEnvironment,
        stdio: 'ignore',
      });
    }
    return { directory, path: projectedIndex };
  } catch {
    rmSync(directory, { recursive: true, force: true });
    return undefined;
  }
}

function runArchitectureHook(projectDir: string, plan: GitCommitPlan): void {
  const needsProjectedIndex =
    plan.precedingAdds.length > 0 || stagesTrackedWorktreeChanges(plan.arguments);
  const projectedIndex = needsProjectedIndex ? projectCommitIndex(projectDir, plan) : undefined;
  if (needsProjectedIndex && projectedIndex === undefined) return;
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
      env: {
        ...process.env,
        ...plan.environment,
        ...(sourceIndex === undefined ? {} : { [ARCHITECTURE_SOURCE_INDEX_ENV]: sourceIndex }),
        ...(plan.precedingAdds.length === 0 && !stagesTrackedWorktreeChanges(plan.arguments)
          ? {}
          : { [ARCHITECTURE_KEEP_MATERIALIZED_ENV]: '1' }),
      },
      stdio: 'ignore',
      timeout: 30_000,
    });
  } finally {
    if (projectedIndex !== undefined) {
      rmSync(projectedIndex.directory, { recursive: true, force: true });
    }
  }
}

function gitWorktreeRoot(
  context: Pick<GitInvocation, 'directory' | 'environment' | 'globalArguments'>,
): string | undefined {
  try {
    return execFileSync('git', [...context.globalArguments, 'rev-parse', '--show-toplevel'], {
      cwd: context.directory,
      encoding: 'utf8',
      env: { ...process.env, ...context.environment },
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
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
const baseDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const commitPlan = gitCommitPlan(gitCommand, baseDirectory);
if (commitPlan === undefined) {
  if (containsCommittingGitCommand(gitCommand, baseDirectory)) {
    const message =
      'Safeword skipped architecture auto-staging because commands before `git commit` cannot be modeled safely. Run preceding commands first, then commit separately, or run safeword architecture --stage.';
    process.stdout.write(
      `${JSON.stringify({
        systemMessage: message,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: message,
        },
      })}\n`,
    );
  }
  process.exit(0);
}

const projectDir = gitWorktreeRoot(commitPlan);

// Not a safeword project — nothing to do.
if (projectDir === undefined || !existsSync(nodePath.join(projectDir, '.safeword')))
  process.exit(0);

// The CLI stages the doc into the index, which lands in a plain `git commit` /
// `git commit -m`. A `git commit <pathspec>` can still override the index; CI
// catches that explicitly path-limited escape hatch.
runArchitectureHook(projectDir, commitPlan);

process.exit(0); // Always allow the commit to proceed.
