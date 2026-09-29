export interface CapabilityRevision {
  readonly corpus_digest: string;
  readonly rubric_digest: string;
  readonly settings_digest: string;
}

export interface CapabilityPairRecord extends CapabilityRevision {
  readonly author_provider: string;
  readonly reviewer_provider: string;
  readonly author_model: string;
  readonly reviewer_model: string;
  readonly direction: 'not_weaker' | 'weaker';
  readonly qualification: 'pinned-corpus' | 'provider-order' | 'unqualified';
  readonly evidence_date: string;
  readonly results_digest: string;
}

export type CapabilityComparison = 'not_weaker' | 'weaker' | 'unknown';

// Filled only by the pinned reviewer-capability evaluation. Until its evidence
// is admitted, no cross-provider pair can establish independent review.
export const PACKAGED_CAPABILITY_REVISION: CapabilityRevision = {
  corpus_digest: 'pending',
  rubric_digest: 'pending',
  settings_digest: 'pending',
};

export const PACKAGED_CAPABILITY_PAIRS: readonly CapabilityPairRecord[] = [];

function matchesRevision(record: CapabilityPairRecord, current: CapabilityRevision): boolean {
  return (
    record.corpus_digest === current.corpus_digest &&
    record.rubric_digest === current.rubric_digest &&
    record.settings_digest === current.settings_digest
  );
}

function hasQualifiedEvidence(record: CapabilityPairRecord): boolean {
  return (
    record.qualification !== 'unqualified' &&
    record.author_provider !== '' &&
    record.reviewer_provider !== '' &&
    (record.qualification !== 'provider-order' ||
      record.author_provider === record.reviewer_provider) &&
    record.evidence_date !== '' &&
    record.results_digest !== ''
  );
}

/** Only current, qualified evidence for the exact directional pair carries authority. */
export function compareReviewerCapability(
  authorModel: string,
  reviewerModel: string,
  current: CapabilityRevision,
  records: readonly CapabilityPairRecord[],
): CapabilityComparison {
  const matching = records.filter(
    record =>
      record.author_model === authorModel &&
      record.reviewer_model === reviewerModel &&
      matchesRevision(record, current) &&
      hasQualifiedEvidence(record),
  );
  return matching.length === 1 ? (matching[0]?.direction ?? 'unknown') : 'unknown';
}
