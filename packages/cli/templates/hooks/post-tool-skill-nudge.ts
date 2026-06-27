#!/usr/bin/env bun
// Safeword: language-skill nudge (PostToolUse). When the agent edits a source
// file in a language that has installed coding skills (e.g. a .go file with
// samber golang-* skills present), inject a one-line advisory pointing at the
// matching skill — fired once per scenario (flag-and-clear), never blocking.
//
// PostToolUse + additionalContext is the proven advisory channel (PreToolUse
// additionalContext-on-allow is not delivered to the model). Firing on the first
// source-file edit is language-accurate by construction (only matching
// extensions trigger it), so it is correct in polyglot repos where a
// scenario-start UserPromptSubmit hook could not know the language.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { deriveActiveScenario, getTicketInfo } from './lib/active-ticket.ts';
import { getStateFilePath } from './lib/quality-state.ts';
import { decideSkillNudge, languageForFile, SKILL_LANGUAGES } from './lib/skill-nudge.ts';

interface HookInput {
  session_id?: string;
  tool_input?: { file_path?: string };
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(nodePath.join(projectDirectory, '.safeword'))) process.exit(0);

let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

// Cheapest gate first: skip before any disk I/O when the file isn't a
// skill-backed language source file.
const language = languageForFile(filePath);
if (!language) process.exit(0);

if (!installedPrefixes(projectDirectory).has(language.prefix)) process.exit(0);

// Per-session state holds the active ticket and the fired-nudge keys.
const stateFile = getStateFilePath(projectDirectory, input.session_id);
const state = readState(stateFile);

const scenario = activeScenario(projectDirectory, state.activeTicket);
const nudge = decideSkillNudge(filePath, installedPrefixes(projectDirectory), scenario);
if (!nudge) process.exit(0);

// Flag-and-clear: fire once per (language, scenario).
const fired = Array.isArray(state.firedSkillNudges) ? state.firedSkillNudges : [];
if (fired.includes(nudge.dedupKey)) process.exit(0);
state.firedSkillNudges = [...fired, nudge.dedupKey];
try {
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
} catch {
  // State unwritable — surface the nudge anyway; worst case it repeats.
}

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: nudge.line },
  }),
);

/** Language prefixes (from SKILL_LANGUAGES) that have at least one skill on disk. */
function installedPrefixes(projectRoot: string): Set<string> {
  const known = new Set(Object.values(SKILL_LANGUAGES).map(language => language.prefix));
  const found = new Set<string>();
  for (const relative of ['.claude/skills', '.agents/skills']) {
    const directory = nodePath.join(projectRoot, relative);
    if (!existsSync(directory)) continue;
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const prefix = entry.name.split('-')[0];
        if (prefix && known.has(prefix)) found.add(prefix);
      }
    } catch {
      // Unreadable dir — treat as no skills there.
    }
  }
  return found;
}

interface SessionState {
  activeTicket?: string;
  firedSkillNudges?: string[];
  [key: string]: unknown;
}

function readState(file: string): SessionState {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as SessionState;
  } catch {
    return {};
  }
}

function activeScenario(projectRoot: string, activeTicket: string | undefined): string | undefined {
  if (!activeTicket) return undefined;
  const info = getTicketInfo(projectRoot, activeTicket);
  return info.folder ? deriveActiveScenario(projectRoot, info.folder) : undefined;
}
