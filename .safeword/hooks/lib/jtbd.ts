// Safeword: JTBD (Jobs To Be Done) parsing + intake-exit gate (ticket Y2HCNJ).
//
// Pure helpers (no I/O) so the pre-tool quality hook can evaluate a ticket's
// spec.md against personas.md without importing the CLI's persona utilities
// (those live in the published dist, not in the deployed .safeword/hooks/).
//
// This re-implements the `## `-block + HTML-comment-skip parsing that the
// CLI now centralizes in src/utils/markdown-sections.ts (ticket WQ4RH3). It is
// a deliberate cross-runtime copy, NOT deferred work: deployed hooks run
// standalone from .safeword/hooks/ and cannot import the CLI dist, so the
// src-side unification intentionally stops at the hook boundary.

const JTBD_HEADING = 'jobs to be done';
const PERSONA_PREFIX = '**Persona:**';
const SKIP_PREFIX = 'skip:';
/** Max newly derived persona-code length — mirrors the CLI canonical bound. */
const MAX_CODE_LENGTH = 4;
/**
 * A level-4 heading only counts toward the AC gate when it carries a real
 * lineage id — `<jtbd>.AC<n>` or `<jtbd>.R<n>` (#696). Without this, any
 * `#### <heading>` (e.g. `#### Notes`) vacuously satisfied the "≥1 AC per JTBD"
 * requirement. Matches the id token wherever it sits in the heading text.
 */
const AC_OR_RULE_HEADING = /(?:^|\.)(?:AC|R)\d+\b/i;

export interface JtbdEntry {
  /** The raw `**Persona:**` reference (name, code, or `Name (CODE)`); may be empty. */
  persona: string;
  /** 1-indexed line within the full spec content. */
  lineNumber: number;
}

export interface JtbdSection {
  entries: JtbdEntry[];
  /** The `skip:` reason if present (possibly empty string); `null` when absent. */
  skip: string | null;
}

export type JtbdGateVerdict = { ok: true } | { ok: false; reason: string };

interface PersonaReferenceResolution {
  references: Set<string>;
  collisionExhaustedFor: string[];
}

/**
 * Parse the `## Jobs To Be Done` section of a spec.md. Content inside HTML
 * comments is ignored (the scaffolded template's worked example is commented,
 * so a fresh spec parses to zero entries). Lenient on surrounding prose.
 */
export function parseJtbdSection(specContent: string): JtbdSection {
  const entries: JtbdEntry[] = [];
  let skip: string | null = null;
  let seenJtbd = false;
  let inSection = false;

  for (const { index, text: trimmed } of activeLines(specContent)) {
    const heading = parseSectionHeading(trimmed);
    if (heading !== null) {
      inSection = heading.toLowerCase() === JTBD_HEADING;
      continue;
    }
    if (!inSection) continue;

    // A `###` (or deeper) heading opens a JTBD block. Past the first one, a
    // `skip:` line is a per-JTBD AC skip (ticket 31W8M3) — NOT the section-level
    // skip — so it must not short-circuit JTBD persona resolution.
    const sub = parseAnyHeading(trimmed);
    if (sub !== null && sub.level >= 3) {
      if (sub.level === 3) seenJtbd = true;
      continue;
    }

    if (skip === null && !seenJtbd && trimmed.toLowerCase().startsWith(SKIP_PREFIX)) {
      skip = trimmed.slice(SKIP_PREFIX.length).trim();
      continue;
    }
    if (trimmed.startsWith(PERSONA_PREFIX)) {
      entries.push({
        persona: trimmed.slice(PERSONA_PREFIX.length).trim(),
        lineNumber: index + 1,
      });
    }
  }

  return { entries, skip };
}

/** Add a persona code and its combined `Name (code)` form to the ref set. */
function addCodeForms(references: Set<string>, name: string, code: string): void {
  references.add(code);
  references.add(`${name} (${code})`);
}

