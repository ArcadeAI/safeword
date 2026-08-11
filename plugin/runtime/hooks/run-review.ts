#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

type Candidate = readonly [command: string, prefix: readonly string[]];

const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const DEFAULT_PROBE_TIMEOUT_MS = 10_000;

function probeTimeout(environment: NodeJS.ProcessEnv): number {
  const configured = Number(environment.SAFEWORD_REVIEW_CLI_PROBE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, DEFAULT_PROBE_TIMEOUT_MS)
    : DEFAULT_PROBE_TIMEOUT_MS;
}

function supportsReview([command, prefix]: Candidate, timeout: number): boolean {
  const result = spawnSync(command, [...prefix, 'review', 'run', '--help'], {
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

  const sourceCli = nodePath.join(projectDirectory, 'packages', 'cli', 'src', 'cli.ts');
  if (existsSync(sourceCli)) candidates.push(['bun', [sourceCli]]);

  const versionPath = nodePath.join(projectDirectory, '.safeword', 'version');
  if (existsSync(versionPath)) {
    const version = readFileSync(versionPath, 'utf8').trim();
    if (SEMVER.test(version)) candidates.push(['bunx', [`safeword@${version}`]]);
  }
  return candidates;
}

export function runReview(arguments_: string[]): never {
  const timeout = probeTimeout(process.env);
  const candidate = reviewCandidates().find(candidate_ => supportsReview(candidate_, timeout));
  if (!candidate) {
    console.error('No review-capable Safeword CLI found.');
    process.exit(1);
  }
  const result = spawnSync(candidate[0], [...candidate[1], ...arguments_], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

if (import.meta.main) runReview(process.argv.slice(2));
