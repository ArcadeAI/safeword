/**
 * Shared parser for a parenthesised manifest block — the `go.mod` `require (…)`
 * and `go.work` `use (…)` forms both wrap their entries in a `keyword ( … )`
 * block, one entry per line (ticket ZD70P1). This returns the meaningful entry
 * lines (trimmed, with blanks and `//` comments dropped) so each caller only
 * supplies its own per-entry interpretation.
 */

/**
 * The trimmed, non-blank, non-comment entry lines inside the first
 * `<keyword> ( … )` block matched by `opener`, or `[]` when no such block exists.
 * `opener` must match the block's opening line (e.g. `/^require\s*\(\s*$/`).
 */
export function readDelimitedBlock(lines: string[], opener: RegExp): string[] {
  const start = lines.findIndex(line => opener.test(line.trim()));
  if (start === -1) return [];

  const entries: string[] = [];
  const blockLines = lines.slice(start + 1);
  for (const line of blockLines) {
    const trimmed = line.trim();
    if (trimmed === ')') break;
    if (trimmed === '' || trimmed.startsWith('//')) continue;
    entries.push(trimmed);
  }
  return entries;
}
