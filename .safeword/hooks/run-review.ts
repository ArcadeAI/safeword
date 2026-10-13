#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { safewordClis, trustedSafewordClis } from './lib/safeword-cli.ts';

type Candidate = readonly [command: string, prefix: readonly string[], workingDirectory?: string];

const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
const MANAGED_PROGRESS_SIGNAL = 'SAFEWORD_REVIEW_PROGRESS';
export const VALUELESS_GLOBAL_OPTIONS = new Set([
  '--json',
  '--no-input',
  '--quiet',
  '--offline',
  '-v',
  '--verbose',
]);
export const VALUED_GLOBAL_OPTIONS = new Set(['--cwd']);

function isAttachedValuedGlobalOption(argument: string): boolean {
  return [...VALUED_GLOBAL_OPTIONS].some(option =>
    option.startsWith('--')
      ? argument.startsWith(`${option}=`)
      : argument !== option && argument.startsWith(option),
  );
}

function hasJsonOption(arguments_: readonly string[]): boolean {
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument !== undefined && VALUED_GLOBAL_OPTIONS.has(argument)) {
      index += 1;
      continue;
    }
    if (argument === '--json') return true;
  }
  return false;
}

function isManagedJsonReview(arguments_: readonly string[]): boolean {
  const optionBoundary = arguments_.indexOf('--');
  const commandArguments = optionBoundary === -1 ? arguments_ : arguments_.slice(0, optionBoundary);
  let routeIndex = 0;
  while (routeIndex < commandArguments.length) {
    const argument = commandArguments[routeIndex];
    if (argument !== undefined && VALUED_GLOBAL_OPTIONS.has(argument)) {
      routeIndex += 2;
      continue;
    }
    if (
      (argument !== undefined && isAttachedValuedGlobalOption(argument)) ||
      (argument && VALUELESS_GLOBAL_OPTIONS.has(argument))
    ) {
      routeIndex += 1;
      continue;
    }
    break;
  }
  return (
    commandArguments[routeIndex] === 'review' &&
    commandArguments[routeIndex + 1] === 'run' &&
    hasJsonOption(commandArguments)
  );
}

function probeTimeout(environment: NodeJS.ProcessEnv): number {
  const configured = Number(environment.SAFEWORD_REVIEW_CLI_PROBE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, DEFAULT_PROBE_TIMEOUT_MS)
    : DEFAULT_PROBE_TIMEOUT_MS;
}

export function reviewChildEnvironment(
  environment: NodeJS.ProcessEnv,
  arguments_: readonly string[],
): NodeJS.ProcessEnv {
  const childEnvironment = { ...environment };
  for (const name of Object.keys(childEnvironment)) {
    if (name.toUpperCase() === MANAGED_PROGRESS_SIGNAL) delete childEnvironment[name];
  }
  if (isManagedJsonReview(arguments_)) {
    childEnvironment[MANAGED_PROGRESS_SIGNAL] = '1';
  }
  return childEnvironment;
}

function supportsReview(
  [command, prefix, workingDirectory]: Candidate,
  timeout: number,
  environment: NodeJS.ProcessEnv,
): boolean {
  const arguments_ = ['review', 'run', '--help'];
  const result = spawnSync(command, [...prefix, ...arguments_], {
    cwd: workingDirectory,
    env: reviewChildEnvironment(environment, arguments_),
    stdio: 'ignore',
    timeout,
  });
  return result.status === 0 && result.error === undefined && result.signal === null;
}

// The hook is launched from whatever directory the caller happened to be in.
// Anchoring discovery on that directory hides a working CLI one level up and
// reports it as missing, so resolve the project root before looking. The
// resolved root is also where the CLI runs: it scopes its config and review
// state to its own cwd, so launching from a subdirectory would otherwise grow
// a second `.safeword/` tree there instead of using the project's.
function looksLikeProjectRoot(directory: string): boolean {
  return (
    existsSync(nodePath.join(directory, '.safeword')) ||
    existsSync(nodePath.join(directory, 'packages', 'cli', 'src', 'cli.ts'))
  );
}

function reviewProjectRoot(start: string, environment: NodeJS.ProcessEnv): string {
  // Claude sets CLAUDE_PROJECT_DIR for hooks. Only trust it when it really
  // points at a project; a stale or wrong value falls through to the walk.
  const declared = environment.CLAUDE_PROJECT_DIR;
  if (declared !== undefined && declared !== '' && looksLikeProjectRoot(declared))
    return nodePath.resolve(declared);
  const from = nodePath.resolve(start);
  let directory = from;
  for (;;) {
    if (looksLikeProjectRoot(directory)) return directory;
    const parent = nodePath.dirname(directory);
    // No marker anywhere up to the filesystem root: keep the caller's own
    // directory, so the trust checks below stay the only thing that admits
    // a candidate rather than this walk widening what counts as a project.
    if (parent === directory) return from;
    directory = parent;
  }
}

export function reviewCandidates(
  startDirectory = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): Candidate[] {
  const projectDirectory = reviewProjectRoot(startDirectory, environment);
  return safewordClis(projectDirectory, environment).map(cli => [cli.command, cli.args, cli.cwd]);
}

/**
 * Resolve only distribution-owned CLIs for receipt verification.
 *
 * The normal review launcher intentionally prefers project-local and source
 * CLIs for development. A receipt is a trust-boundary check, though: accepting
 * JSON from a CLI the reviewed project can rewrite would let that project mint
 * its own approval. Keep those convenient routes out of the verifier.
 */
export function receiptReviewCandidates(
  projectDirectory = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): Candidate[] {
  return trustedSafewordClis(projectDirectory, environment).map(cli => [
    cli.command,
    cli.args,
    cli.cwd,
  ]);
}

export function runReview(arguments_: string[]): never {
  const timeout = probeTimeout(process.env);
  const candidate = reviewCandidates().find(candidate_ =>
    supportsReview(candidate_, timeout, process.env),
  );
  if (!candidate) {
    console.error('No review-capable Safeword CLI found.');
    process.exit(1);
  }
  const result = spawnSync(candidate[0], [...candidate[1], ...arguments_], {
    cwd: candidate[2],
    env: reviewChildEnvironment(process.env, arguments_),
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

if (import.meta.main) runReview(process.argv.slice(2));
