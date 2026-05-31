/**
 * Shared validation helpers for the `## `-block file models (personas,
 * glossary). Both group parsed entries by a key and flag duplicates with a
 * uniform `duplicate <kind> "<value>" (also at line <others>)` message.
 * Extracted per ticket JZXVKN (Rule of Three, after WQ4RH3's skip-mask lift).
 */

/** A validation finding with a 1-indexed line reference into the source. */
export interface ValidationIssue {
  line: number;
  message: string;
}

/**
 * Group entries by a derived key → the 1-indexed header line numbers that
 * produced it. Empty keys are skipped. Works for any parsed entry carrying a
 * `lineNumber` (ParsedPersona, ParsedGlossaryEntry, …).
 */
export function groupByLine<T extends { lineNumber: number }>(
  entries: readonly T[],
  pick: (entry: T) => string,
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
 * Produce duplicate-detection issues from a grouping (key → header line
 * numbers): every key with more than one line yields one issue per line,
 * naming the others. `kind` labels the value class (e.g. "persona name",
 * "persona code", "term", "alias").
 */
export function findDuplicates(grouped: Map<string, number[]>, kind: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [value, lines] of grouped.entries()) {
    if (lines.length <= 1) continue;
    for (const line of lines) {
      const others = lines.filter(other => other !== line).join(', ');
      issues.push({ line, message: `duplicate ${kind} "${value}" (also at line ${others})` });
    }
  }
  return issues;
}
