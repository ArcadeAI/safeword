#!/usr/bin/env bun
// Safeword: Architecture doc commit-time auto-fix (PreToolUse on `git commit`)
// When the agent commits, regenerate a stale generated architecture doc
// (.project/architecture.generated.md) and stage it into the in-flight commit so
// the commit lands fresh — the "block later" half of inform-early/block-later,
// implemented as auto-fix rather than a block. Honors the per-project opt-out
// (architectureDocEnforcement: false, read by the CLI). Best-effort: never
// blocks the commit (always exits 0); CI `safeword project architecture --check` is the
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
  commit: GitInvocation;
  precedingAdds: GitInvocation[];
}

interface GitInvocation {
  arguments: string[];
  directory: string;
  environment: Record<string, string>;
  globalArguments: string[];
  subcommand: string;
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

/** Parse a Git invocation and effective context after consuming documented global options. */
function parseGitInvocation(
  tokens: string[],
  baseDirectory: string,
  environment: Record<string, string>,
): GitInvocation | undefined {
  if (tokens[0] !== 'git') return undefined;
  const globalArguments: string[] = [];
  const gitEnvironment = { ...environment };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || GIT_GLOBAL_NON_COMMAND_OPTIONS.has(token)) return undefined;
    if (!token.startsWith('-')) {
      return {
        arguments: tokens.slice(index + 1),
        directory: baseDirectory,
        environment: gitEnvironment,
        globalArguments,
        subcommand: token,
      };
    }
    if (token === '--bare') return undefined;
    if (GIT_GLOBAL_FLAGS.has(token)) {
      globalArguments.push(token);
      continue;
    }
    if (token.startsWith('-C') && token !== '-C') {
      globalArguments.push(token);
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
      globalArguments.push(token);
      if (!token.includes('=')) globalArguments.push(value);
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
    if (segment.operatorAfter === '&') return undefined;
    const words = parseShellWords(segment.command);
    const commandIndex = commandWordIndex(words);
    const commandWords = words.slice(commandIndex);
    const environment = gitSelectorEnvironment(words.slice(0, commandIndex));
    if (environment === undefined) return undefined;
    if (commandWords[0] === 'cd') {
      const changedDirectory = resolveCdDirectory(commandWords.slice(1), directory);
      if (changedDirectory === undefined || segment.operatorAfter === '||') return undefined;
      directory = changedDirectory;
      continue;
    }

    const invocation = parseGitInvocation(commandWords, directory, environment);
    if (invocation?.subcommand === 'commit') {
      if (commitOptionEffects(invocation.arguments).nonCommitting) return undefined;
      if (precedingAdds.some(add => !sameGitRepositoryTarget(add, invocation))) return undefined;
      return { commit: invocation, precedingAdds };
    }
    if (invocation?.subcommand === 'add') {
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

/**
 * Find a reachable commit for advisory-only handling when the full shell list
 * is unsafe to model. Heredoc-containing lists are deliberately declined: the
 * shared lightweight tokenizer cannot distinguish stdin body lines from shell
 * commands, and a false advisory is more disruptive than remaining silent.
 */
function unsupportedCommitPlan(command: string, baseDirectory: string): GitCommitPlan | undefined {
  if (command.includes('<<')) return undefined;

  let directory = baseDirectory;
  let listStatus: boolean | undefined;
  let operatorBefore: '&&' | '||' | ';' | '&' | undefined;
  let dominatingAdds: GitInvocation[] = [];
  for (const segment of parseShellCommandList(command)) {
    if (
      segment.operatorAfter === '|' ||
      segment.operatorAfter === '|&' ||
      segment.operatorAfter === '&'
    ) {
      return undefined;
    }

    const words = parseShellWords(segment.command);
    const commandIndex = commandWordIndex(words);
    const commandWords = words.slice(commandIndex);
    const executes =
      operatorBefore === '&&'
        ? listStatus !== false
        : operatorBefore === '||'
          ? listStatus !== true
          : true;
    if (commandWords[0] === 'cd') {
      const preservesAddDominance =
        dominatingAdds.length > 0 && operatorBefore === '&&' && segment.operatorAfter === '&&';
      const changedDirectory = resolveCdDirectory(commandWords.slice(1), directory);
      if (executes && changedDirectory !== undefined) directory = changedDirectory;
      listStatus = combineShellStatus(listStatus, operatorBefore, undefined);
      operatorBefore = segment.operatorAfter;
      if (!preservesAddDominance) dominatingAdds = [];
      continue;
    }
    const environment = gitSelectorEnvironment(words.slice(0, commandIndex));
    if (environment === undefined) return undefined;
    const invocation = parseGitInvocation(commandWords, directory, environment);
    if (
      executes &&
      invocation?.subcommand === 'commit' &&
      !commitOptionEffects(invocation.arguments).nonCommitting
    ) {
      return {
        commit: invocation,
        precedingAdds: dominatingAdds.filter(add => sameGitRepositoryTarget(add, invocation)),
      };
    }
    const commandName = nodePath.basename(commandWords[0] ?? '');
    const addNow =
      executes &&
      invocation !== undefined &&
      invocation.subcommand === 'add' &&
      isProjectableAdvisoryAdd(invocation) &&
      segment.operatorAfter === '&&' &&
      (operatorBefore !== '||' || listStatus === false)
        ? invocation
        : undefined;
    const preservesAddDominance =
      dominatingAdds.length > 0 &&
      operatorBefore === '&&' &&
      segment.operatorAfter === '&&' &&
      (commandName === 'true' ||
        invocation?.subcommand === 'add' ||
        invocation?.subcommand === 'status' ||
        invocation?.subcommand === 'diff');
    if (addNow !== undefined) {
      dominatingAdds =
        dominatingAdds.length > 0 && operatorBefore === '&&'
          ? [...dominatingAdds, addNow]
          : [addNow];
    } else if (!preservesAddDominance) {
      dominatingAdds = [];
    }
    const commandStatus =
      commandName === 'true' ? true : commandName === 'false' ? false : undefined;
    listStatus = combineShellStatus(listStatus, operatorBefore, commandStatus);
    operatorBefore = segment.operatorAfter;
  }
  return undefined;
}

function isProjectableAdvisoryAdd(invocation: GitInvocation): boolean {
  if (!hasOnlyRepositorySelectorArguments(invocation.globalArguments)) return false;
  let stagesAll = false;
  let optionsEnded = false;
  let hasPathspec = false;
  for (const argument of invocation.arguments) {
    if (optionsEnded) {
      hasPathspec = true;
      continue;
    }
    if (argument === '--') {
      optionsEnded = true;
      continue;
    }
    if (argument === '--all' || argument === '--no-ignore-removal') {
      stagesAll = true;
      continue;
    }
    if (argument === '--verbose' || argument === '--sparse') {
      continue;
    }
    if (/^-[Av]+$/.test(argument)) {
      if (argument.includes('A')) stagesAll = true;
      continue;
    }
    if (argument.startsWith('-')) return false;
    hasPathspec = true;
  }
  return hasPathspec || stagesAll;
}

function hasOnlyRepositorySelectorArguments(arguments_: string[]): boolean {
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '-C' || argument === '--git-dir' || argument === '--work-tree') {
      if (arguments_[index + 1] === undefined) return false;
      index += 1;
      continue;
    }
    if (
      argument?.startsWith('--git-dir=') === true ||
      argument?.startsWith('--work-tree=') === true
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function combineShellStatus(
  left: boolean | undefined,
  operator: '&&' | '||' | ';' | '&' | undefined,
  right: boolean | undefined,
): boolean | undefined {
  // `&` backgrounds the left list and runs the right one immediately, so the
  // left status never gates it — same carry-nothing-forward shape as `;`.
  if (operator === undefined || operator === ';' || operator === '&') return right;
  if (operator === '&&') {
    if (left === false || right === false) return false;
    return left === true && right === true ? true : undefined;
  }
  if (left === true || right === true) return true;
  return left === false && right === false ? false : undefined;
}

function gitSelectorEnvironment(prefixWords: string[]): Record<string, string> | undefined {
  if (
    prefixWords.some(
      word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word) && nodePath.basename(word) === 'env',
    )
  ) {
    return undefined;
  }
  const environment: Record<string, string> = {};
  for (const word of prefixWords) {
    const match = /^(GIT_DIR|GIT_INDEX_FILE|GIT_WORK_TREE)=(.*)$/.exec(word);
    if (match?.[1] === undefined || match[2] === undefined) continue;
    environment[match[1]] = match[2];
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
function projectCommitIndex(plan: GitCommitPlan): ProjectedIndex | undefined {
  const commitTarget = gitRepositoryTarget(plan.commit);
  if (
    commitTarget === undefined ||
    plan.precedingAdds.some(add => !sameGitRepositoryTarget(add, plan.commit))
  ) {
    return undefined;
  }
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-commit-index-'));
  const projectedIndex = nodePath.join(directory, 'index');
  const commitEnvironment = { ...process.env, ...plan.commit.environment };
  const projectedEnvironment = { ...commitEnvironment, GIT_INDEX_FILE: projectedIndex };
  try {
    if (existsSync(commitTarget.indexPath)) {
      copyFileSync(commitTarget.indexPath, projectedIndex);
    } else {
      execFileSync('git', [...plan.commit.globalArguments, 'read-tree', '--empty'], {
        cwd: plan.commit.directory,
        env: projectedEnvironment,
        stdio: 'ignore',
      });
    }
    for (const add of plan.precedingAdds) {
      execFileSync('git', [...add.globalArguments, 'add', ...add.arguments], {
        cwd: add.directory,
        env: { ...projectedEnvironment, ...add.environment, GIT_INDEX_FILE: projectedIndex },
        stdio: 'ignore',
      });
    }
    if (stagesTrackedWorktreeChanges(plan.commit.arguments)) {
      execFileSync('git', [...plan.commit.globalArguments, 'add', '-u', '--', ':/'], {
        cwd: plan.commit.directory,
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
  const commitTarget = gitRepositoryTarget(plan.commit);
  if (commitTarget === undefined) return;
  const needsProjectedIndex =
    plan.precedingAdds.length > 0 || stagesTrackedWorktreeChanges(plan.commit.arguments);
  const projectedIndex = needsProjectedIndex ? projectCommitIndex(plan) : undefined;
  if (needsProjectedIndex && projectedIndex === undefined) return;
  try {
    const sourceIndex = projectedIndex?.path;
    // Scope the auto-fix to commits that actually move the architecture shape (#425).
    // A routine commit (version bump, docs/config edit) stages nothing that feeds the
    // fingerprint, so regenerating and staging the generated doc into it would leak
    // unrelated churn. CI `architecture --check` remains the backstop for any drift
    // this skips.
    if (
      !stagedChangeAffectsArchitecture(projectDir, {
        gitDirectory: commitTarget.gitDirectory,
        indexPath: sourceIndex ?? commitTarget.indexPath,
        worktreeRoot: commitTarget.worktreeRoot,
      })
    ) {
      return;
    }

    // Prefer local source in dev/dogfood, fall back to the published CLI. The CLI
    // owns the regenerate-and-stage logic (and the opt-out check); this hook is glue.
    const localCli = nodePath.join(projectDir, 'packages/cli/src/cli.ts');
    const pluginCli = process.env.SAFEWORD_PLUGIN_CLI;
    const [command, args] =
      pluginCli === undefined
        ? existsSync(localCli)
          ? ['bun', [localCli, 'architecture', '--from-index', '--stage-output']]
          : ['bunx', ['safeword@latest', 'architecture', '--from-index', '--stage-output']]
        : ['bun', [pluginCli, 'architecture', '--from-index', '--stage-output']];

    spawnSync(command as string, args as string[], {
      cwd: projectDir,
      env: {
        ...process.env,
        ...plan.commit.environment,
        GIT_DIR: commitTarget.gitDirectory,
        GIT_INDEX_FILE: commitTarget.indexPath,
        GIT_WORK_TREE: commitTarget.worktreeRoot,
        ...(sourceIndex === undefined ? {} : { [ARCHITECTURE_SOURCE_INDEX_ENV]: sourceIndex }),
        ...(plan.precedingAdds.length === 0 && !stagesTrackedWorktreeChanges(plan.commit.arguments)
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
  return gitRepositoryTarget(context)?.worktreeRoot;
}

interface GitRepositoryTarget {
  gitDirectory: string;
  indexPath: string;
  worktreeRoot: string;
}

type GitRepositoryContext = Pick<GitInvocation, 'directory' | 'environment' | 'globalArguments'>;

function gitRepositoryTarget(context: GitRepositoryContext): GitRepositoryTarget | undefined {
  try {
    const [worktreeRoot, gitDirectory, indexPath] = execFileSync(
      'git',
      [
        ...context.globalArguments,
        'rev-parse',
        '--path-format=absolute',
        '--show-toplevel',
        '--absolute-git-dir',
        '--git-path',
        'index',
      ],
      {
        cwd: context.directory,
        encoding: 'utf8',
        env: { ...process.env, ...context.environment },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
      .trim()
      .split('\n');
    return worktreeRoot === undefined || gitDirectory === undefined || indexPath === undefined
      ? undefined
      : { gitDirectory, indexPath, worktreeRoot };
  } catch {
    return undefined;
  }
}

function sameGitRepositoryTarget(left: GitRepositoryContext, right: GitRepositoryContext): boolean {
  const leftTarget = gitRepositoryTarget(left);
  const rightTarget = gitRepositoryTarget(right);
  return (
    leftTarget !== undefined &&
    rightTarget !== undefined &&
    leftTarget.gitDirectory === rightTarget.gitDirectory &&
    leftTarget.worktreeRoot === rightTarget.worktreeRoot &&
    leftTarget.indexPath === rightTarget.indexPath
  );
}

/**
 * Whether an unmodeled command list would have had a document auto-staged, had
 * it been modelable. Projects the reachable adds into a throwaway index so the
 * answer matches what the commit will really contain; never touches the real
 * index and never throws — advisory detection must not turn an unmodeled
 * command into a blocker.
 */
function unmodeledCommitNeedsAdvice(command: string, baseDirectory: string): boolean {
  try {
    const unsupportedCommit = unsupportedCommitPlan(command, baseDirectory);
    if (unsupportedCommit === undefined) return false;

    const target = gitRepositoryTarget(unsupportedCommit.commit);
    if (target === undefined || !existsSync(nodePath.join(target.worktreeRoot, '.safeword'))) {
      return false;
    }

    const needsProjection =
      unsupportedCommit.precedingAdds.length > 0 ||
      stagesTrackedWorktreeChanges(unsupportedCommit.commit.arguments);
    const projectedIndex = needsProjection ? projectCommitIndex(unsupportedCommit) : undefined;
    if (needsProjection && projectedIndex === undefined) return false;

    try {
      return stagedChangeAffectsArchitecture(target.worktreeRoot, {
        ...target,
        ...(projectedIndex === undefined ? {} : { indexPath: projectedIndex.path }),
      });
    } finally {
      if (projectedIndex !== undefined) {
        rmSync(projectedIndex.directory, { recursive: true, force: true });
      }
    }
  } catch {
    return false;
  }
}

function writeUnmodeledCommitAdvisory(): void {
  const message =
    'Safeword skipped architecture auto-staging because commands before `git commit` cannot be modeled safely. Run preceding commands first, then commit separately, or run safeword project architecture --from-index --stage-output.';
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
  if (unmodeledCommitNeedsAdvice(gitCommand, baseDirectory)) writeUnmodeledCommitAdvisory();
  process.exit(0);
}

const projectDir = gitWorktreeRoot(commitPlan.commit);

// Not a safeword project — nothing to do.
if (projectDir === undefined || !existsSync(nodePath.join(projectDir, '.safeword')))
  process.exit(0);

// The CLI stages the doc into the index, which lands in a plain `git commit` /
// `git commit -m`. A `git commit <pathspec>` can still override the index; CI
// catches that explicitly path-limited escape hatch.
runArchitectureHook(projectDir, commitPlan);

process.exit(0); // Always allow the commit to proceed.
