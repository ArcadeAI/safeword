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

const HEADER_PATTERN = /^##\s+(.*?)(?:\s*\(([^)]*)\))?\s*$/;
const ROLE_PATTERN = /^\*\*Role:\*\*/;

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
  const personas: ParsedPersona[] = [];
  let current: ParsedPersona | undefined;

  for (const [index, line] of lines.entries()) {
    if (line.startsWith('## ')) {
      const match = HEADER_PATTERN.exec(line);
      if (match) {
        if (current) personas.push(current);
        const [, rawName = '', rawCode] = match;
        current = {
          name: rawName.trim(),
          rawCode: (rawCode ?? '').trim(),
          explicit: rawCode !== undefined,
          lineNumber: index + 1,
          hasRole: false,
        };
        continue;
      }
    }

    if (current && ROLE_PATTERN.test(line)) {
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
export function validatePersonas(parsed: readonly ParsedPersona[]): PersonaValidationError[] {
  const errors: PersonaValidationError[] = [];

  // Headerless / empty-name detection runs against the raw parsed list.
  for (const persona of parsed) {
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
  }

  // Duplicate-name check.
  const namesByLine = new Map<string, number[]>();
  for (const persona of parsed) {
    if (persona.name.length === 0) continue;
    const existing = namesByLine.get(persona.name) ?? [];
    existing.push(persona.lineNumber);
    namesByLine.set(persona.name, existing);
  }
  for (const [name, lines] of namesByLine.entries()) {
    if (lines.length > 1) {
      for (const line of lines) {
        const others = lines.filter(other => other !== line).join(', ');
        errors.push({ line, message: `duplicate persona name "${name}" (also at line ${others})` });
      }
    }
  }

  // Code validity + collision require resolution.
  const resolved = resolvePersonaCodes(parsed);

  // Pattern enforcement.
  for (const persona of resolved) {
    if (persona.code.length === 0) continue;
    if (!isValidPersonaCode(persona.code)) {
      const message = persona.explicit
        ? `code "${persona.code}" violates pattern ${PERSONA_CODE_PATTERN.source}`
        : `name produces non-conformant code "${persona.code}" — author explicit code via \`## Name (CODE)\``;
      errors.push({ line: persona.lineNumber, message });
    }
  }

  // Duplicate-code check across resolved set.
  const codesByLine = new Map<string, number[]>();
  for (const persona of resolved) {
    if (persona.code.length === 0) continue;
    const existing = codesByLine.get(persona.code) ?? [];
    existing.push(persona.lineNumber);
    codesByLine.set(persona.code, existing);
  }
  for (const [code, lines] of codesByLine.entries()) {
    if (lines.length > 1) {
      for (const line of lines) {
        const others = lines.filter(other => other !== line).join(', ');
        errors.push({ line, message: `duplicate persona code "${code}" (also at line ${others})` });
      }
    }
  }

  return errors;
}
