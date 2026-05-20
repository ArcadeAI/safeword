/**
 * Slug normalization for `safeword ticket new <slug>` (ticket 158, slice 3).
 *
 * Slugs are stored in frontmatter and feed work-log filenames. Normalize at the
 * CLI boundary so the canonical form is always lowercase kebab-case:
 *   - NFKD-fold (decomposes accents)
 *   - drop combining marks (Unicode block U+0300–U+036F)
 *   - lowercase
 *   - replace non-alphanumeric runs with a single `-`
 *   - strip leading/trailing `-`
 * Empty result throws SlugError so the CLI can exit with a clear message.
 */

export class SlugError extends Error {
  constructor(public readonly input: string) {
    super(
      input === ''
        ? 'Slug cannot be empty.'
        : `Slug "${input}" normalizes to empty (no alphanumeric content).`,
    );
    this.name = 'SlugError';
  }
}

// `\p{Mn}` matches Nonspacing-Mark characters — the combining marks NFKD
// decomposition exposes when it pulls accents off their base letter.
const COMBINING_MARKS = /\p{Mn}/gu;
const NON_ALNUM = /[^a-z\d]+/g;

export function normalizeSlug(input: string): string {
  const folded = input.normalize('NFKD').replaceAll(COMBINING_MARKS, '');
  const collapsed = stripDashEdges(folded.toLowerCase().replaceAll(NON_ALNUM, '-'));
  if (collapsed === '') throw new SlugError(input);
  return collapsed;
}

function stripDashEdges(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charAt(start) === '-') start++;
  while (end > start && value.charAt(end - 1) === '-') end--;
  return value.slice(start, end);
}
