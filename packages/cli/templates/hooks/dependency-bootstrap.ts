#!/usr/bin/env bun
// Safeword: host-neutral dependency bootstrap for fresh worktrees.

import { existsSync } from 'node:fs';
import process from 'node:process';

import { bootstrapDependencies } from './lib/dependency-readiness.ts';

const projectDirectory =
  process.argv.slice(2).find(argument => !argument.startsWith('-')) ?? process.cwd();
const requireReady = process.argv.includes('--require-ready');
if (!existsSync(`${projectDirectory}/.safeword`)) process.exit(0);

const result = bootstrapDependencies(projectDirectory);
if (result.status === 'ready' || result.status === 'unsupported') process.exit(0);

const failed = result.status === 'failed' || (requireReady && result.status === 'action_required');
const output = failed ? console.error : console.log;
output(result.message);
process.exit(failed ? 1 : 0);
