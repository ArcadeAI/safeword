#!/usr/bin/env bun
// Safeword: Dependency readiness check (SessionStart)
// Detects missing/stale dependencies in fresh worktrees before tools fail.

import { existsSync } from 'node:fs';

import {
  formatDependencyRecovery,
  getDependencyReadiness,
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

const readiness = getDependencyReadiness(projectDirectory);

if (readiness.status === 'unsupported') {
  process.exit(0);
}

if (readiness.status === 'ready') {
  writeDependencyReadinessState(projectDirectory, toDependencyReadinessState(readiness));
  writeInstallMarker(projectDirectory, readiness);
  process.exit(0);
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
