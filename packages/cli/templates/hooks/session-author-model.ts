#!/usr/bin/env bun
// Safeword: capture the main session model for the architecture cross-model gate (ticket MR5M3A).
//
// Per the Claude Code hooks docs, only SessionStart receives a `model` field on
// stdin, and Stop hooks get no model field and no $CLAUDE_MODEL env var. The
// architecture review gate (stop-quality.ts) needs the author's model to enforce
// cross-model review, so this SessionStart hook persists it via CLAUDE_ENV_FILE
// as SAFEWORD_AUTHOR_MODEL — the documented forward-pass path to later hooks.

import { appendFileSync } from 'node:fs';

interface SessionStartInput {
  model?: string;
}

let input: SessionStartInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const envFile = process.env.CLAUDE_ENV_FILE;
const model = input.model?.trim();
if (envFile !== undefined && envFile !== '' && model !== undefined && model !== '') {
  appendFileSync(envFile, `SAFEWORD_AUTHOR_MODEL=${model}\n`);
}
process.exit(0);
