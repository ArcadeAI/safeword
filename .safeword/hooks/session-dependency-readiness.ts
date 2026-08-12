#!/usr/bin/env bun
// Safeword: Dependency readiness check (SessionStart)
// Detects missing/stale dependencies in fresh worktrees before tools fail.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import {
  bootstrapDependencies,
  COMMITTED_HOOKS_DIR,
  decideGitHooksWiring,
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

wireGitHooksIfNeeded(projectDirectory);

const result = bootstrapDependencies(projectDirectory);
if (result.status === 'ready' || result.status === 'unsupported') process.exit(0);
emitContext(result.message);

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

  const decision = decideGitHooksWiring({
    committedHookExists,
    currentHooksPath,
    currentHooksPathActive,
  });
  if (decision.action !== 'wire' || decision.hooksPath === undefined) return;

  spawnSync('git', ['config', 'core.hooksPath', decision.hooksPath], { cwd, stdio: 'ignore' });
}
