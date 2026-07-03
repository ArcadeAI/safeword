// Safeword: phase-provenance gate logic (ticket 0KYEBN, #644 G2).
//
// Pure helpers (no I/O) so the pre-tool hook can validate ticket.md writes
// without importing the CLI dist (same cross-runtime-copy rationale as
// jtbd.ts — deployed hooks run standalone from .safeword/hooks/).
//
// The guarantee: a feature ticket's `phase:` is earned, not declared. Feature
// tickets are born at intake and advance one canonical step at a time; any
// deliberate deviation carries a per-phase `phase_skips` justification that
// stays visible in the frontmatter. The gate polices transitions, not
// history — tickets at rest are never re-validated.

import { parseFrontmatter } from './hierarchy.js';
import { isValidSkipReason } from './parse-annotation.js';

export const CANONICAL_PHASES = [
  'intake',
  'define-behavior',
  'scenario-gate',
  'implement',
  'verify',
  'done',
] as const;

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_PHASES);

const CANONICAL_SEQUENCE = CANONICAL_PHASES.join(' → ');

export type ProvenanceVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: ProvenanceVerdict = { ok: true };

/**
 * `phase_skips` convention: block-sequence entries only ("- <phase>: <reason>").
 * Flow-style arrays are deliberately unsupported — the minimal frontmatter
 * parser splits them on commas, which corrupts comma-bearing reasons.
 */
const SKIPS_SYNTAX =
  'record a deliberate skip for each bypassed phase in frontmatter — phase_skips block-sequence entries like "- intake: <reason>", one entry per skipped phase, each with a non-empty reason';

function frontmatterOf(content: string): Record<string, string | string[]> | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const parsed = parseFrontmatter(match[1] ?? '');
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function scalar(
  meta: Record<string, string | string[]> | undefined,
  key: string,
): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Parsed phase_skips: justified phase → reason, plus syntactically bad entries. */
interface ParsedSkips {
  justified: Map<string, string>;
  invalid: string[];
}

function parseSkips(meta: Record<string, string | string[]> | undefined): ParsedSkips {
  const raw = meta?.['phase_skips'];
  const entries = Array.isArray(raw) ? raw : typeof raw === 'string' && raw !== '' ? [raw] : [];
  const justified = new Map<string, string>();
  const invalid: string[] = [];
  for (const entry of entries) {
    const match = /^([^:]+):(.*)$/.exec(entry);
    const phase = match?.[1]?.trim();
    const reason = match?.[2] ?? '';
    if (match === null || phase === undefined || phase === '' || !isValidSkipReason(reason)) {
      invalid.push(entry);
      continue;
    }
    justified.set(phase, reason.trim());
  }
  return { justified, invalid };
}

/**
 * Evaluate a ticket.md write (creation or edit) for phase provenance.
 *
 * @param priorContent  On-disk content before the write; undefined = creation.
 * @param proposedContent  The content the write would produce.
 */
export function evaluateTicketWrite(
  priorContent: string | undefined,
  proposedContent: string,
): ProvenanceVerdict {
  if (priorContent === undefined) {
    return evaluateCreation(proposedContent);
  }
  return evaluateEdit(priorContent, proposedContent);
}

function evaluateCreation(proposedContent: string): ProvenanceVerdict {
  const meta = frontmatterOf(proposedContent);
  if (scalar(meta, 'type') !== 'feature') return OK;
  return evaluateBirth(meta, 'creation');
}

function evaluateEdit(priorContent: string, proposedContent: string): ProvenanceVerdict {
  const prior = frontmatterOf(priorContent);
  const proposed = frontmatterOf(proposedContent);
  // A write that leaves the frontmatter unparseable carries no phase or type
  // to police — at-rest tolerance (corruption integrity is G3/G5 territory).
  if (proposed === undefined) return OK;

  const priorType = scalar(prior, 'type');
  const proposedType = scalar(proposed, 'type');

  // Becoming a feature — from task/patch/epic, no type, or an unparseable
  // prior (frontmatter repair) — counts as a feature birth at the proposed
  // phase: the ticket never traversed the phases as a feature.
  if (proposedType === 'feature' && priorType !== 'feature') {
    return evaluateBirth(proposed, 'flip');
  }

  return OK;
}

/**
 * Birth semantics, shared by creation and type-flip/repair:
 * intake (or no phase) is free; past intake needs a phase_skips entry for
 * every bypassed phase. A non-canonical target is denied at creation; on a
 * flip it is pre-existing state and counts as intake (legacy migration rule).
 */
function evaluateBirth(
  meta: Record<string, string | string[]> | undefined,
  context: 'creation' | 'flip',
): ProvenanceVerdict {
  const phase = scalar(meta, 'phase');
  if (phase === undefined || phase === 'intake') return OK;

  if (!CANONICAL_SET.has(phase)) {
    if (context === 'flip') return OK;
    return {
      ok: false,
      reason: `"${phase}" is not a canonical ticket phase, so no gate keyed to phases would ever fire on this ticket. Canonical phases: ${CANONICAL_SEQUENCE}.`,
      remediation:
        'Create the ticket at phase: intake (or another canonical phase justified via phase_skips) and work forward.',
    };
  }

  const skips = parseSkips(meta);
  if (skips.invalid.length > 0) {
    return {
      ok: false,
      reason: `phase_skips entry ${skips.invalid.map(entry => `"${entry}"`).join(', ')} is not a valid skip — every entry needs the "<phase>: <reason>" shape with a non-empty reason.`,
      remediation: `A skip is an auditable act: ${SKIPS_SYNTAX}.`,
    };
  }

  const missing = CANONICAL_PHASES.slice(0, CANONICAL_PHASES.indexOf(phase as never)).filter(
    bypassed => !skips.justified.has(bypassed),
  );
  if (missing.length > 0) {
    const act = context === 'creation' ? 'begin life' : 'become a feature';
    return {
      ok: false,
      reason: `Feature tickets are born at phase: intake — this write would ${act} at "${phase}" without provenance, silently bypassing every gate keyed to the skipped phases. Phases still needing justification: ${missing.join(', ')}.`,
      remediation: `Start at phase: intake and work forward, or ${SKIPS_SYNTAX}.`,
    };
  }

  return OK;
}
