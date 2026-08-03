#!/usr/bin/env bun

import process from 'node:process';

import { resolveConfiguredPath, resolveNamespaceRoot } from './lib/namespace-root.ts';

const projectDirectory = process.argv[2] ?? process.cwd();
const configuredKey = process.argv[3];
const defaultBasename = process.argv[4];

if (configuredKey === undefined) {
  process.stdout.write(resolveNamespaceRoot(projectDirectory));
} else {
  process.stdout.write(resolveConfiguredPath(projectDirectory, configuredKey, defaultBasename));
}
