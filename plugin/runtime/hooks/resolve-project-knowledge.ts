#!/usr/bin/env bun

import process from 'node:process';

import { resolveReviewKnowledgeSources } from './lib/project-knowledge.ts';

const projectDirectory = process.argv[2] ?? process.cwd();
process.stdout.write(
  `${JSON.stringify(resolveReviewKnowledgeSources(projectDirectory), undefined, 2)}\n`,
);
