// Safeword: language-skill nudge — pure decision helpers (no I/O, ticket TBD).
//
// Standalone (deployed hooks run from .safeword/hooks/ with no access to the CLI
// dist — same rationale as jtbd.ts / impl-plan.ts). The PostToolUse hook supplies
// the edited file path, the set of installed skill prefixes (derived from
// .claude/skills/<prefix>-* on disk), and the active scenario id; these pure
// functions decide whether to surface a one-line "consult the matching <lang>
// skill" nudge and how to dedup it (flag-and-clear per scenario).
//
// Language-general by design: adding a row to SKILL_LANGUAGES extends the nudge
// to another language once its langpack ships skills. Today only Go ships skills.

export interface SkillLanguage {
  /** Installed-skill directory prefix, e.g. `golang` (matches `golang-*` dirs). */
  prefix: string;
  /** Human display name for the nudge copy. */
  display: string;
  /**
   * Illustrative concern domains for the nudge — stable language domains, NOT
   * skill names. Being illustrative (not exhaustive) keeps the line drift-free:
   * an upstream skill add/rename never makes it stale.
   */
  concerns: readonly string[];
}

/**
 * Source-file extension → language. Drives both which edits trigger a nudge and
 * the concern hints. The `prefix` must match the installed `<prefix>-*` skill
 * directory names.
 */
export const SKILL_LANGUAGES: Readonly<Record<string, SkillLanguage>> = {
  '.go': {
    prefix: 'golang',
    display: 'Go',
    concerns: ['concurrency', 'context', 'error handling', 'testing', 'API design'],
  },
};

/** The language a file path maps to by extension, or null if none. */
export function languageForFile(filePath: string): SkillLanguage | null {
  const lower = filePath.toLowerCase();
  for (const [extension, language] of Object.entries(SKILL_LANGUAGES)) {
    if (lower.endsWith(extension)) return language;
  }
  return null;
}

/** The one-line nudge for a language. Concerns render as illustrative prompts. */
export function skillNudgeLine(language: SkillLanguage): string {
  const questions = language.concerns.map(concern => `${concern}?`).join(' ');
  return (
    `${language.display} file touched — before writing more, open the ${language.prefix}-* ` +
    `skill that fits this work (${questions}). Revise the current file if it applies.`
  );
}

/**
 * Identify the scenario the agent is currently working, from test-definitions.md
 * content, for per-scenario dedup. Returns the heading of the first scenario that
 * still has an unchecked RED/GREEN/REFACTOR box (the current frontier), or
 * undefined when there's no recognizable in-progress scenario (then the caller
 * falls back to a session-scoped key). Pure; mirrors parseTddStep's scan but
 * returns scenario identity rather than the TDD step.
 */
export function activeScenarioKey(content: string): string | undefined {
  const lines = content.split('\n');
  let heading: string | undefined;
  let firstUnfinished: string | undefined;
  let sawUnchecked = false;

  const flush = (): void => {
    if (heading && sawUnchecked && !firstUnfinished) firstUnfinished = heading;
  };

  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#{2,3}\s+/, '').trim();
      sawUnchecked = false;
      continue;
    }
    if (/^- \[ \] (RED|GREEN|REFACTOR)\b/i.test(line)) sawUnchecked = true;
  }
  flush();
  return firstUnfinished;
}

export interface SkillNudge {
  /** The advisory line to inject. */
  line: string;
  /**
   * Flag-and-clear key (per language + scenario). The hook records fired keys in
   * session state so the nudge surfaces once per scenario, not per edit. Falls
   * back to a session-scoped key when there is no active scenario (non-BDD work).
   */
  dedupKey: string;
}

/**
 * Decide whether an edit should trigger a skill nudge. Pure: the caller supplies
 * which skill prefixes are installed (read from disk) and the active scenario id.
 * Returns the nudge + dedup key, or null when the file isn't a skill-backed
 * language or that language's skills aren't installed.
 */
export function decideSkillNudge(
  filePath: string,
  installedPrefixes: ReadonlySet<string>,
  activeScenario: string | undefined,
): SkillNudge | null {
  const language = languageForFile(filePath);
  if (!language) return null;
  if (!installedPrefixes.has(language.prefix)) return null;
  return {
    line: skillNudgeLine(language),
    dedupKey: `${language.prefix}:${activeScenario ?? 'session'}`,
  };
}
