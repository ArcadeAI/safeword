import { describe, expect, it } from 'vitest';

import { isReviewKind, type ReviewKind } from '../../src/review/contract.js';
import cases from '../../src/review/ledger-recovery-cases.json' with { type: 'json' };
import { ledgerRecoveryProfileIdentity } from '../../src/review/ledger-recovery-profile.js';
import { hasValidReviewerOutputBody, reviewOutputSchema } from '../../src/review/runtime.js';

const kind = 'ledger-recovery' as ReviewKind;
const confirmations = {
  actor_boundary_fidelity: true,
  real_rejection_controls: true,
  source_fidelity: true,
  no_historical_red_claim: true,
  sole_exact_erratum: true,
  exact_unverified_deferrals: true,
};

function approval() {
  return {
    schema_version: 1,
    dispatch_id: 'review-dispatch',
    reviewer_agent: 'claude',
    verdict: 'approve',
    summary: 'Actual independent current proof.',
    findings: [],
    recovery_certification: {
      profile: ledgerRecoveryProfileIdentity(),
      confirmations: { ...confirmations },
      cases: cases
        .filter(item => !item.deferred)
        .slice(0, 2)
        .map(item => item.digest),
    },
  };
}

describe('bounded recovery certification output', () => {
  it('recognizes a distinct recovery review with actual empty findings', () => {
    expect(isReviewKind(kind), 'Recovery needs its own installed certification contract').toBe(
      true,
    );
    expect(hasValidReviewerOutputBody(approval(), kind)).toBe(true);
    const schema = JSON.parse(reviewOutputSchema(kind));
    expect(schema.required).toContain('recovery_certification');
    expect(schema.additionalProperties).toBe(false);
  });

  it('does not accept ordinary approval without typed certification', () => {
    const { recovery_certification: _certification, ...ordinary } = approval();
    expect(hasValidReviewerOutputBody(ordinary, kind)).toBe(false);
    expect(hasValidReviewerOutputBody(ordinary, 'quality-review')).toBe(true);
    expect(hasValidReviewerOutputBody(approval(), 'quality-review')).toBe(false);
  });

  it('requires each confirmation for approval without inventing rejection findings', () => {
    expect(hasValidReviewerOutputBody(approval(), kind)).toBe(true);
    for (const name of Object.keys(confirmations)) {
      const value = approval();
      Object.assign(value.recovery_certification.confirmations, { [name]: false });
      expect(hasValidReviewerOutputBody(value, kind)).toBe(false);
      value.verdict = 'request_changes';
      expect(hasValidReviewerOutputBody(value, kind)).toBe(true);
      Reflect.deleteProperty(value.recovery_certification.confirmations, name);
      expect(hasValidReviewerOutputBody(value, kind)).toBe(false);
    }
  });

  it('refuses another profile, deferred cases and duplicate case claims', () => {
    expect(hasValidReviewerOutputBody(approval(), kind)).toBe(true);
    const wrong = approval();
    wrong.recovery_certification.profile = '0'.repeat(64);
    expect(hasValidReviewerOutputBody(wrong, kind)).toBe(false);
    const duplicate = approval();
    duplicate.recovery_certification.cases.push(...duplicate.recovery_certification.cases);
    expect(hasValidReviewerOutputBody(duplicate, kind)).toBe(false);
    const deferred = cases.find(item => item.deferred);
    if (deferred === undefined) throw new Error('Reviewed deferred fixture is missing.');
    const excluded = approval();
    excluded.recovery_certification.cases.push(deferred.digest);
    expect(hasValidReviewerOutputBody(excluded, kind)).toBe(false);
  });
});
