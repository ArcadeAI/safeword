/**
 * Shared parser for a parenthesised manifest block — the `go.mod` `require (…)`
 * and `go.work` `use (…)` forms both wrap their entries in a `keyword ( … )`
 * block, one entry per line (ticket ZD70P1). This returns the meaningful entry
 * lines (trimmed, with blanks and `//` comments dropped) so each caller only
 * supplies its own per-entry interpretation.
 */

/**
 * The trimmed, non-blank, non-comment entry lines inside EVERY `<keyword> ( … )`
 * block matched by `opener`, or `[]` when no such block exists. `opener` must
 * match a block's opening line (e.g. `/^require\s*\(\s*$/`).
 *
 * All blocks are read, not just the first: `go mod tidy` (Go 1.17+) writes direct
 * and indirect requires into separate `require ( … )` blocks, and a go.work may
 * carry more than one `use ( … )` block — reading only the first silently drops
 * the rest (ticket ZD70P1 quality-review). A closing line is any line that begins
 * with `)` (so a `) // comment` still terminates the block).
 */
export function readDelimitedBlock(lines: string[], opener: RegExp): string[] {
  const entries: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock) {
      if (opener.test(trimmed)) inBlock = true;
      continue;
    }
    if (trimmed.startsWith(')')) inBlock = false;
    else if (trimmed !== '' && !trimmed.startsWith('//')) entries.push(trimmed);
  }
  return entries;
}
