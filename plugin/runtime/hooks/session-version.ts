#!/usr/bin/env bun
// Safeword: Display version on session start (SessionStart)
// Shows current safeword version and confirms hooks are active

import { existsSync } from 'node:fs';
import { resolveSessionProjectDirectory } from './lib/project-directory.ts';

let input: { session_id?: string; cwd?: string } = {};
try {
  input = await Bun.stdin.json();
} catch {
  // No input: resolve from the launch checkout.
}
const projectDir = resolveSessionProjectDirectory({ sessionId: input.session_id, cwd: input.cwd });
const safewordDir = `${projectDir}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

const versionFile = Bun.file(`${safewordDir}/version`);
const version = (await versionFile.exists()) ? (await versionFile.text()).trim() : 'unknown';

console.log(
  `Safeword Claude Config v${version} installed - auto-linting and quality review active`,
);