/** Allocate a deterministic collision suffix without exceeding four characters. */
function allocateDerivedCode(base: string, claimed: ReadonlySet<string>): string | undefined {
  if (!claimed.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = String(suffix);
    const prefixLength = MAX_CODE_LENGTH - suffixText.length;
    if (prefixLength < 1) return undefined;
    const candidate = `${base.slice(0, prefixLength)}${suffixText}`;
    if (!claimed.has(candidate)) return candidate;
  }
}

/**
 * The set of persona references a JTBD may resolve against. Each `## Name` or
 * `## Name (CODE)` header contributes the name, its short code — the explicit
 * `(CODE)` when present AND the auto-derived code (`Platform Operator` → `PLO`,
 * matching the CLI's `derivePersonaCode` and DISCOVERY.md's "codes auto-derive"
 * promise) — plus the combined `Name (code)` forms. Without the derived code a
 * bare-named persona would falsely block a JTBD that references its code.
 * Exact-string membership; the richer case-suggestion contract stays in the
 * agent/authoring path. Empty/unreadable content yields an empty set.
 */
function resolvePersonaRefs(personasContent: string): PersonaReferenceResolution {
  const references = new Set<string>();
  const collisionExhaustedFor: string[] = [];
  const personas: { name: string; code?: string }[] = [];

  for (const { text } of activeLines(personasContent)) {
    const heading = parseSectionHeading(text);
    if (heading === null) continue;

    const parsed = splitNameAndCode(heading);
    if (parsed.name === '') continue;
    personas.push(parsed);
  }

  const claimed = new Set<string>();
  for (const persona of personas) {
    if (persona.code !== undefined) claimed.add(persona.code);
  }

  for (const persona of personas) {
    references.add(persona.name);

    const derived = derivePersonaCode(persona.name);
    if (derived !== '') {
      const candidate = allocateDerivedCode(derived, claimed);
      if (candidate !== undefined) {
        claimed.add(candidate);
        addCodeForms(references, persona.name, candidate);
      } else {
        collisionExhaustedFor.push(persona.name);
      }
    }
    const legacy = deriveLegacyPersonaCode(persona.name);
    if (legacy !== '' && legacy !== derived) addCodeForms(references, persona.name, legacy);
    if (persona.code !== undefined) addCodeForms(references, persona.name, persona.code);
  }

  return { references, collisionExhaustedFor };
}

export function knownPersonaRefs(personasContent: string): Set<string> {
  return resolvePersonaRefs(personasContent).references;
}

/**
 * Gate decision for the intake-exit transition. Passes on a non-empty `skip:`
 * reason, or on ≥1 JTBD whose persona resolves. Denies on an empty skip reason,
 * zero JTBDs, or a JTBD naming a persona absent from personas.md.
 */
export function evaluateJtbdGate(specContent: string, personasContent: string): JtbdGateVerdict {
  const { entries, skip } = parseJtbdSection(specContent);

  if (skip !== null) {
    if (skip === '') {
      return {
        ok: false,
        reason: 'the `skip:` line in the Jobs To Be Done section has no reason after the colon',
      };
    }
    return { ok: true };
  }

  if (entries.length === 0) {
    return {
      ok: false,
      reason:
        'spec.md has no Jobs To Be Done — add ≥1 JTBD with a persona, or write `skip: <reason>`',
    };
  }

  const resolution = resolvePersonaRefs(personasContent);
  const exhausted = resolution.collisionExhaustedFor[0];
  if (exhausted !== undefined) {
    return {
      ok: false,
      reason: `canonical persona-code collision space exhausted for "${exhausted}" — author an explicit 3–4 letter code in personas.md`,
    };
  }

  const known = resolution.references;
  const unresolved = entries.find(entry => !known.has(entry.persona));
  if (unresolved !== undefined) {
    const named = unresolved.persona === '' ? '(empty)' : `"${unresolved.persona}"`;
    return {
      ok: false,
      reason: `JTBD persona ${named} is not declared in personas.md`,
    };
  }

  return { ok: true };
}

