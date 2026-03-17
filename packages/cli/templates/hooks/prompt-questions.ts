#!/usr/bin/env bun
// Safeword: Pre-work reminders (UserPromptSubmit)
// Reminds Claude to classify work level and ask clarifying questions

import { existsSync } from 'node:fs';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

console.log(`SAFEWORD:
- Classify patch/task/feature and announce before starting.
- Research options, then ask 1-5 targeted questions about scope and constraints.`);
