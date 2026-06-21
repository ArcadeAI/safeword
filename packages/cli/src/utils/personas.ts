/**
 * Persona file model — derivation, parsing, validation, and lookup.
 *
 * Project-level personas live at the resolved namespace root as
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

import { readFileSync } from 'node:fs';

import { resolveConfiguredPath } from './configured-paths.js';
import { computeSkipMask, stripInlineComments } from './markdown-sections.js';
import { findDuplicates, groupByLine } from './validation.js';

// The three constants below are exported for workspace-internal use (tests
// asserting the canonical bounds, docs referencing them without hardcoding,
// future code in the same package). They are deliberately NOT re-exported
// from `src/presets/typescript/index.ts` — customers interact with persona
// validation through `safeword check`, not by reading these constants
// directly. Promoting them to safeword's public preset surface would make
// the values part of safeword's semver contract (changing 6 → 8 would
// become a breaking change), and there's no current consumer that needs
// that commitment.

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

/**
 * A parsed persona block — name, code (possibly empty before resolution),
 * line number of the header (1-indexed), and whether the user explicitly
 * authored the code via `## Name (CODE)` syntax.
 */
export interface ParsedPersona {
  name: string;
  /** Empty string when no code was authored (will be filled by {@link resolvePersonaCodes}). */
  rawCode: string;
  /** True when the code came from `## Name (CODE)` syntax; false when absent in source. */
  explicit: boolean;
  /** 1-indexed line number of the `## ` header. */
  lineNumber: number;
  /** Whether a `**Role:**` line was found in the block body. */
  hasRole: boolean;
}

/** A resolved persona — code is always populated (derived if not explicit). */
export interface ResolvedPersona extends ParsedPersona {
  code: string;
}

/** A validation error with a 1-indexed line reference into the source content. */
export interface PersonaValidationError {
  line: number;
  message: string;
}

/**
 * Extract name and (optional) code from a `## ...` header line.
 *
 * Parsed manually rather than with regex to avoid super-linear-backtracking
 * vulnerabilities flagged by `regexp/no-super-linear-backtracking`. The
 * `(CODE)` suffix is detected by checking for a trailing `)` and locating
 * its matching `(` via `lastIndexOf` — no quantifier overlap. Inline HTML
 * comments are stripped from the body before name/code extraction so a
 * trailing `<!-- ... -->` doesn't corrupt the parsed name.
 */
function parseHeaderLine(line: string): { name: string; rawCode: string | undefined } | undefined {
  if (!line.startsWith('## ')) return undefined;
  const body = stripInlineComments(line.slice(3)).trimEnd();
  if (body.endsWith(')')) {
    const openParen = body.lastIndexOf('(');
    if (openParen !== -1) {
      const namePart = body.slice(0, openParen).trim();
      const codePart = body.slice(openParen + 1, -1).trim();
      return { name: namePart, rawCode: codePart };
    }
  }
  return { name: body.trim(), rawCode: undefined };
}

/**
 * Parse persona blocks from markdown content.
 *
 * A block starts at a level-2 header (`## ...`) and runs until the next
 * level-2 header or end of file. The header may include a parenthesized
 * code (`## Name (PO)`) or omit it (`## Name`). The body is scanned for
 * a `**Role:**` line; presence is recorded but the role text isn't
 * extracted here (validation only needs the existence check).
 *
 * Pure — no I/O.
 */
export function parsePersonas(content: string): ParsedPersona[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const personas: ParsedPersona[] = [];
  let current: ParsedPersona | undefined;

  for (const [index, line] of lines.entries()) {
    if (skip[index] === true) continue;
    const header = parseHeaderLine(line);
    if (header) {
      if (current) personas.push(current);
      current = {
        name: header.name,
        rawCode: header.rawCode ?? '',
        explicit: header.rawCode !== undefined,
        lineNumber: index + 1,
        hasRole: false,
      };
      continue;
    }
    if (current && line.startsWith('**Role:**')) {
      current.hasRole = true;
    }
  }

  if (current) personas.push(current);
  return personas;
}

/**
 * Resolve auto-derived codes with collision avoidance.
 *
 * For each persona without an explicit code, derive one from the name.
 * If the derived code is already taken (by a user-authored explicit code
 * or a previously-resolved derivation in the same pass), append a numeric
 * suffix starting at 2 (`PO` → `PO2` → `PO3` → ...).
 *
 * Explicit codes are claimed up-front so derived codes always lose
 * collision disputes against user-authored ones.
 */
export function resolvePersonaCodes(parsed: readonly ParsedPersona[]): ResolvedPersona[] {
  const claimed = new Set<string>();
  for (const persona of parsed) {
    if (persona.explicit && persona.rawCode.length > 0) {
      claimed.add(persona.rawCode);
    }
  }

  const resolved: ResolvedPersona[] = [];
  for (const persona of parsed) {
    if (persona.explicit) {
      resolved.push({ ...persona, code: persona.rawCode });
      continue;
    }
    const base = derivePersonaCode(persona.name);
    let candidate = base;
    let suffix = 2;
    while (claimed.has(candidate)) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
    claimed.add(candidate);
    resolved.push({ ...persona, code: candidate });
  }

  return resolved;
}