interface JtbdCriteriaBlock {
  /** The `### ` JTBD heading text (e.g. `demo.PO1 — rotate keys`). */
  heading: string;
  /** Count of qualifying `#### ` criteria headings — AC or numbered Rule — under this JTBD (HTML-commented ones excluded). */
  criteriaCount: number;
  /** The per-JTBD criteria `skip:` reason if present (possibly empty); `null` when absent. */
  skip: string | null;
}

/**
 * Parse the criteria — Acceptance Criteria or numbered Rules — under each JTBD in
 * a spec.md (ticket 31W8M3). Walks the `## Jobs To Be Done` section: each `### `
 * heading opens a JTBD block, each lineage-tagged `#### ` heading inside it is a
 * criterion, and a `skip:` line is the block's criteria-skip (or the
 * section-level skip if it appears before any `### `). HTML-commented content is
 * stripped first, so the template's commented example never counts.
 */
function parseCriteriaByJtbd(specContent: string): {
  sectionSkip: string | null;
  jtbds: JtbdCriteriaBlock[];
} {
  const jtbds: JtbdCriteriaBlock[] = [];
  let sectionSkip: string | null = null;
  let inSection = false;
  let current: JtbdCriteriaBlock | null = null;

  function flush(): void {
    if (current !== null) {
      jtbds.push(current);
      current = null;
    }
  }

  for (const { text: trimmed } of activeLines(specContent)) {
    const heading = parseAnyHeading(trimmed);
    if (heading !== null) {
      if (heading.level <= 2) {
        flush();
        inSection = heading.text.toLowerCase() === JTBD_HEADING;
      } else if (inSection && heading.level === 3) {
        flush();
        current = { heading: heading.text, criteriaCount: 0, skip: null };
      } else if (
        inSection &&
        heading.level >= 4 &&
        current !== null &&
        AC_OR_RULE_HEADING.test(heading.text)
      ) {
        current.criteriaCount++;
      }
      continue;
    }

    if (!inSection) continue;
    if (trimmed.toLowerCase().startsWith(SKIP_PREFIX)) {
      const reason = trimmed.slice(SKIP_PREFIX.length).trim();
      if (current !== null) {
        if (current.skip === null) current.skip = reason;
      } else if (sectionSkip === null) {
        sectionSkip = reason;
      }
    }
  }
  flush();

  return { sectionSkip, jtbds };
}

/**
 * Criteria gate (ticket 31W8M3). Requires ≥1 numbered Rule or Acceptance
 * Criterion under each JTBD block, honoring a
 * per-JTBD `skip: <non-empty reason>` valve. Vacuously passes when there are no
 * JTBD blocks (whole-section skip, or no JTBDs) — the JTBD gate owns that case.
 */
export function evaluateCriteriaGate(specContent: string): JtbdGateVerdict {
  const { jtbds } = parseCriteriaByJtbd(specContent);

  for (const block of jtbds) {
    if (block.skip !== null) {
      if (block.skip === '') {
        return {
          ok: false,
          reason: `the AC \`skip:\` under JTBD "${block.heading}" has no reason after the colon`,
        };
      }
      continue;
    }
    if (block.criteriaCount === 0) {
      return {
        ok: false,
        reason: `JTBD "${block.heading}" has no numbered rules or acceptance criteria — add ≥1 \`#### <id>.R<n>\`, ≥1 \`#### <id>.AC<n>\`, or \`skip: <reason>\``,
      };
    }
  }

  return { ok: true };
}

// The two functions below are the hook-side mirror of the CLI's
// `src/utils/markdown-sections.ts` (computeSkipMask + stripInlineComments).
// They cannot share a module — deployed hooks run standalone from
// `.safeword/hooks/` and can't import the CLI's dist. The differential test
// `tests/hooks/parser-parity.test.ts` pins this copy to the CLI so the two
// can't drift (ticket P58R22). Keep them byte-for-byte equivalent to the CLI.

