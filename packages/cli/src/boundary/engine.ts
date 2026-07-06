/**
 * Boundary reconciliation engine (ticket CDRJTW, #810 slice 1).
 *
 * Pure composition of safeword's existing evidence checks over the ticket
 * artifacts present in a change. The command layer discovers the change and
 * supplies prior/proposed content; this module owns which checks run and how
 * verdicts are shaped. Warn-and-record: verdicts never carry a blocking
 * signal in this slice — hard-block tiers are the server-side child of #810.
 */

import {
  detectUnanchoredPhaseTransition,
  evaluateTicketWrite,
} from '../../templates/hooks/lib/phase-provenance.js';

/** Ticket-artifact basenames the engine knows how to reconcile. */
export const TICKET_ARTIFACTS = new Set([
  'ticket.md',
  'test-definitions.md',
  'verify.md',
  'impl-plan.md',
  'spec.md',
]);

export interface ChangedArtifact {
  /** Ticket folder name, e.g. `BND001-clean`. */
  ticketFolder: string;
  /** Artifact basename, e.g. `ticket.md`. */
  artifact: string;
  /** Content before the change; undefined = artifact is being created. */
  prior?: string;
  /** Content after the change; undefined = artifact is being deleted. */
  proposed?: string;
}

export type Verdict = 'pass' | 'warn' | 'indeterminate';

export interface CheckVerdict {
  check: string;
  verdict: Verdict;
  detail?: string;
}

export interface TicketReconciliation {
  ticket: string;
  checks: CheckVerdict[];
}

/** Group changed artifacts by ticket folder. */
function groupByTicket(artifacts: ChangedArtifact[]): Map<string, ChangedArtifact[]> {
  const byTicket = new Map<string, ChangedArtifact[]>();
  for (const artifact of artifacts) {
    const group = byTicket.get(artifact.ticketFolder) ?? [];
    group.push(artifact);
    byTicket.set(artifact.ticketFolder, group);
  }
  return byTicket;
}

/** Commit-tier checks for one ticket's changed artifacts (content-only — no git). */
function reconcileTicket(artifacts: ChangedArtifact[]): CheckVerdict[] {
  const checks: CheckVerdict[] = [];
  const ticketFile = artifacts.find(a => a.artifact === 'ticket.md');

  if (ticketFile?.proposed !== undefined) {
    const legality = evaluateTicketWrite(ticketFile.prior, ticketFile.proposed);
    checks.push(
      legality.ok
        ? { check: 'phase-legality', verdict: 'pass' }
        : { check: 'phase-legality', verdict: 'warn', detail: legality.reason },
    );

    const anchor = detectUnanchoredPhaseTransition(ticketFile.prior, ticketFile.proposed);
    checks.push(
      anchor.kind === 'unanchored'
        ? { check: 'phase-anchor', verdict: 'warn', detail: anchor.reason }
        : { check: 'phase-anchor', verdict: 'pass' },
    );
  }

  return checks;
}

/**
 * Reconcile every ticket touched by a change. Returns one entry per ticket,
 * each carrying its per-check verdicts — pass entries included, so a clean
 * run is a recorded fact, not an absence.
 */
export function reconcileChange(artifacts: ChangedArtifact[]): TicketReconciliation[] {
  return [...groupByTicket(artifacts)].map(([ticket, group]) => ({
    ticket,
    checks: reconcileTicket(group),
  }));
}

/** All findings (non-pass verdicts) across a reconciliation, for warning output. */
export function findings(
  reconciliations: TicketReconciliation[],
): { ticket: string; check: CheckVerdict }[] {
  return reconciliations.flatMap(({ ticket, checks }) =>
    checks.filter(c => c.verdict !== 'pass').map(check => ({ ticket, check })),
  );
}
