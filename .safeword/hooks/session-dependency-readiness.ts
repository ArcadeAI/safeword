#!/usr/bin/env bun
// Safeword: Dependency readiness check (SessionStart)
// Detects missing/stale dependencies in fresh worktrees before tools fail.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import {
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
