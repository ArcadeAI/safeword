import { describe, expect, it } from 'vitest';

import { parseRetrospectiveAnnotation } from '../../src/review/retrospective-annotation.js';

const eligibilityId = '2a73b726-1692-41f0-a331-12c840806568';
const proofId = '841f03ca-6a8b-47b0-801c-e09545dfa7a5';

describe('retrospective ledger annotation', () => {
  it('recognizes a checked row with two distinct coordinator receipt IDs', () => {
    expect(
      parseRetrospectiveAnnotation(`- [x] VERIFIED eligibility=${eligibilityId} proof=${proofId}`),
    ).toEqual({ kind: 'claim', eligibilityId, proofId });
  });

  it('recognizes an unchecked placeholder without granting receipt IDs', () => {
    expect(parseRetrospectiveAnnotation('- [ ] VERIFIED')).toEqual({ kind: 'unchecked' });
  });

  it('does not mistake ordinary GREEN or prose for VERIFIED', () => {
    expect(parseRetrospectiveAnnotation('- [x] GREEN abc1234')).toBeUndefined();
    expect(parseRetrospectiveAnnotation('The scenario was VERIFIED in prose.')).toBeUndefined();
    expect(parseRetrospectiveAnnotation('  - [x] VERIFIED by hand')).toBeUndefined();
    expect(parseRetrospectiveAnnotation('- [x] Verified by hand')).toBeUndefined();
  });

  it('accepts ordinary whitespace between receipt fields but keeps unchecked rows uncredited', () => {
    expect(
      parseRetrospectiveAnnotation(`- [x] VERIFIED eligibility=${eligibilityId}  proof=${proofId}`),
    ).toEqual({ kind: 'claim', eligibilityId, proofId });
    expect(
      parseRetrospectiveAnnotation(`- [ ] VERIFIED eligibility=${eligibilityId} proof=${proofId}`),
    ).toEqual({ kind: 'unchecked' });
  });

  it('withholds receipt IDs for malformed or ambiguous annotations', () => {
    const invalid = {
      kind: 'invalid',
      reason: 'VERIFIED needs distinct eligibility and proof receipt IDs.',
    };
    expect(parseRetrospectiveAnnotation(`- [x] VERIFIED eligibility=${eligibilityId}`)).toEqual(
      invalid,
    );
    expect(
      parseRetrospectiveAnnotation(
        `- [x] VERIFIED eligibility=${eligibilityId} proof=${proofId} extra`,
      ),
    ).toEqual(invalid);
    expect(parseRetrospectiveAnnotation('- [x] VERIFIED eligibility=HEAD proof=HEAD')).toEqual(
      invalid,
    );
    expect(
      parseRetrospectiveAnnotation(`- [x] VERIFIED eligibility=${proofId} proof=${proofId}`),
    ).toEqual(invalid);
  });
});
