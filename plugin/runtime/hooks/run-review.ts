#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type Candidate = readonly [command: string, prefix: readonly string[]];

const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
const MANAGED_PROGRESS_SIGNAL = 'SAFEWORD_REVIEW_PROGRESS';
const VALUELESS_GLOBAL_OPTIONS = new Set([
  '--json',
  '--no-input',
  '--quiet',
  '--offline',
  '-v',
  '--verbose',
]);

function isManagedJsonReview(arguments_: readonly string[]): boolean {
  const optionBoundary = arguments_.indexOf('--');
  const commandArguments = optionBoundary === -1 ? arguments_ : arguments_.slice(0, optionBoundary);
  let routeIndex = 0;
  while (routeIndex < commandArguments.length) {
    const argument = commandArguments[routeIndex];
    if (argument === '--cwd') {
      routeIndex += 2;
      continue;
    }
    if (argument?.startsWith('--cwd=') || (argument && VALUELESS_GLOBAL_OPTIONS.has(argument))) {
      routeIndex += 1;
      continue;
    }
    break;
  }
  return (
    commandArguments[routeIndex] === 'review' &&
    commandArguments[routeIndex + 1] === 'run' &&
    commandArguments.includes('--json')
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
  [command, prefix]: Candidate,
  timeout: number,
  environment: NodeJS.ProcessEnv,
): boolean {
  const arguments_ = ['review', 'run', '--help'];
  const result = spawnSync(command, [...prefix, ...arguments_], {
    env: reviewChildEnvironment(environment, arguments_),
    stdio: 'ignore',
    timeout,
  });
  return result.status === 0 && result.error === undefined && result.signal === null;
}

export function reviewCandidates(
  projectDirectory = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): Candidate[] {
  const candidates: Candidate[] = [];
  const pluginRoot = environment.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const bundledCli = nodePath.join(pluginRoot, 'runtime', 'cli.js');
    if (existsSync(bundledCli)) candidates.push(['bun', [bundledCli]]);
  }

  const localCli = nodePath.join(projectDirectory, 'node_modules', '.bin', 'safeword');
  if (existsSync(localCli)) candidates.push([localCli, []]);

  const sourcePackage = nodePath.join(projectDirectory, 'packages', 'cli', 'package.json');
  const sourceCli = nodePath.join(projectDirectory, 'packages', 'cli', 'src', 'cli.ts');
  if (existsSync(sourceCli) && existsSync(sourcePackage)) {
    try {
      const manifest = JSON.parse(readFileSync(sourcePackage, 'utf8')) as { name?: unknown };
      if (manifest.name === 'safeword') candidates.push(['bun', [sourceCli]]);
    } catch {
      // A malformed lookalike checkout is not a trusted Safeword source route.
    }
  }

  const versionPath = nodePath.join(projectDirectory, '.safeword', 'version');
  if (existsSync(versionPath)) {
    const version = readFileSync(versionPath, 'utf8').trim();
    if (SEMVER.test(version)) candidates.push(['bunx', [`safeword@${version}`]]);
  }
  return candidates;
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
    env: reviewChildEnvironment(process.env, arguments_),
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

if (import.meta.main) runReview(process.argv.slice(2));
