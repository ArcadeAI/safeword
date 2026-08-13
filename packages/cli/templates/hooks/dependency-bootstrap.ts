#!/usr/bin/env bun
// Safeword: host-neutral dependency bootstrap for fresh worktrees.

import { existsSync } from 'node:fs';
import process from 'node:process';

import { bootstrapDependencies, wireGitHooksIfNeeded } from './lib/dependency-readiness.ts';

const projectDirectory =
  process.argv.slice(2).find(argument => !argument.startsWith('-')) ?? process.cwd();
const requireReady = process.argv.includes('--require-ready');
if (!existsSync(`${projectDirectory}/.safeword`)) process.exit(0);

wireGitHooksIfNeeded(projectDirectory);
const result = bootstrapDependencies(projectDirectory);
switch (result.status) {
  case 'ready':
  case 'unsupported':
    break;
  case 'bootstrapped':
    console.error(result.message);
    break;
  case 'action_required':
    (requireReady ? console.error : console.log)(result.message);
    if (requireReady) process.exitCode = 1;
    break;
  case 'failed':
    console.error(result.message);
    process.exitCode = 1;
    break;
}
