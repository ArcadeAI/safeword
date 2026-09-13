export const DELIVERY_CHECKLIST_CATEGORIES = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
] as const;

export type DeliveryChecklistCategory = (typeof DELIVERY_CHECKLIST_CATEGORIES)[number];
export type DeliveryChecklistOwner = 'contributor' | 'human';
export type DeliveryChecklistDisposition = 'open' | 'complete' | 'not_applicable' | 'pending_human';
export type DeliveryEvidenceClass =
  | 'current_revision_real_boundary'
  | 'reusable_earlier_revision'
  | 'partial_or_structural'
  | 'missing';

export interface DeliveryChecklistItem {
  readonly id: string;
  readonly category: DeliveryChecklistCategory;
  readonly obligation: string;
  readonly owner: DeliveryChecklistOwner;
  readonly requiredProof: string;
  readonly disposition: DeliveryChecklistDisposition;
  readonly evidenceClass: DeliveryEvidenceClass;
  readonly revision: string;
  readonly evidence: string;
}

export type DeliveryChecklistResult =
  | { readonly ok: true; readonly items: readonly DeliveryChecklistItem[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function parseDeliveryChecklist(_content: string): DeliveryChecklistResult {
  return {
    ok: false,
    code: 'delivery_checklist_not_implemented',
    message: 'Delivery Checklist parsing is not implemented.',
  };
}
