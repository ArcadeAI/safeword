/**
 * Reconcile prose sections against the current structure (ticket QD5DTT,
 * Slice 1).
 *
 * Deterministic, LLM-free: compares each prose section's recorded `reconciled`
 * stamp and its node's existence against the live skeleton, and returns a
 * per-section verdict. This is what lets the doc be incomplete (prose lagging,
 * visibly marked) yet never silently wrong.
 */

export type SectionStatus = 'current' | 'stale' | 'orphaned' | 'placeholder';

export interface ProseSection {
  /** The module/node name this section describes. */
  node: string;
  /** The skeleton fingerprint this section was last reconciled against. */
  reconciled: string;
  /** Whether the section has authored prose yet (vs. an empty placeholder). */
  hasProse: boolean;
}

export interface ReconcileInput {
  /** Prose sections currently in the doc. */
  sections: ProseSection[];
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
  const present = new Set(input.nodeNames);

  return input.sections.map(section => ({
    node: section.node,
    status: sectionStatus(section, present, input.fingerprint),
  }));
}

function sectionStatus(
  section: ProseSection,
  presentNodes: ReadonlySet<string>,
  fingerprint: string,
): SectionStatus {
  // Orphan wins over stale: a section describing a removed node is orphaned even
  // though its stamp has also drifted.
  if (!presentNodes.has(section.node)) return 'orphaned';
  if (!section.hasProse) return 'placeholder';
  if (section.reconciled !== fingerprint) return 'stale';
  return 'current';
}
