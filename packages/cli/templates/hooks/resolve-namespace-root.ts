#!/usr/bin/env bun

import process from 'node:process';
import nodePath from 'node:path';

import { readConfiguredPathValue, resolveNamespaceRoot } from './lib/namespace-root.ts';

const projectDirectory = process.argv[2] ?? process.cwd();
const configuredKey = process.argv[3];
const defaultBasename = process.argv[4];

if (configuredKey === undefined) {
  process.stdout.write(resolveNamespaceRoot(projectDirectory));
} else {
  const configured = readConfiguredPathValue(projectDirectory, configuredKey);
  const resolved =
    configured === undefined
      ? nodePath.join(
          resolveNamespaceRoot(projectDirectory),
          defaultBasename ?? `${configuredKey}.md`,
        )
      : nodePath.isAbsolute(configured)
        ? configured
        : nodePath.join(projectDirectory, configured);
  process.stdout.write(resolved);
}
