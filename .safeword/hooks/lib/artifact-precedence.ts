// Safeword: artifact-precedence gate logic (ticket 87Y167, #644 G1).
//
// Pure helpers (no I/O) so the pre-tool hook can enforce authoring order and
// review demands without importing the CLI dist (same cross-runtime-copy
// rationale as jtbd.ts — deployed hooks run standalone from .safeword/hooks/).
//
// The guarantee: a feature's behavior artifacts are earned, not ticked —
// spec.md builds on ticket.md, dimensions.md on a JTBD/AC-complete spec.md,
// scenarios on a reviewed spec, and implementation on independently reviewed
// scenarios. Creation- and transition-scoped: edits to existing artifacts and
// tickets at rest are never re-validated.

import { parseFrontmatter } from './hierarchy.js';
import { evaluateAcGate, evaluateJtbdGate } from './jtbd.js';
import { isValidSkipReason } from './parse-annotation.js';
import { CANONICAL_PHASES } from './phase-provenance.js';
import {
  hashArtifact,
  type ReviewStamp,
  reviewGateForNextAsset,
  reviewScope,
} from './review-ledger.js';

export type PrecedenceVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

const OK: PrecedenceVerdict = { ok: true };

function frontmatterOf(content: string): Record<string, string | string[]> {
  const match = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  return match ? parseFrontmatter(match[1] ?? '') : {};
}

