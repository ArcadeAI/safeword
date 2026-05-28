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
 * Walks lines once, tracking the active `## Term` block. When a known
 * `**Field:**` line is encountered inside a block, the field is captured
 * on the active entry. Unknown `**Field:**` lines are silently tolerated
 * (forward-compat per ticket scope).
 */
/**
 * Maps a `**Field:**` prefix to the corresponding property on
 * `ParsedGlossaryEntry`. Lookup is by exact-prefix; unknown prefixes are
 * silently ignored (forward-compat per ticket scope).
 */
const FIELD_PROPERTY_MAP: ReadonlyMap<string, keyof ParsedGlossaryEntry> = new Map([
  ['**Definition:**', 'definition'],
  ['**Used in:**', 'usedIn'],
  ['**Example:**', 'example'],
  ['**Do not confuse with:**', 'doNotConfuseWith'],
]);

/**
 * Normalize the colon-outside variant `**Foo**:` to the canonical
 * colon-inside form `**Foo:**` so a single prefix lookup table covers
 * both. Arcade's prototype glossary mixes both conventions on adjacent
 * lines — the parser must tolerate either.
 *
 * Bounded: only inspects the leading `**...**:` segment; no backtracking.
 */
function normalizeFieldColon(line: string): string {
  if (!line.startsWith('**')) return line;
  const closeBold = line.indexOf('**', 2);
  if (closeBold === -1) return line;
  if (line.charAt(closeBold + 2) !== ':') return line;
  // Splice: `<prefix>**` + `:**` + `<rest after `**:`>` →
  // `**Foo**: bar` becomes `**Foo:** bar`.
  return `${line.slice(0, closeBold)}:**${line.slice(closeBold + 3)}`;
}

/**
 * If the line begins with one of the known `**Field:**` prefixes, return
 * the property + value to assign. Otherwise return undefined.
 */
function parseFieldLine(
  line: string,
): { property: keyof ParsedGlossaryEntry; value: string } | undefined {
  const normalized = normalizeFieldColon(line);
  for (const [prefix, property] of FIELD_PROPERTY_MAP) {
    if (normalized.startsWith(prefix)) {
      return { property, value: normalized.slice(prefix.length).trim() };
    }
  }
  return undefined;
}

/**
 * Parse the comma-separated alias list from a `**Aliases:** foo, bar` line.
 * Empty trailing-whitespace yields an empty list. Returns undefined when
 * the line isn't an Aliases line.
 */
function parseAliasLine(line: string): string[] | undefined {
  if (!line.startsWith('**Aliases:**')) return undefined;
  const raw = line.slice('**Aliases:**'.length).trim();
  return raw.length === 0 ? [] : raw.split(',').map(part => part.trim());
}

/**
 * Apply a recognized field/alias line to the active entry. No-op when the
 * line doesn't match a known prefix (unknown `**Field:**` lines are
 * tolerated per ticket scope).
 */
function applyLineToEntry(line: string, entry: ParsedGlossaryEntry): void {
  const aliases = parseAliasLine(line);
  if (aliases !== undefined) {
    entry.aliases = aliases;
    return;
  }
  const field = parseFieldLine(line);
  if (field) {
    // Field-property values are all strings; the cast is safe because
    // parseFieldLine only returns string-valued props.
    (entry as Record<string, unknown>)[field.property] = field.value;
  }
}

export function parseGlossary(content: string): ParsedGlossaryEntry[] {
  const lines = content.split('\n');
  const entries: ParsedGlossaryEntry[] = [];
  let current: ParsedGlossaryEntry | undefined;

  for (const [index, line] of lines.entries()) {
    if (line.startsWith('## ')) {
      if (current) entries.push(current);
      current = {
        name: line.slice(3).trim(),
        definition: '',
        aliases: [],
        lineNumber: index + 1,
      };
      continue;
    }
    if (!current) continue;
    applyLineToEntry(line, current);
  }

  if (current) entries.push(current);
  return entries;
}
