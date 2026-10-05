export type RetrospectiveAnnotation =
  | { readonly kind: 'unchecked' }
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'claim'; readonly eligibilityId: string; readonly proofId: string };

const ROW = /^\s*- \[([ xX])\] VERIFIED(?:\s|$)/u;
const NONCANONICAL_ROW = /^\s*- \[[ xX]\]\s+VERIFIED\b/iu;
const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

function receiptIds(annotation: string): { eligibilityId: string; proofId: string } | undefined {
  const parts = annotation.trim().split(/\s+/u);
  if (parts.length !== 2) return undefined;
  const [eligibility = '', proof = ''] = parts;
  if (!eligibility.startsWith('eligibility=') || !proof.startsWith('proof=')) return undefined;
  const eligibilityId = eligibility.slice('eligibility='.length);
  const proofId = proof.slice('proof='.length);
  if (!UUID.test(eligibilityId) || !UUID.test(proofId) || eligibilityId === proofId)
    return undefined;
  return { eligibilityId, proofId };
}

/** Parse the separate retrospective ledger row; IDs alone never authorize it. */
export function parseRetrospectiveAnnotation(line: string): RetrospectiveAnnotation | undefined {
  const row = ROW.exec(line);
  if (row === null)
    return NONCANONICAL_ROW.test(line)
      ? {
          kind: 'invalid',
          reason: 'VERIFIED row must use uppercase VERIFIED and the canonical checkbox spacing.',
        }
      : undefined;
  const checked = row[1]?.toLowerCase() === 'x';
  if (!checked) return { kind: 'unchecked' };
  const receipts = receiptIds(line.slice(row[0].length));
  if (receipts === undefined) {
    return {
      kind: 'invalid',
      reason: 'VERIFIED needs distinct eligibility and proof receipt IDs.',
    };
  }
  return { kind: 'claim', ...receipts };
}
