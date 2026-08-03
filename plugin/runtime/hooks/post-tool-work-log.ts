#!/usr/bin/env bun
// Safeword: phase work-log stamp (PostToolUse observer, ticket E32M4P / #772)
//
// When a ticket.md edit that changes `phase:` lands, append a work-log line
// stamped with the real system clock — the clock the agent doesn't have.
// Replaces the fabricated `{timestamp}` transition templates the bdd phase
// files used to prescribe. Observer only: never blocks, exits silently on
// anything that isn't a tickets-namespace ticket.md phase transition.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { isNamespacePath } from './lib/namespace-root.ts';
import { installCrashCapture } from './lib/self-report.ts';
import {
  appendWorkLogEntry,
  detectPhaseTransition,
  type EditToolInput,
} from './lib/work-log-stamp.ts';

installCrashCapture('post-tool-work-log');

interface HookInput {
  tool_name?: string;
  tool_input?: EditToolInput;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project, skip silently
if (!existsSync(`${projectDirectory}/.safeword`)) {
  process.exit(0);
}

let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

// Only Edit/MultiEdit payloads carry prior content — a Write rewrite's
// from-phase is unknowable post-hoc (documented limit in work-log-stamp.ts).
const tool = input.tool_name ?? '';
if (tool !== 'Edit' && tool !== 'MultiEdit') {
  process.exit(0);
}

const filePath = input.tool_input?.file_path ?? '';
if (!filePath.endsWith('/ticket.md') || !isNamespacePath(filePath, 'tickets/')) {
  process.exit(0);
}

const transition = detectPhaseTransition(input.tool_input);
if (transition === undefined || !existsSync(filePath)) {
  process.exit(0);
}

const entry = `- ${new Date().toISOString()} Phase: ${transition.from} → ${transition.to}`;
writeFileSync(filePath, appendWorkLogEntry(readFileSync(filePath, 'utf8'), entry));
process.exit(0);
