// Safeword: JTBD (Jobs To Be Done) parsing + intake-exit gate (ticket Y2HCNJ).
//
// Pure helpers (no I/O) so the pre-tool quality hook can evaluate a ticket's
// spec.md against personas.md without importing the CLI's persona utilities
// (those live in the published dist, not in the deployed .safeword/hooks/).
//
// This mirrors the `## `-block + HTML-comment-skip parsing that
// src/utils/personas.ts and src/utils/glossary.ts already do — the 3rd
// consumer of that pattern. Per epic DZ2NM5's deferred-refactor decision the
// shared extraction belongs to M6D315; here it is mirrored in place.

const JTBD_HEADING = 'jobs to be done';
const PERSONA_PREFIX = '**Persona:**';
const SKIP_PREFIX = 'skip:';

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

/**
 * Parse the `## Jobs To Be Done` section of a spec.md. Content inside HTML
 * comments is ignored (the scaffolded template's worked example is commented,
 * so a fresh spec parses to zero entries). Lenient on surrounding prose.
 */
export function parseJtbdSection(specContent: string): JtbdSection {
  const lines = specContent.split('\n');
  const entries: JtbdEntry[] = [];
  let skip: string | null = null;
  let seenJtbd = false;
  let inSection = false;
  let inComment = false;

  for (let index = 0; index < lines.length; index++) {
    const result = stripComment(lines[index] ?? '', inComment);
    inComment = result.inComment;
    const trimmed = result.text.trim();
    if (trimmed === '') continue;

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

/**
 * The set of persona references a JTBD may resolve against: each `## Name (CODE)`
 * header contributes the name, the code, and the combined `Name (CODE)` form.
 * Exact-string membership — the richer case-suggestion contract stays in the
 * agent/authoring path. Empty/unreadable content yields an empty set.
 */
export function knownPersonaRefs(personasContent: string): Set<string> {
  const refs = new Set<string>();
  let inComment = false;

  for (const raw of personasContent.split('\n')) {
    const result = stripComment(raw, inComment);
    inComment = result.inComment;
    const heading = parseSectionHeading(result.text.trim());
    if (heading === null) continue;

    const parsed = splitNameAndCode(heading);
    if (parsed.name === '') continue;
    refs.add(parsed.name);
    if (parsed.code !== undefined) {
      refs.add(parsed.code);
      refs.add(`${parsed.name} (${parsed.code})`);
    }
  }

  return refs;
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

  const known = knownPersonaRefs(personasContent);
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

interface JtbdAcBlock {
  /** The `### ` JTBD heading text (e.g. `demo.PO1 — rotate keys`). */
  heading: string;
  /** Count of `#### ` AC headings under this JTBD (HTML-commented ones excluded). */
  acCount: number;
  /** The per-JTBD AC `skip:` reason if present (possibly empty); `null` when absent. */
  skip: string | null;
}

/**
 * Parse Acceptance Criteria under each JTBD in a spec.md (ticket 31W8M3). Walks
 * the `## Jobs To Be Done` section: each `### ` heading opens a JTBD block, each
 * `#### ` heading inside it is an AC, and a `skip:` line is the block's AC-skip
 * (or the section-level skip if it appears before any `### `). HTML-commented
 * content is stripped first, so the template's commented example never counts.
 */
function parseAcsByJtbd(specContent: string): {
  sectionSkip: string | null;
  jtbds: JtbdAcBlock[];
} {
  const lines = specContent.split('\n');
  const jtbds: JtbdAcBlock[] = [];
  let sectionSkip: string | null = null;
  let inSection = false;
  let inComment = false;
  let current: JtbdAcBlock | null = null;

  function flush(): void {
    if (current !== null) {
      jtbds.push(current);
      current = null;
    }
  }

  for (const raw of lines) {
    const result = stripComment(raw, inComment);
    inComment = result.inComment;
    const trimmed = result.text.trim();
    if (trimmed === '') continue;

    const heading = parseAnyHeading(trimmed);
    if (heading !== null) {
      if (heading.level <= 2) {
        flush();
        inSection = heading.text.toLowerCase() === JTBD_HEADING;
      } else if (inSection && heading.level === 3) {
        flush();
        current = { heading: heading.text, acCount: 0, skip: null };
      } else if (inSection && heading.level >= 4 && current !== null) {
        current.acCount++;
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
 * AC gate (ticket 31W8M3). Requires ≥1 AC under each JTBD block, honoring a
 * per-JTBD `skip: <non-empty reason>` valve. Vacuously passes when there are no
 * JTBD blocks (whole-section skip, or no JTBDs) — the JTBD gate owns that case.
 */
export function evaluateAcGate(specContent: string): JtbdGateVerdict {
  const { jtbds } = parseAcsByJtbd(specContent);

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
    if (block.acCount === 0) {
      return {
        ok: false,
        reason: `JTBD "${block.heading}" has no acceptance criteria — add ≥1 \`#### <id>.AC<n>\` or \`skip: <reason>\``,
      };
    }
  }

  return { ok: true };
}

/** Returns the active (non-commented) portion of a line and the comment state after it. */
function stripComment(line: string, inComment: boolean): { text: string; inComment: boolean } {
  let text = line;
  let active = '';

  if (inComment) {
    const close = text.indexOf('-->');
    if (close === -1) return { text: '', inComment: true };
    text = text.slice(close + 3);
  }

  for (;;) {
    const open = text.indexOf('<!--');
    if (open === -1) {
      active += text;
      return { text: active, inComment: false };
    }
    active += text.slice(0, open);
    const close = text.indexOf('-->', open + 4);
    if (close === -1) return { text: active, inComment: true };
    text = text.slice(close + 3);
  }
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
