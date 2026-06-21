/**
 * Reconcile prose sections against the current structure (ticket QD5DTT,
 * Slice 1).
 *
 * Deterministic, LLM-free: the single source of truth for per-section status.
 * Given each section's recorded `reconciled` stamp and the live skeleton, it
 * classifies every node — current, stale, orphaned, or placeholder — and the
 * document layer renders markers from these verdicts. This is what lets the
 * doc be incomplete (prose lagging, visibly marked) yet never silently wrong.
 */

export type SectionStatus = 'current' | 'stale' | 'orphaned' | 'placeholder';

export interface ReconcileInput {
  /** Node name → the fingerprint its section was last reconciled against. */
  priorStamps: Record<string, string>;
  /** Names of the nodes in the current skeleton. */
  nodeNames: string[];
  /** The current live skeleton fingerprint. */
  fingerprint: string;
}

export interface SectionVerdict {
  node: string;
  status: SectionStatus;
}

export function reconcileSections(input: ReconcileInput): SectionVerdict[] {
  const verdicts: SectionVerdict[] = input.nodeNames.map(node => ({
    node,
    status: liveNodeStatus(input.priorStamps[node], input.fingerprint),
  }));

  // A prior section whose node is gone is orphaned — surfaced, never dropped.
  const present = new Set(input.nodeNames);
  for (const node of Object.keys(input.priorStamps)) {
    if (!present.has(node)) verdicts.push({ node, status: 'orphaned' });
  }

  return verdicts;
}

function liveNodeStatus(stamp: string | undefined, fingerprint: string): SectionStatus {
  // No prior stamp → the node is new this reconcile: a placeholder awaiting
  // prose, not stale. A surviving section is stale exactly when its stamp has
  // fallen behind the live fingerprint.
  if (stamp === undefined) return 'placeholder';
  if (stamp !== fingerprint) return 'stale';
  return 'current';
}
