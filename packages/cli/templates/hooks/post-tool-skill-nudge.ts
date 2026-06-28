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
import {
  decideSkillNudge,
  type EntrySkill,
  entrySkillFor,
  languageForFile,
  parseSkillDescription,
  type SkillLanguage,
  SKILL_LANGUAGES,
} from './lib/skill-nudge.ts';

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

const skillDirs = installedSkillDirs(projectDirectory);
const installed = new Set(skillDirs.map(dir => dir.name.split('-')[0]));
if (!installed.has(language.prefix)) process.exit(0);

// Resolve the single entry skill (the sole installed skill for a single-skill
// pack, or the installed dispatcher for a multi-skill pack) and read its own
// SKILL.md `description` off disk. Degrade-not-fail: any miss leaves `entry`
// null and decideSkillNudge uses the illustrative-concerns fallback line.
const entry = resolveEntrySkill(skillDirs, language);

// Active ticket comes from the shared quality-state file — READ ONLY. We never
// write that file: post-tool-quality.ts owns it and runs in parallel on the same
// edit, so a shared read-modify-write here would lose one hook's update.
const sharedStateFile = getStateFilePath(projectDirectory, input.session_id);
const scenario = activeScenario(projectDirectory, readState(sharedStateFile).activeTicket);

const nudge = decideSkillNudge(filePath, installed, scenario, entry);
if (!nudge) process.exit(0);

// Flag-and-clear: fire once per (language, scenario). Dedup state lives in its
// OWN file (derived from the shared path so it reuses the same session-key
// resolution) so this hook never contends on the shared state file.
const dedupFile = sharedStateFile.replace('quality-state-', 'skill-nudge-');
const fired = readState(dedupFile).firedSkillNudges ?? [];
if (fired.includes(nudge.dedupKey)) process.exit(0);
try {
  writeFileSync(
    dedupFile,
    JSON.stringify({ firedSkillNudges: [...fired, nudge.dedupKey] }, null, 2),
  );
} catch {
  // State unwritable — surface the nudge anyway; worst case it repeats.
}

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: nudge.line },
  }),
);

interface InstalledSkillDir {
  /** Skill directory name, e.g. `golang-how-to`. */
  name: string;
  /** Absolute path to the skill directory (for reading its SKILL.md). */
  path: string;
}

/**
 * Installed skill dirs (name + path) whose first path-segment is a known
 * SKILL_LANGUAGES prefix. Gating by `known` means safeword's own skill dirs never
 * match. The caller derives installed prefixes from `.name` and reads the entry
 * skill's SKILL.md from `.path`.
 *
 * (Latent: if a future SKILL_LANGUAGES prefix equalled a real dir's first segment,
 * that dir would be misread as installed — revisit when adding languages.)
 */
function installedSkillDirs(projectRoot: string): InstalledSkillDir[] {
  const known = new Set(Object.values(SKILL_LANGUAGES).map(language => language.prefix));
  const found: InstalledSkillDir[] = [];
  for (const relative of ['.claude/skills', '.agents/skills']) {
    const directory = nodePath.join(projectRoot, relative);
    if (!existsSync(directory)) continue;
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const prefix = entry.name.split('-')[0];
        if (prefix && known.has(prefix)) {
          found.push({ name: entry.name, path: nodePath.join(directory, entry.name) });
        }
      }
    } catch {
      // Unreadable dir — treat as no skills there.
    }
  }
  return found;
}

/**
 * Resolve the entry skill to point at — its dir name plus its own SKILL.md
 * `description` — or null when none resolves (caller falls back to the concerns
 * line). Best-effort: an unreadable / description-less SKILL.md yields null.
 */
function resolveEntrySkill(
  skillDirs: readonly InstalledSkillDir[],
  language: SkillLanguage,
): EntrySkill | null {
  const entryName = entrySkillFor(
    language,
    skillDirs.map(dir => dir.name),
  );
  if (!entryName) return null;
  const match = skillDirs.find(dir => dir.name === entryName);
  if (!match) return null;
  try {
    const description = parseSkillDescription(
      readFileSync(nodePath.join(match.path, 'SKILL.md'), 'utf8'),
    );
    return description ? { name: entryName, description } : null;
  } catch {
    return null;
  }
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
