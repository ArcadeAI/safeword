#!/usr/bin/env bun
// Safeword: Pre-work reminders (UserPromptSubmit)
// Reminds Claude to contribute before asking and assess scope in proposals

import { existsSync } from 'node:fs';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

console.log(`SAFEWORD:
- Contribute before asking. Embed open questions in your contribution.
- When proposing, state what it touches and what rigor it warrants.`);
