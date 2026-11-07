import {
  PACKAGED_CAPABILITY_PAIRS as generatedPairs,
  PACKAGED_CAPABILITY_REVISION as generatedRevision,
} from './capability-catalogue.generated.js';

// Measurement records from the reviewer capability harness. They are retained as
// evidence only; review routing no longer ranks reviewers by them (K8VPME).
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

export const PACKAGED_CAPABILITY_REVISION: CapabilityRevision = generatedRevision;
export const PACKAGED_CAPABILITY_PAIRS: readonly CapabilityPairRecord[] = generatedPairs;

export { PACKAGED_CAPABILITY_SETTINGS } from './capability-catalogue.generated.js';
