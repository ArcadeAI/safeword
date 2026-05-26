/**
 * Persona file model — derivation, parsing, validation, and lookup.
 *
 * Project-level personas live in `.safeword-project/personas.md` as
 * second-level markdown blocks. Each block has a name, an optional
 * parenthesized short code (auto-derived if absent), a `**Role:**` line,
 * and an optional `**Context:**` block.
 *
 * Short codes follow the pattern `^[A-Z][A-Z0-9]{1,5}$` — 2-6 chars,
 * uppercase letter first, then letters and digits. Codes are derived
 * conventionally from the name (first-letter-of-each-word for multi-word,
 * first-2-chars for single-word), with non-alpha characters stripped before
 * derivation. Users can override the derived code with explicit
 * `## Name (CODE)` syntax.
 *
 * See ticket 7YN5QB for the full spec.
 */

/** Maximum length of a derived short code (overflow is truncated silently). */
const MAX_CODE_LENGTH = 6;
/** Minimum persona name length — single-char names are rejected at validation. */
const MIN_NAME_LENGTH = 2;
/** Pattern for a valid persona short code. */
export const PERSONA_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

/**
 * Derive a short code from a persona name.
 *
 * Multi-word names use first-letter-of-each-word ("Platform Operator" → "PO").
 * Single-word names use first-2-chars uppercased ("Auditor" → "AU").
 * Non-alpha characters (apostrophes, hyphens) are stripped before derivation;
 * digits are preserved within the resulting code.
 * Overflow is truncated to the first {@link MAX_CODE_LENGTH} characters.
 *
 * Note: the returned code may not pass {@link PERSONA_CODE_PATTERN} for
 * pathological inputs (e.g., digit-first names like "3 Amigos" → "3A").
 * Pattern enforcement happens at validation time, not derivation time.
 */
export function derivePersonaCode(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // Strip non-alphanumeric except whitespace — keeps digits, removes
  // apostrophes/hyphens/punctuation. Whitespace remains as the word separator.
  const cleaned = trimmed.replaceAll(/[^A-Z0-9\s]/gi, '');
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);

  const [firstWord] = words;
  if (!firstWord) return '';

  // String.charAt returns '' for empty strings — no narrowing needed and
  // no non-null assertion (each word is non-empty per the filter above,
  // but TypeScript can't prove that on indexed access).
  const derived =
    words.length === 1 ? firstWord.slice(0, 2) : words.map(word => word.charAt(0)).join('');

  return derived.toUpperCase().slice(0, MAX_CODE_LENGTH);
}

/** Whether a persona name passes the minimum-length requirement. */
export function isValidPersonaName(name: string): boolean {
  return name.trim().length >= MIN_NAME_LENGTH;
}

/** Whether a code matches the persona-code pattern. */
export function isValidPersonaCode(code: string): boolean {
  return PERSONA_CODE_PATTERN.test(code);
}
