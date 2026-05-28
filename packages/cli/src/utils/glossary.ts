/**
 * Glossary file model — parsing, validation, and lookup.
 *
 * Project-level glossary lives in `.safeword-project/glossary.md` (or the
 * path configured at `paths.glossary` in `.safeword/config.json`). Each
 * entry is a level-2 markdown block with a `## Term` header, a required
 * `**Definition:**` line, and optional `**Used in:**`, `**Example:**`,
 * `**Do not confuse with:**`, and `**Aliases:**` lines.
 *
 * Schema is intentionally lenient — unknown `**Field:**` lines are
 * tolerated for forward-compat, and the arcade-prototype
 * `**Used in**:` (colon outside the bold) variant parses identically
 * to `**Used in:**`. The required schema is just `## Term` + Definition;
 * everything else evolves per-team.
 *
 * See ticket YR6C49 for the full spec.
 */

/**
 * A parsed glossary entry — name + Definition (required), plus any
 * optional fields the entry authored. Aliases is always present
 * (possibly empty) so callers can iterate without an optional-chain.
 */
export interface ParsedGlossaryEntry {
  name: string;
  definition: string;
  usedIn?: string;
  example?: string;
  doNotConfuseWith?: string;
  aliases: string[];
  /** 1-indexed line number of the `## ` header. */
  lineNumber: number;
}

/**
 * Parse glossary entries from markdown content.
 *
 * Stub implementation — returns empty list. Replaced in GREEN.
 */
export function parseGlossary(_content: string): ParsedGlossaryEntry[] {
  return [];
}
