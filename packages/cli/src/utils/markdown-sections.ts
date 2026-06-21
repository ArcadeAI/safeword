/**
 * Markdown section-walk primitives shared by the `## `-block parsers in
 * src/utils (personas, glossary, scenario-coverage). Extracted per ticket
 * WQ4RH3 — Rule of Three on a single CommonMark comment/fence-skip behavior.
 *
 * NOTE: the hook-side parser (`.safeword/hooks/lib/jtbd.ts`) deliberately does
 * NOT share this module — deployed hooks run standalone from `.safeword/hooks/`
 * and cannot import the CLI's dist. That copy is an intentional cross-runtime
 * boundary, not accidental duplication.
 */

/**
 * Per-line boolean[] where `true` means "skip this line during parsing"
 * because it lives inside a triple-backtick code fence or a block-level HTML
 * comment (`<!-- ... -->`). The array has the same length as the input so a
 * caller can use the line index directly as a 1-indexed line number.
 *
 * Per CommonMark, only a line that BEGINS with `<!--` (after optional indent)
 * opens a block-level HTML comment; inline `<!--` mid-line is inline HTML,
 * handled by {@link stripInlineComments}, not by this mask.
 */
export function computeSkipMask(lines: readonly string[]): boolean[] {
  const skip: boolean[] = [];
  let isInsideCodeFence = false;
  let isInsideComment = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      skip.push(true);
      isInsideCodeFence = !isInsideCodeFence;
      continue;
    }
    if (isInsideCodeFence) {
      skip.push(true);
      continue;
    }
    if (!isInsideComment && line.trimStart().startsWith('<!--')) isInsideComment = true;
    if (isInsideComment) {
      skip.push(true);
      if (line.includes('-->')) isInsideComment = false;
      continue;
    }
    skip.push(false);
  }
  return skip;
}

/**
 * Strip inline `<!-- ... -->` comments from a single line of text. Per
 * CommonMark, an HTML comment that appears mid-line (after other content) is
 * inline HTML and doesn't appear in rendered output. Regex-free and bounded:
 * each `<!--` advances the scan past its matching `-->`, so the function is
 * O(n) with no backtracking. An unclosed inline comment leaves the rest of the
 * line intact — block-level handling lives in {@link computeSkipMask}.
 */
export function stripInlineComments(text: string): string {
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
      // Unclosed inline comment — emit the rest as-is. The line-state machine
      // in computeSkipMask handles multi-line block comments separately.
      result += text.slice(open);
      break;
    }
    pos = close + 3;
  }
  return result;
}

const HEADING_WHITESPACE = /^\s/;

/**
 * An ATX heading → `{ level, text }`, or undefined for a non-heading line.
 * Counts leading `#` manually (no quantifier-over-quantifier regex) and requires
 * a whitespace separator (space or tab, per CommonMark) before the heading text.
 * Shared by the `## `-block parsers (scenario-coverage, test-skeleton).
 */
export function parseHeading(line: string): { level: number; text: string } | undefined {
  const trimmed = line.trim();
  let level = 0;
  while (level < trimmed.length && trimmed.charAt(level) === '#') level += 1;
  if (level === 0 || level > 6) return undefined;
  const rest = trimmed.slice(level);
  if (rest.length === 0 || !HEADING_WHITESPACE.test(rest)) return undefined;
  return { level, text: rest.trim() };
}
