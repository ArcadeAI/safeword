#!/usr/bin/env bun
// Safeword: Dependency readiness check (SessionStart)
// Detects missing/stale dependencies in fresh worktrees before tools fail.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import {
  COMMITTED_HOOKS_DIR,
  decideGitHooksWiring,
  formatDependencyRecovery,
  getDependencyReadiness,
  readDependencyBootstrapConfig,
  shouldBootstrapDependencies,
  toDependencyReadinessState,
  writeDependencyReadinessState,
  writeInstallMarker,
} from './lib/dependency-readiness.ts';

interface SessionStartOutput {
  hookSpecificOutput: {
    hookEventName: 'SessionStart';
    additionalContext: string;
  };
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (!existsSync(`${projectDirectory}/.safeword`)) {
  process.exit(0);
}

// Fresh clones/worktrees have no git hooks wired until husky's `prepare` runs on
// install, so the committed pre-commit guard chain silently does not run and a
// first commit can bypass every check (#364). Wire it eagerly — before readiness
// is even resolved — so enforcement is active even when deps are still missing.
wireGitHooksIfNeeded(projectDirectory);

let readiness = getDependencyReadiness(projectDirectory);

if (readiness.status === 'unsupported') {
  process.exit(0);
}

if (readiness.status === 'ready') {
  writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
  writeInstallMarker(projectDirectory, readiness);
  process.exit(0);
}

const config = readDependencyBootstrapConfig(projectDirectory);

if (
  shouldBootstrapDependencies(readiness.status, config.autoInstall) &&
  readiness.plan !== undefined
) {
  const { binary, args, display } = readiness.plan.installCommand;
  const result = spawnSync(binary, args, {
    cwd: projectDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  readiness = getDependencyReadiness(projectDirectory);

  if (result.status === 0 && readiness.status === 'ready') {
    writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
    writeInstallMarker(projectDirectory, readiness);
    emitContext(`dependencies bootstrapped with \`${display}\`.`);
  }

  const message = [
    `dependency bootstrap failed while running \`${display}\`.`,
    'Run the install command manually, inspect the package manager output, then retry.',
    trimOutput(result.stderr) || trimOutput(result.stdout),
  ]
    .filter(Boolean)
    .join('\n');

  writeDependencyReadinessState(projectDirectory, {
    status: 'failed',
    reason: readiness.reason,
    fingerprint: readiness.fingerprint,
    installCommand: readiness.installCommand,
    message,
  });
  emitContext(message);
}

writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
emitContext(formatDependencyRecovery(readiness));

function emitContext(additionalContext: string): never {
  const output: SessionStartOutput = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

function trimOutput(output: string | undefined): string {
  return output?.trim().split('\n').slice(-20).join('\n') ?? '';
}

function readGitHooksPath(cwd: string): string {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function wireGitHooksIfNeeded(cwd: string): void {
  const committedHookExists = existsSync(nodePath.join(cwd, COMMITTED_HOOKS_DIR, 'pre-commit'));
  const currentHooksPath = readGitHooksPath(cwd);
  const currentHooksPathActive =
    currentHooksPath !== '' && existsSync(nodePath.resolve(cwd, currentHooksPath, 'pre-commit'));

  const decision = decideGitHooksWiring({ committedHookExists, currentHooksPathActive });
  if (decision.action !== 'wire' || decision.hooksPath === undefined) return;

  // Best-effort: a wiring failure (read-only config, no git) must not crash the
  // SessionStart hook. The committed guard simply stays inactive, as before.
  spawnSync('git', ['config', 'core.hooksPath', decision.hooksPath], { cwd, stdio: 'ignore' });
}
