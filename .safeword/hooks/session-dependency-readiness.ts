#!/usr/bin/env bun
// Safeword: Dependency readiness check (SessionStart)
// Detects missing/stale dependencies in fresh worktrees before tools fail.

import { existsSync } from 'node:fs';

import { bootstrapDependencies, wireGitHooksIfNeeded } from './lib/dependency-readiness.ts';

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

wireGitHooksIfNeeded(projectDirectory);

const result = bootstrapDependencies(projectDirectory);
switch (result.status) {
  case 'ready':
  case 'unsupported':
    break;
  case 'bootstrapped':
  case 'action_required':
  case 'failed':
    emitContext(result.message);
}

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
