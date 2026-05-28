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

/** A validation error with a 1-indexed line reference into the source content. */
export interface GlossaryValidationError {
  line: number;
  message: string;
}

/** Group entries by a derived key, returning key → header line numbers. */
function groupByLine(
  entries: readonly ParsedGlossaryEntry[],
  pick: (entry: ParsedGlossaryEntry) => string,
): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const entry of entries) {
    const key = pick(entry);
    if (key.length === 0) continue;
    const lines = grouped.get(key) ?? [];
    lines.push(entry.lineNumber);
    grouped.set(key, lines);
  }
  return grouped;
}

/**
 * Group alias → header line numbers across all entries. Unlike
 * {@link groupByLine} (one key per entry), each entry contributes one key
 * per declared alias.
 */
function groupAliasesByLine(entries: readonly ParsedGlossaryEntry[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (alias.length === 0) continue;
      const lines = grouped.get(alias) ?? [];
      lines.push(entry.lineNumber);
      grouped.set(alias, lines);
    }
  }
  return grouped;
}

/**
 * Flag aliases that collide with a declared term name. Lookup must
 * resolve a string to exactly one term; an alias that shadows a real
 * term name is ambiguous. A self-alias (alias equal to its own term's
 * name) is harmless redundancy and not flagged.
 */
function findAliasShadowingTerms(
  entries: readonly ParsedGlossaryEntry[],
): GlossaryValidationError[] {
  const termLines = new Map<string, number>();
  for (const entry of entries) {
    if (entry.name.length > 0 && !termLines.has(entry.name)) {
      termLines.set(entry.name, entry.lineNumber);
    }
  }
  const errors: GlossaryValidationError[] = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const termLine = termLines.get(alias);
      if (termLine !== undefined && termLine !== entry.lineNumber) {
        errors.push({
          line: entry.lineNumber,
          message: `alias "${alias}" shadows term defined at line ${termLine}`,
        });
      }
    }
  }
  return errors;
}

/** Produce duplicate-detection errors from a grouping. */
function findDuplicates(
  grouped: Map<string, number[]>,
  kind: 'term' | 'alias',
): GlossaryValidationError[] {
  const errors: GlossaryValidationError[] = [];
  for (const [value, lines] of grouped.entries()) {
    if (lines.length <= 1) continue;
    for (const line of lines) {
      const others = lines.filter(other => other !== line).join(', ');
      errors.push({ line, message: `duplicate ${kind} "${value}" (also at line ${others})` });
    }
  }
  return errors;
}

/**
 * Validate parsed glossary entries. Returns a list of
 * {@link GlossaryValidationError} with 1-indexed line numbers; empty list
 * means the file is well-formed.
 *
 * Checks (each independent, all errors collected — never throws):
 * - Every entry has a non-empty term name.
 * - Every entry has a non-empty `**Definition:**`.
 * - Term names are unique within the file.
 * - Aliases are unique across all terms.
 * - No alias shadows a declared term name (ambiguous lookup).
 */
export function validateGlossary(
  entries: readonly ParsedGlossaryEntry[],
): GlossaryValidationError[] {
  const errors: GlossaryValidationError[] = [];
  for (const entry of entries) {
    if (entry.name.length === 0) {
      errors.push({ line: entry.lineNumber, message: 'header is missing term name' });
    }
    if (entry.definition.trim().length === 0) {
      const label = entry.name.length === 0 ? 'entry' : `"${entry.name}"`;
      errors.push({ line: entry.lineNumber, message: `${label} is missing Definition` });
    }
  }
  errors.push(
    ...findDuplicates(
      groupByLine(entries, entry => entry.name),
      'term',
    ),
    ...findDuplicates(groupAliasesByLine(entries), 'alias'),
    ...findAliasShadowingTerms(entries),
  );
  return errors;
}

/**
 * The string-valued fields a `**Field:**` line can populate. Aliases is
 * excluded — it parses to an array and does not accumulate across lines.
 */
type StringFieldKey = 'definition' | 'usedIn' | 'example' | 'doNotConfuseWith';

/**
 * Maps a `**Field:**` prefix to the corresponding property on
 * `ParsedGlossaryEntry`. Lookup is by exact-prefix; unknown prefixes are
 * silently ignored (forward-compat per ticket scope).
 */