/**
 * Validate parsed personas. Returns a list of {@link PersonaValidationError}
 * with 1-indexed line numbers; empty list means the file is well-formed.
 *
 * Checks (each independent):
 * - Persona name is ≥ {@link MIN_NAME_LENGTH} characters
 * - Header has a name (not just `## (CODE)`)
 * - Block has a `**Role:**` line
 * - Persona names are unique within the file
 * - Resolved codes are unique within the file
 * - Resolved codes match {@link PERSONA_CODE_PATTERN}
 *   (digit-first names like "3 Amigos" derive non-conformant codes and
 *   surface here with the explicit-override prompt)
 */
function validateNameAndRole(persona: ParsedPersona): PersonaValidationError[] {
  const errors: PersonaValidationError[] = [];
  if (persona.name.length === 0) {
    errors.push({ line: persona.lineNumber, message: 'missing persona name' });
  } else if (!isValidPersonaName(persona.name)) {
    errors.push({
      line: persona.lineNumber,
      message: 'persona name must be at least 2 characters',
    });
  }
  if (!persona.hasRole) {
    errors.push({ line: persona.lineNumber, message: 'missing Role line' });
  }
  return errors;
}

/** Produce pattern-violation errors for resolved personas. */
function findPatternErrors(resolved: readonly ResolvedPersona[]): PersonaValidationError[] {
  const errors: PersonaValidationError[] = [];
  for (const persona of resolved) {
    if (persona.code.length === 0) continue;
    if (isValidPersonaCode(persona.code)) continue;
    const message = persona.explicit
      ? `code "${persona.code}" violates pattern ${PERSONA_CODE_PATTERN.source}`
      : `name produces non-conformant code "${persona.code}" — author explicit code via \`## Name (CODE)\``;
    errors.push({ line: persona.lineNumber, message });
  }
  return errors;
}

export function validatePersonas(parsed: readonly ParsedPersona[]): PersonaValidationError[] {
  const resolved = resolvePersonaCodes(parsed);
  return [
    ...parsed.flatMap(persona => validateNameAndRole(persona)),
    ...findDuplicates(
      groupByLine(parsed, persona => persona.name),
      'persona name',
    ),
    ...findPatternErrors(resolved),
    ...findDuplicates(
      groupByLine(resolved, persona => persona.code),
      'persona code',
    ),
  ];
}

/**
 * Result of resolving a persona reference against the file.
 *
 * Discriminated union — `match` is guaranteed when `status === 'valid'`;
 * `suggestion` is only meaningful (and only ever populated) when
 * `status === 'unknown'`. Callers can narrow without optional chaining
 * after checking `status`.
 */
export type PersonaReferenceResult =
  | { status: 'valid'; match: ResolvedPersona }
  | { status: 'unknown'; suggestion?: string };

/**
 * Look up a persona reference against a parsed-and-resolved list.
 *
 * Strict on casing: `"po"` against existing `PO` returns
 * `{ status: 'unknown', suggestion: 'PO' }`. Lenient matching would
 * silently alias persona codes that legitimately differ by case
 * (`PO` vs `Po` vs `PO2`).
 *
 * Match priority: exact code → exact name → casing-mismatch suggestion.
 *
 * Pure — no I/O. Wrap with {@link validatePersonaReference} for the file-reading
 * path.
 */
export function lookupPersonaReference(
  personas: readonly ResolvedPersona[],
  input: string,
): PersonaReferenceResult {
  if (input.length === 0) return { status: 'unknown' };

  for (const persona of personas) {
    if (persona.code === input || persona.name === input) {
      return { status: 'valid', match: persona };
    }
  }

  // Casing-mismatch detection — search again with lowercase comparison.
  const lowered = input.toLowerCase();
  for (const persona of personas) {
    if (persona.code.toLowerCase() === lowered) {
      return { status: 'unknown', suggestion: persona.code };
    }
    if (persona.name.toLowerCase() === lowered) {
      return { status: 'unknown', suggestion: persona.name };
    }
  }

  return { status: 'unknown' };
}

/**
 * Resolve a persona reference against the on-disk personas file.
 *
 * Reads from `paths.personas` in `.safeword/config.json` when configured;
 * falls back to the namespace-root default otherwise. Degrades
 * gracefully on a missing or unreadable file — returns
 * `{ status: 'unknown' }` rather than throwing, regardless of whether the
 * resolved path is the default or a configured override. Strict
 * validation lives in `safeword check`; this lookup API is meant to be
 * cheap, consistent, and side-effect-free. Do NOT change the unknown
 * return to a throw for configured-but-missing — `safeword check` owns
 * the loud signal (ticket K7N2QM).
 */
export function validatePersonaReference(cwd: string, input: string): PersonaReferenceResult {
  let content: string;
  try {
    const filePath = resolveConfiguredPath(cwd, 'personas');
    content = readFileSync(filePath, 'utf8');
  } catch {
    return { status: 'unknown' };
  }
  const personas = resolvePersonaCodes(parsePersonas(content));
  return lookupPersonaReference(personas, input);
}
