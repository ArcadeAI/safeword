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
   * Named entry-point skill for a MULTI-skill pack — the dispatcher/orchestrator
   * the agent should open first (e.g. samber's `golang-how-to`, which routes to
   * the right specialized skill among ~50). Omit for single-skill packs: there
   * the sole installed dir IS the entry, discovered from disk. When set, the nudge
   * names this skill ONLY if its dir is actually installed; otherwise it falls
   * back to the illustrative-concerns line (degrade-not-fail) rather than picking
   * an arbitrary one of many.
   */
  dispatcher?: string;
  /**
   * Illustrative concern domains for the nudge FALLBACK — stable language domains,
   * NOT skill names. Used only when no entry skill resolves (none installed, a
   * declared dispatcher is missing, or its description can't be read). Being
   * illustrative (not exhaustive) keeps the fallback drift-free: an upstream skill
   * add/rename never makes it stale.
   */
  concerns: readonly string[];
}

/** A resolved entry skill: its dir name plus its own SKILL.md `description`. */
export interface EntrySkill {
  /** Installed skill directory name, e.g. `golang-how-to` or `typescript-pro`. */
  name: string;
  /** The skill's own frontmatter `description`, surfaced verbatim in the nudge. */
  description: string;
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
    // samber/cc-skills-golang ships ~50 atomic skills plus this always-active
    // orchestrator that reads the task and loads the right ones — so the nudge
    // points here, not at a guess among the 50.
    dispatcher: 'golang-how-to',
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

/**
 * Pick the single entry-point skill to point the agent at, from the installed
 * skill dir names. Pure (the caller reads the dir list off disk):
 *
 * - Pack declares a `dispatcher` (multi-skill, e.g. Go): use it IFF it's actually
 *   installed; otherwise null — never pick an arbitrary one of many.
 * - No dispatcher (single-skill pack): the sole dir for this prefix is the entry.
 *   0 or >1 dirs → null (ambiguous), so the caller falls back to the concerns line.
 */
export function entrySkillFor(
  language: SkillLanguage,
  installedDirs: readonly string[],
): string | null {
  const own = installedDirs.filter(dir => dir.split('-')[0] === language.prefix);
  if (language.dispatcher) {
    return own.includes(language.dispatcher) ? language.dispatcher : null;
  }
  return own.length === 1 ? (own[0] ?? null) : null;
}

/**
 * Extract the `description` from a SKILL.md's YAML frontmatter without a YAML
 * dependency (deployed hooks run standalone, no node_modules). Handles the three
 * shapes skills use: inline plain (`description: foo`), inline quoted
 * (`description: "foo"` / `'foo'`), and block scalars (`description: |` or `>`).
 * Returns the trimmed description, or null when there's no frontmatter / no
 * description (the caller then uses the fallback nudge line).
 */
export function parseSkillDescription(skillMd: string): string | null {
  const frontmatter = skillMd.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const lines = (frontmatter[1] ?? '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const match = (lines[i] ?? '').match(/^(\s*)description:\s*(.*)$/);
    if (!match) continue;
    const indent = (match[1] ?? '').length;
    const rest = (match[2] ?? '').trim();

    // Block scalar: `|`/`>` with optional chomping (`+`/`-`) / indent digits.
    if (/^[|>][+-]?\d*\s*$/.test(rest)) {
      const folded = rest.startsWith('>');
      const collected: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const raw = lines[j] ?? '';
        if (raw.trim() === '') {
          collected.push('');
          continue;
        }
        const rawIndent = raw.length - raw.trimStart().length;
        if (rawIndent <= indent) break; // dedent ends the block
        collected.push(raw);
      }
      while (collected.length && collected[collected.length - 1] === '') collected.pop();
      const nonEmpty = collected.filter(line => line.trim() !== '');
      const minIndent = nonEmpty.length
        ? Math.min(...nonEmpty.map(line => line.length - line.trimStart().length))
        : indent + 1;
      const dedented = collected.map(line => (line.trim() === '' ? '' : line.slice(minIndent)));
      const text = folded
        ? dedented
            .map(line => line.trim())
            .filter(Boolean)
            .join(' ')
        : dedented.join('\n').trim();
      return text || null;
    }

    // Inline scalar — strip a matching pair of surrounding quotes.
    const unquoted =
      rest.length >= 2 &&
      ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'")))
        ? rest.slice(1, -1)
        : rest;
    return unquoted.trim() || null;
  }
  return null;
}

/**
 * The one-line nudge for a language. When an entry skill resolved (single-skill
 * pack's sole skill, or a multi-skill pack's installed dispatcher), point the
 * agent directly at it and surface its own `description` verbatim — no
 * self-selection, no safeword-authored concern list to drift. Otherwise fall back
 * to the illustrative-concerns line.
 */
export function skillNudgeLine(language: SkillLanguage, entry?: EntrySkill | null): string {
  if (entry && entry.description.trim()) {
    return (
      `${language.display} file touched — before writing more, open the \`${entry.name}\` ` +
      `skill and follow it. What it covers: ${entry.description.trim()} ` +
      `Revise the current file if it applies.`
    );
  }
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
  entry?: EntrySkill | null,
): SkillNudge | null {
  const language = languageForFile(filePath);
  if (!language) return null;
  if (!installedPrefixes.has(language.prefix)) return null;
  return {
    line: skillNudgeLine(language, entry),
    dedupKey: `${language.prefix}:${activeScenario ?? 'session'}`,
  };
}
