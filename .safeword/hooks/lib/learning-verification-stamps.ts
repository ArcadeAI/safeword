// Detect fabricated "✅ Verified" stamps in learning files (Ticket XV72DT).
//
// Background: agents sometimes write claims like "✅ Verified by `bun run build`"
// next to assertions that the cited command doesn't actually verify. Those
// claims land in .safeword-project/learnings/ and poison future-session context.
//
// Strategy: warn (PostToolUse additionalContext), not block. Per Anthropic's
// reward-hacking paper (arxiv:2511.18397), blocking semantic patterns generalizes
// to alignment-faking; inoculation (warn + reframe) is the mitigation that
// actually works. Strict regex only — no synonym chasing (arxiv:2504.11168).
//
// If you change these patterns, update tests/hooks/learning-verification-stamps.test.ts
// to match — the test file is the spec.

// Stamp shapes that indicate a fabricated verification claim.
const STAMP_PATTERNS: RegExp[] = [
  /✅\s*Verified\b/, //                       "✅ Verified" / "✅ Verified by …"
  /\bVerified by\b/, //                       "Verified by build" / "Verified by reading X"
  /^verified:\s/im, //                        "verified: true" — line-leading "verified:" key
];

// Idioms that look like stamps but aren't. Skipped when matched, even if a
// stamp pattern also matches the same line.
const EXEMPT_PATTERNS: RegExp[] = [
  /verified gap\b/i, //                       "verified gap, April 2026"
  /verified across\b/i, //                    "verified across tickets #124a/b"
  /empirically verified\b/i, //               "empirically verified across …"
  /verified in the literature\b/i, //         literature review citations
  /has not been verified\b/i, //              negation — explicitly unverified
  /^#{1,6}\s/m, //                            markdown heading (not a claim)
];

/**
 * Strip YAML frontmatter delimited by `---` on lines 1 and N.
 * Frontmatter is structured metadata; "verified: true" there is a schema
 * field, not a fabricated stamp.
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) return content;
  const lines = content.split(/\r?\n/);
  // First line is "---"; find the closing "---" after line 0.
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      return lines.slice(index + 1).join('\n');
    }
  }
  // No closing fence — treat as no frontmatter.
  return content;
}

/**
 * Check a single line in isolation. Exempt patterns win over stamp patterns:
 * "✅ Verified gap" (hypothetical) would be exempt.
 */
function lineHasStamp(line: string): boolean {
  if (EXEMPT_PATTERNS.some(pattern => pattern.test(line))) return false;
  return STAMP_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Returns true iff the file body (frontmatter stripped) contains at least one
 * fabricated-verification stamp that is not covered by an exempt idiom.
 */
export function hasVerificationStamp(content: string): boolean {
  const body = stripFrontmatter(content);
  return body.split(/\r?\n/).some(line => lineHasStamp(line));
}