const FIELD_PROPERTY_MAP: ReadonlyMap<string, StringFieldKey> = new Map([
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
function parseFieldLine(line: string): { property: StringFieldKey; value: string } | undefined {
  const normalized = normalizeFieldColon(line);
  for (const [prefix, property] of FIELD_PROPERTY_MAP) {
    if (normalized.startsWith(prefix)) {
      return { property, value: normalized.slice(prefix.length).trim() };
    }
  }
  return undefined;
}

/**
 * Whether a line looks like a `**Field:**` declaration (known or not).
 * Used to terminate continuation accumulation on an unknown field line
 * so it isn't swallowed into the previous field's value. Accepts the
 * colon-outside variant via normalization first.
 */
function looksLikeFieldDeclaration(line: string): boolean {
  const normalized = normalizeFieldColon(line);
  if (!normalized.startsWith('**')) return false;
  // Require non-empty content between the opening `**` and the `:**` close.
  return normalized.indexOf(':**') > 2;
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
 * Outcome of applying one line to the active entry:
 * - `field` — a string field was set; the caller accumulates continuation
 *   lines into `field`.
 * - `aliases` — the aliases line was consumed; stop accumulating.
 * - `none` — no known prefix matched; the line is a continuation candidate.
 */
type LineOutcome =
  | { kind: 'field'; field: StringFieldKey }
  | { kind: 'aliases' }
  | { kind: 'none' };

/**
 * Apply a recognized field/alias line to the active entry. Unknown
 * `**Field:**` lines are tolerated per ticket scope (returns `none`).
 */
function applyLineToEntry(line: string, entry: ParsedGlossaryEntry): LineOutcome {
  const aliases = parseAliasLine(line);
  if (aliases !== undefined) {
    entry.aliases = aliases;
    return { kind: 'aliases' };
  }
  const field = parseFieldLine(line);
  if (field) {
    entry[field.property] = field.value;
    return { kind: 'field', field: field.property };
  }
  return { kind: 'none' };
}

/**
 * Append a continuation line to the active string field, soft-wrap style:
 * single space between the existing text and the trimmed continuation.
 */
function appendContinuation(entry: ParsedGlossaryEntry, field: StringFieldKey, line: string): void {
  const existing = entry[field] ?? '';
  const addition = line.trim();
  entry[field] = existing.length === 0 ? addition : `${existing} ${addition}`;
}

/**
 * Apply one body line (a line within a `## Term` block) to the active
 * entry and return the field that should accumulate subsequent
 * continuation lines. A blank line, an aliases line, or an unknown
 * `**Field:**` declaration resets accumulation (returns undefined).
 */
function consumeBodyLine(
  line: string,
  entry: ParsedGlossaryEntry,
  activeField: StringFieldKey | undefined,
): StringFieldKey | undefined {
  if (line.trim().length === 0) return undefined;
  const outcome = applyLineToEntry(line, entry);
  if (outcome.kind === 'field') return outcome.field;
  if (outcome.kind === 'aliases' || looksLikeFieldDeclaration(line)) return undefined;
  if (activeField !== undefined) appendContinuation(entry, activeField, line);
  return activeField;
}

/**
 * Compute a per-line boolean[] where `true` means "skip during parsing"
 * because the line lives inside a triple-backtick code fence or a
 * block-level HTML comment (`<!-- ... -->`). Per CommonMark, only a line
 * that BEGINS with `<!--` (after optional indent) opens a block-level
 * comment; inline `<!--` mid-line is inline HTML and handled separately
 * by stripInlineComments.
 */
function computeSkipMask(lines: readonly string[]): boolean[] {
  const skip: boolean[] = [];
  let insideCodeFence = false;
  let insideComment = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      skip.push(true);
      insideCodeFence = !insideCodeFence;
      continue;
    }
    if (insideCodeFence) {
      skip.push(true);
      continue;
    }
    if (!insideComment && line.trimStart().startsWith('<!--')) insideComment = true;
    if (insideComment) {
      skip.push(true);
      if (line.includes('-->')) insideComment = false;
      continue;
    }
    skip.push(false);
  }
  return skip;
}

/**
 * Strip inline `<!-- ... -->` comments from a single line of text.
 * Per CommonMark, an HTML comment that appears mid-line is inline HTML
 * and doesn't appear in the rendered output. Regex-free and bounded:
 * each `<!--` advances the scan past its matching `-->`, O(n) with no
 * backtracking. Unclosed inline comment leaves the rest of the line
 * intact — block-level handling lives in computeSkipMask.
 */
function stripInlineComments(text: string): string {
  let result = '';
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('<!--', pos);
    if (open === -1) {
      result += text.slice(pos);
      break;
    }
    result += text.slice(pos, open);
    const close = text.indexOf('-->', open + 4);
    if (close === -1) {
      result += text.slice(open);
      break;
    }
    pos = close + 3;
  }
  return result;
}

/**
 * If the line is a level-2 header (`## Name`, or a bare/empty `##`),
 * return the (possibly empty) term name with inline comments stripped.
 * Returns undefined for non-header lines. An empty name is surfaced as a
 * validation error downstream, not dropped here — so the bad line still
 * produces an entry the validator can point at.
 */
function parseTermHeader(line: string): string | undefined {
  if (line === '##') return '';
  if (line.startsWith('## ')) return stripInlineComments(line.slice(3)).trim();
  return undefined;
}

/**
 * Parse glossary entries from markdown content.
 *
 * Walks lines once, tracking the active `## Term` block. Skip-mask hides
 * fenced code and block HTML comments. Inline HTML comments are stripped
 * from header text before name extraction. Known `**Field:**` lines (plus
 * the arcade colon-outside variant) populate the matching property on the
 * active entry; unknown `**Field:**` lines are silently tolerated. Pure
 * — no I/O.
 */
export function parseGlossary(content: string): ParsedGlossaryEntry[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const entries: ParsedGlossaryEntry[] = [];
  let current: ParsedGlossaryEntry | undefined;
  // The field currently accumulating continuation lines. Reset on a blank
  // line, a new `## ` header, or an aliases line.
  let activeField: StringFieldKey | undefined;

  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const headerName = parseTermHeader(line);
    if (headerName !== undefined) {
      if (current) entries.push(current);
      current = {
        name: headerName,
        definition: '',
        aliases: [],
        lineNumber: index + 1,
      };
      activeField = undefined;
      continue;
    }
    if (!current) continue;
    activeField = consumeBodyLine(line, current, activeField);
  }

  if (current) entries.push(current);
  return entries;
}