function scalar(meta: Record<string, string | string[]>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export interface SpecCreationInput {
  ticketFileExists: boolean;
}

/** spec.md creation: the ticket anchor must exist first (earliest-first denial). */
export function evaluateSpecCreation(input: SpecCreationInput): PrecedenceVerdict {
  if (input.ticketFileExists) return OK;
  return {
    ok: false,
    reason:
      'Cannot create spec.md before ticket.md exists in this ticket folder — the ticket is the anchor every later artifact builds on. Create ticket.md first.',
    remediation:
      'Run `safeword ticket new <slug>` (or author ticket.md with id/type/phase/status frontmatter), then write spec.md.',
  };
}

export interface DimensionsCreationInput {
  /** ticket.md frontmatter `type`; undefined when absent or unparseable. */
  ticketType: string | undefined;
  /** spec.md content; undefined when the file is missing. */
  specContent: string | undefined;
  personasContent: string;
}

/**
 * dimensions.md creation on a feature: spec.md must exist and pass the JTBD +
 * AC completeness gates (house `skip:` escapes honored by those evaluators).
 * Phase-independent — the canonical creation point is intake (the #404
 * readiness gate demands dimensions.md before define-behavior can be entered).
 */
export function evaluateDimensionsCreation(input: DimensionsCreationInput): PrecedenceVerdict {
  if (input.ticketType !== 'feature') return OK;

  if (input.specContent === undefined) {
    return {
      ok: false,
      reason:
        'Features author spec.md before dimensions.md — the dimension table is derived from the spec, so author spec.md first (Jobs To Be Done + Acceptance Criteria).',
      remediation:
        'Write spec.md with `## Jobs To Be Done` (persona from personas.md, in the "When I…, I want…, so I can…" form) and an Acceptance Criterion per job, then derive dimensions.md from it.',
    };
  }

  const jtbdVerdict = evaluateJtbdGate(input.specContent, input.personasContent);
  if (!jtbdVerdict.ok) {
    return {
      ok: false,
      reason: `spec.md needs a Job To Be Done or a skip reason before dimensions — ${jtbdVerdict.reason}.`,
      remediation:
        'Author a Job To Be Done in spec.md under `## Jobs To Be Done` (or write `skip: <reason>` there), then derive dimensions.md from it.',
    };
  }

  const acVerdict = evaluateAcGate(input.specContent);
  if (!acVerdict.ok) {
    return {
      ok: false,
      reason: `every Job To Be Done needs an Acceptance Criterion or a skip reason before dimensions — ${acVerdict.reason}.`,
      remediation:
        'Add an Acceptance Criterion under each JTBD as `#### <jtbd-id>.AC<n> — <capability>` (or `skip: <reason>` under that JTBD), then derive dimensions.md.',
    };
  }

  return OK;
}

const FEATURE_SOURCE_LINE = /^Feature source:\s*`?([^`\n]+?)`?\s*$/m;

/** The `.feature` path named by the ledger's `Feature source:` line, if any. */
export function resolveScenarioSource(ledgerContent: string): string | undefined {
  const path = FEATURE_SOURCE_LINE.exec(ledgerContent)?.[1]?.trim();
  return path !== undefined && path !== '' ? path : undefined;
}

/** Whether the proposed frontmatter carries a valid phase_skips entry for `phase`. */
function hasJustifiedSkipFor(meta: Record<string, string | string[]>, phase: string): boolean {
  const raw = meta['phase_skips'];
  const entries = Array.isArray(raw) ? raw : typeof raw === 'string' && raw !== '' ? [raw] : [];
  return entries.some(entry => {
    const match = /^([^:]+):(.*)$/.exec(entry);
    return match?.[1]?.trim() === phase && isValidSkipReason(match[2] ?? '');
  });
}

export interface ImplementEntryInput {
  priorTicketContent: string;
  proposedTicketContent: string;
  /** Ticket folder name — the review-stamp scope qualifier. */
  ticketFolder: string;
  /** test-definitions.md content; undefined when the file is missing. */
  ledgerContent: string | undefined;
  /** Reads the named feature source relative to the project; undefined when unreadable. */
  resolveSourceContent: (relativePath: string) => string | undefined;
  stamps: readonly ReviewStamp[];
}

/**
 * Forward advance of a feature ticket into `implement` requires an independent
 * review stamp for the scenarios at their current content — bound to the
 * `.feature` source when the ledger names one, else to the ledger itself
 * (ticket-qualified via reviewScope, so foreign stamps never satisfy). The
 * G2 hatch composes: a phase_skips justification covering scenario-gate
 * specifically is the auditable skip. Backward moves (including verify →
 * implement rework), non-implement advances, phase-unchanged edits, and
 * non-feature tickets are never gated.
 */
export function evaluateImplementEntry(input: ImplementEntryInput): PrecedenceVerdict {
  const proposed = frontmatterOf(input.proposedTicketContent);
  if (scalar(proposed, 'type') !== 'feature') return OK;

  const proposedPhase = scalar(proposed, 'phase');
  const priorPhase = scalar(frontmatterOf(input.priorTicketContent), 'phase');
  if (proposedPhase !== 'implement' || priorPhase === 'implement') return OK;

  // Forward-only: an unknown or absent prior phase counts as intake (the G2
  // legacy-migration rule); a prior at or past implement means rework.
  const phases = CANONICAL_PHASES as readonly string[];
  const implementIndex = phases.indexOf('implement');
  const priorIndex =
    priorPhase !== undefined && phases.includes(priorPhase) ? phases.indexOf(priorPhase) : 0;
  if (priorIndex >= implementIndex) return OK;

  // The G2 hatch: a justified scenario-gate skip is the auditable waiver —
  // it must cover scenario-gate specifically, not just any phase.
  if (hasJustifiedSkipFor(proposed, 'scenario-gate')) return OK;

  if (input.ledgerContent === undefined) {
    return {
      ok: false,
      reason:
        'Advancing into implement requires scenarios first — this ticket has no test-definitions.md. Author the scenarios (features/<slug>.feature + the R/G/R ledger), have them independently reviewed, then advance.',
      remediation:
        'Create test-definitions.md (and its feature source) at define-behavior, pass the scenario-gate review, then retry the phase change.',
    };
  }

  const sourcePath = resolveScenarioSource(input.ledgerContent);
  const sourceContent =
    sourcePath === undefined ? undefined : input.resolveSourceContent(sourcePath);
  const reviewedContent = sourceContent ?? input.ledgerContent;
  const scope = reviewScope(input.ticketFolder, 'scenarios', hashArtifact(reviewedContent));
  if (reviewGateForNextAsset(scope, input.stamps).ok) return OK;

  return {
    ok: false,
    reason:
      "The scenarios need an independent review at their current content before implement — no matching review stamp exists (a review is invalidated when the scenarios change after it, and another ticket's review never counts).",
    remediation:
      'Run /review-spec via a fresh-context reviewer, then `bun .safeword/hooks/write-review-stamp.ts scenarios` on pass (or add `--skip "<reason>"` for an auditable skip, or record a phase_skips justification for scenario-gate).',
  };
}
