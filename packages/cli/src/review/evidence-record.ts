import type { ReviewEvidenceRecordV1 } from './contract.js';

export const EVIDENCE_RECORD_FIELDS = [
  'source_identity',
  'checked_version',
  'source_version',
  'target_version',
  'supported_claim',
  'license_identifier',
  'attribution_notice',
  'redistribution_limit',
  'security_limit',
  'privacy_limit',
  'reuse_limit',
] as const;

export interface PlanEvidenceRecordV1 extends ReviewEvidenceRecordV1 {
  readonly schema_version: 1;
}

export function isEvidenceRecord(value: unknown): value is ReviewEvidenceRecordV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === EVIDENCE_RECORD_FIELDS.length &&
    EVIDENCE_RECORD_FIELDS.every(
      field => typeof record[field] === 'string' && record[field].trim() !== '',
    )
  );
}

export function isPlanEvidenceRecord(value: unknown): value is PlanEvidenceRecordV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const { schema_version, ...fields } = value as Record<string, unknown>;
  return schema_version === 1 && isEvidenceRecord(fields);
}
