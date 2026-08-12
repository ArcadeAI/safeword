#!/usr/bin/env bun
// Safeword: host-neutral dependency bootstrap for fresh worktrees.

import { existsSync } from 'node:fs';
import process from 'node:process';

import { bootstrapDependencies } from './lib/dependency-readiness.ts';

const projectDirectory = process.argv[2] ?? process.cwd();
if (!existsSync(`${projectDirectory}/.safeword`)) process.exit(0);

const result = bootstrapDependencies(projectDirectory);
if (result.status === 'ready' || result.status === 'unsupported') process.exit(0);

const output = result.status === 'failed' ? console.error : console.log;
output(result.message);
process.exit(result.status === 'failed' ? 1 : 0);
