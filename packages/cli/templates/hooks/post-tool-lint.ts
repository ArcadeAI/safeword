#!/usr/bin/env bun
// Safeword: Auto-lint changed files (PostToolUse)
// Silently auto-fixes, only outputs unfixable errors.
// Surfaces missing tool warnings to Claude via additionalContext.

import { lintFile } from './lib/lint.ts';

interface HookInput {
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch (error) {
  if (process.env.DEBUG) console.error('[post-tool-lint] stdin parse error:', error);
  process.exit(0);
}

const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

// Exit silently if no file or file doesn't exist
if (!file || !(await Bun.file(file).exists())) {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
process.chdir(projectDir);

const result = await lintFile(file, projectDir);

// Surface warnings to Claude via stdout (appears as system-reminder)
if (result.warnings.length > 0) {
  console.log(result.warnings.map(w => `SAFEWORD: ${w}`).join('\n'));
}