/**
 * Per-line skip mask: `true` where a line is inside a triple-backtick code
 * fence or a block-level HTML comment (`<!-- … -->`). Per CommonMark, only a
 * line that BEGINS with `<!--` (after optional indent) opens a block comment;
 * a fence line toggles fence state and is itself skipped.
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

/** Strip inline `<!-- … -->` comments from a single line (block comments are
 * handled by computeSkipMask). An unclosed inline comment leaves the rest as-is. */
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
 * Split content into lines, skip code-fence and block-comment lines, strip
 * inline comments from the rest, and return each non-empty line with its
 * 0-based index. The single line-walk shared by the section parsers above —
 * the hook-side mirror of the CLI's `markdown-sections.ts` (WQ4RH3 / P58R22).
 */
export function activeLines(content: string): { index: number; text: string }[] {
  const lines = content.split('\n');
  const skip = computeSkipMask(lines);
  const out: { index: number; text: string }[] = [];
  for (const [index, line] of lines.entries()) {
    if (skip[index]) continue;
    const text = stripInlineComments(line).trim();
    if (text !== '') out.push({ index, text });
  }
  return out;
}

/** Any ATX heading → `{ level, text }`; null for non-heading lines. */
function parseAnyHeading(trimmed: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (match === null) return null;
  return { level: (match[1] ?? '').length, text: (match[2] ?? '').trim() };
}

/** `## Heading` → `Heading`; returns null for non-`##` lines (incl. `###`, `#`). */
function parseSectionHeading(trimmed: string): string | null {
  if (!trimmed.startsWith('## ')) return null;
  const rest = trimmed.slice(3).trim();
  if (rest.startsWith('#')) return null;
  return rest;
}

/**
 * Derive a short code from a persona name — a deliberate cross-runtime copy of
 * the CLI's `derivePersonaCode` (src/utils/personas.ts), since deployed hooks
 * can't import the CLI dist. Single-word → first 3 chars; two-word → first 2
 * chars plus the second initial; 3+ words → first 4 initials. Apostrophes are
 * removed within words, other punctuation separates words, and digits remain.
 * The gate is a lenient backstop — it does NOT apply the CLI's collision
 * suffixes (PO → PO2), so a derived code resolves to any persona deriving it.
 * Kept in agreement with the CLI by tests (see ticket P58R22).
 */
function derivePersonaCode(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  const withoutApostrophes = trimmed.replaceAll(/['’]/g, '');
  const cleaned = withoutApostrophes.replaceAll(/[^A-Z0-9\s]/gi, ' ');
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);

  const [firstWord] = words;
  if (!firstWord) return '';

  let derived: string;
  if (words.length === 1) {
    derived = firstWord.slice(0, 3);
  } else if (words.length === 2) {
    derived = `${firstWord.slice(0, 2)}${words[1]?.charAt(0) ?? ''}`;
  } else {
    derived = words.map(word => word.charAt(0)).join('');
  }

  return derived.toUpperCase().slice(0, MAX_CODE_LENGTH);
}

/** Preserve references authored under safeword's former 2–6 character derivation. */
function deriveLegacyPersonaCode(name: string): string {
  const cleaned = name.trim().replaceAll(/[^A-Z0-9\s]/gi, '');
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);
  const [firstWord] = words;
  if (!firstWord) return '';

  const derived =
    words.length === 1 ? firstWord.slice(0, 2) : words.map(word => word.charAt(0)).join('');
  return derived.toUpperCase().slice(0, MAX_CODE_LENGTH);
}

/** `Platform Operator (PO)` → { name, code }; bare names → { name }. */
function splitNameAndCode(heading: string): { name: string; code?: string } {
  if (heading.endsWith(')')) {
    const open = heading.lastIndexOf('(');
    if (open !== -1) {
      const code = heading.slice(open + 1, -1).trim();
      const name = heading.slice(0, open).trim();
      if (code !== '') return { name, code };
    }
  }
  return { name: heading.trim() };
}
