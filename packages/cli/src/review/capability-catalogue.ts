export interface CapabilityRevision {
  readonly corpus_digest: string;
  readonly rubric_digest: string;
  readonly settings_digest: string;
}

export interface CapabilityPairRecord extends CapabilityRevision {
  readonly author_model: string;
  readonly reviewer_model: string;
  readonly direction: 'not_weaker' | 'weaker';
  readonly qualification: 'pinned-corpus' | 'provider-order' | 'unqualified';
  readonly evidence_date: string;
  readonly results_digest: string;
}

export type CapabilityComparison = 'not_weaker' | 'weaker' | 'unknown';

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
      record.corpus_digest === current.corpus_digest &&
      record.rubric_digest === current.rubric_digest &&
      record.settings_digest === current.settings_digest &&
      record.qualification !== 'unqualified' &&
      record.evidence_date !== '' &&
      record.results_digest !== '',
  );
  return matching.length === 1 ? (matching[0]?.direction ?? 'unknown') : 'unknown';
}
