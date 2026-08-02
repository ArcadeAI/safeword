#!/usr/bin/env bun

import process from 'node:process';

import { resolveNamespaceRoot } from './lib/namespace-root.ts';

const projectDirectory = process.argv[2] ?? process.cwd();

process.stdout.write(resolveNamespaceRoot(projectDirectory));
