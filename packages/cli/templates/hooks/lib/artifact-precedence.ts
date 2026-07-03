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

export type PrecedenceVerdict = { ok: true } | { ok: false; reason: string; remediation: string };

export interface SpecCreationInput {
  ticketFileExists: boolean;
}

export function evaluateSpecCreation(_input: SpecCreationInput): PrecedenceVerdict {
  throw new Error('not implemented');
}

export interface DimensionsCreationInput {
  /** ticket.md frontmatter `type`; undefined when absent or unparseable. */
  ticketType: string | undefined;
  /** spec.md content; undefined when the file is missing. */
  specContent: string | undefined;
  personasContent: string;
}

export function evaluateDimensionsCreation(_input: DimensionsCreationInput): PrecedenceVerdict {
  throw new Error('not implemented');
}

/** The `.feature` path named by the ledger's `Feature source:` line, if any. */
export function resolveScenarioSource(_ledgerContent: string): string | undefined {
  throw new Error('not implemented');
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
  stamps: readonly { scope: string; skipReason?: string }[];
}

export function evaluateImplementEntry(_input: ImplementEntryInput): PrecedenceVerdict {
  throw new Error('not implemented');
}
