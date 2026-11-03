import {
  PACKAGED_CAPABILITY_PAIRS as generatedPairs,
  PACKAGED_CAPABILITY_REVISION as generatedRevision,
  PACKAGED_CAPABILITY_REVISIONS as generatedRevisions,
} from './capability-catalogue.generated.js';

export interface CapabilityRevision {
  readonly corpus_digest: string;
  readonly rubric_digest: string;
  readonly settings_digest: string;
}

/** A revision bound to the exact two models whose settings produced its settings digest. */
export interface PinnedCapabilityRevision extends CapabilityRevision {
  readonly models: readonly [string, string];
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

export interface CapabilityModelIdentity {
  readonly provider: string;
  readonly model: string;
}

export const PACKAGED_CAPABILITY_REVISION: CapabilityRevision = generatedRevision;
export const PACKAGED_CAPABILITY_REVISIONS: readonly PinnedCapabilityRevision[] =
  generatedRevisions;
export const PACKAGED_CAPABILITY_PAIRS: readonly CapabilityPairRecord[] = generatedPairs;

function sameRevision(record: CapabilityPairRecord, revision: CapabilityRevision): boolean {
  return (
    record.corpus_digest === revision.corpus_digest &&
    record.rubric_digest === revision.rubric_digest &&
    record.settings_digest === revision.settings_digest
  );
}

/** Pinned revisions also bind the record's two models, so pairs never borrow another's revision. */
function matchesRevision(
  record: CapabilityPairRecord,
  current: CapabilityRevision | readonly PinnedCapabilityRevision[],
): boolean {
  if (!Array.isArray(current)) return sameRevision(record, current as CapabilityRevision);
  return (current as readonly PinnedCapabilityRevision[]).some(revision => {
    const [first, second] = revision.models;
    return (
      sameRevision(record, revision) &&
      ((record.author_model === first && record.reviewer_model === second) ||
        (record.author_model === second && record.reviewer_model === first))
    );
  });
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
  author: CapabilityModelIdentity,
  reviewer: CapabilityModelIdentity,
  current: CapabilityRevision | readonly PinnedCapabilityRevision[],
  records: readonly CapabilityPairRecord[],
): CapabilityComparison {
  const matching = records.filter(
    record =>
      record.author_provider === author.provider &&
      record.author_model === author.model &&
      record.reviewer_provider === reviewer.provider &&
      record.reviewer_model === reviewer.model &&
      matchesRevision(record, current) &&
      hasQualifiedEvidence(record),
  );
  return matching.length === 1 ? (matching[0]?.direction ?? 'unknown') : 'unknown';
}

export function reviewerCapabilityFailure(
  author: CapabilityModelIdentity,
  requestedModel: string | undefined,
  confirmed: CapabilityModelIdentity | undefined,
  current: CapabilityRevision | readonly PinnedCapabilityRevision[],
  records: readonly CapabilityPairRecord[],
): 'reviewer_capability_weaker' | 'reviewer_capability_unknown' | undefined {
  if (requestedModel === undefined || confirmed?.model !== requestedModel)
    return 'reviewer_capability_unknown';
  const comparison = compareReviewerCapability(author, confirmed, current, records);
  if (comparison === 'weaker') return 'reviewer_capability_weaker';
  return comparison === 'not_weaker' ? undefined : 'reviewer_capability_unknown';
}

export { PACKAGED_CAPABILITY_SETTINGS } from './capability-catalogue.generated.js';
