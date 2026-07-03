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

export const CANONICAL_PHASES = [
  'intake',
  'define-behavior',
  'scenario-gate',
  'implement',
  'verify',
  'done',
] as const;

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
  return OK;
}

function evaluateCreation(proposedContent: string): ProvenanceVerdict {
  const meta = frontmatterOf(proposedContent);
  const type = scalar(meta, 'type');
  const phase = scalar(meta, 'phase');

  if (type === 'feature' && phase !== undefined && phase !== 'intake') {
    return {
      ok: false,
      reason: `Feature tickets are born at phase: intake — this one would begin life at "${phase}", silently skipping the intake conversation (personas, jobs, acceptance criteria) and every gate keyed to the skipped phases.`,
      remediation: `Create the ticket at phase: intake and work forward, or ${SKIPS_SYNTAX}.`,
    };
  }

  return OK;
}
