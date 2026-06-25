import { describe, expect, it } from 'vitest';

// Source of truth lives under templates/ (the .safeword/hooks copy is synced).
// `.js` specifier so tsc resolves the .ts source in the typecheck graph.
import {
  acceptReview,
  DEFAULT_REVIEW_SIZE_THRESHOLD,
  effectiveFalsePositiveRate,
  evaluateMergeGate,
  type Finding,
  hasFreshApproval,
  markActedOn,
  parseReviewResult,
  receiptFromResult,
  recordSkip,
  type ReviewResult,
  selectReviewDepth,
  type Severity,
  validateReviewResult,
} from '../../templates/hooks/lib/pr-review.js';

// Loosely typed: rejection tests pass deliberately invalid values (bad severity,
// missing location), so overrides are `unknown`, not constrained to `Finding`.
const aFinding = (over: Record<string, unknown> = {}) => ({
  location: 'src/x.ts:42',
  failureMode: 'unbounded retry loop',
  severity: 'should-fix',
  ...over,
});

// Strictly typed: for building valid ReviewResult fixtures.
const validFinding = (severity: Severity = 'should-fix'): Finding => ({
  location: 'src/x.ts:42',
  failureMode: 'unbounded retry loop',
  severity,
});

const approveResult: ReviewResult = { verdict: 'APPROVE', findings: [] };

describe('eng-review result contract', () => {
  it('eng-review-green-prs.TB1.AC3.valid_result_accepted', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ severity: 'should-fix' })],
    });
    expect(result.ok).toBe(true);
  });

  it('eng-review-green-prs.TB1.AC3.approve_with_blocker_finding_rejected', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ severity: 'blocker' })],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/blocker/i);
  });

  it('eng-review-green-prs.TB1.AC2.location_with_internal_whitespace_rejected', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ location: 'looks fragile here:99' })],
    });
    expect(result.ok).toBe(false);
  });

  it('eng-review-green-prs.TB1.AC3.invalid_verdict_value_rejected', () => {
    const result = validateReviewResult({ verdict: 'LGTM', findings: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('APPROVE');
    expect(result.reason).toContain('REQUEST-CHANGES');
    expect(result.reason).toContain('NEEDS-DISCUSSION');
  });

  it('eng-review-green-prs.TB1.AC3.invalid_severity_rejected', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ severity: 'meh' })],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('blocker');
    expect(result.reason).toContain('should-fix');
    expect(result.reason).toContain('nit');
  });

  it('eng-review-green-prs.TB1.AC2.finding_without_location_rejected', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ location: undefined })],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/location|file.*line/i);
  });

  it('eng-review-green-prs.TB1.AC2.finding_without_failure_mode_rejected', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ failureMode: ' '.repeat(3) })],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/failure mode/i);
  });

  it('eng-review-green-prs.NTB1.AC1.blocking_verdict_without_next_action_rejected', () => {
    const result = validateReviewResult({
      verdict: 'REQUEST-CHANGES',
      findings: [aFinding({ severity: 'blocker' })],
      nextAction: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/next action/i);
  });

  it('eng-review-green-prs.TB1.AC3.unparseable_review_result_rejected', () => {
    const result = parseReviewResult('not json { broken');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/malformed|parse/i);
  });
});

describe('eng-review provenance is bound to the reviewed commit', () => {
  it('eng-review-green-prs.TB3.AC1.approval_binds_to_reviewed_commit', () => {
    const receipt = receiptFromResult(7, 'C1', approveResult);
    expect(hasFreshApproval(7, 'C1', [receipt])).toBe(true);
  });

  it('eng-review-green-prs.TB3.AC2.new_commit_voids_prior_approval', () => {
    const receipt = receiptFromResult(7, 'C1', approveResult);
    expect(hasFreshApproval(7, 'C2', [receipt])).toBe(false);
  });
});

describe('eng-review skip is an audited break-glass bypass, not an approval', () => {
  it('eng-review-green-prs.TB3.AC3.skip_permits_merge_under_enabled_gate', () => {
    const skip = recordSkip(7, 'C1', 'vendored bundle, not project code');
    expect(skip.ok).toBe(true);
    if (!skip.ok) return;
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [skip.receipt],
    });
    expect(verdict.ok).toBe(true);
  });

  it('eng-review-green-prs.TB3.AC3.skip_is_recorded_distinct_from_approval', () => {
    const skip = recordSkip(7, 'C1', 'vendored bundle, not project code');
    expect(skip.ok).toBe(true);
    if (!skip.ok) return;
    expect(skip.receipt.kind).toBe('skip');
    expect(skip.receipt.kind).not.toBe('review');
    expect(skip.receipt.skipReason).toBe('vendored bundle, not project code');
  });

  it('eng-review-green-prs.TB3.AC3.skip_with_empty_reason_rejected', () => {
    const skip = recordSkip(7, 'C1', ' '.repeat(3));
    expect(skip.ok).toBe(false);
    if (skip.ok) return;
    expect(skip.reason).toMatch(/reason/i);
  });
});

describe('eng-review merge gate is opt-in and blocks only on blockers', () => {
  it('eng-review-green-prs.SM1.AC1.gate_off_never_blocks', () => {
    const verdict = evaluateMergeGate({
      gateEnabled: false,
      prNumber: 7,
      headSha: 'C1',
      receipts: [],
    });
    expect(verdict.ok).toBe(true);
  });

  it('eng-review-green-prs.SM1.AC2.gate_on_without_approval_blocks', () => {
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [],
    });
    expect(verdict.ok).toBe(false);
  });

  it('eng-review-green-prs.SM1.AC2.gate_on_with_fresh_approval_permits', () => {
    const receipt = receiptFromResult(7, 'C1', approveResult);
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [receipt],
    });
    expect(verdict.ok).toBe(true);
  });

  it('eng-review-green-prs.TB2.AC1.advisory_only_findings_do_not_block', () => {
    const advisory: ReviewResult = {
      verdict: 'REQUEST-CHANGES',
      findings: [validFinding('should-fix'), validFinding('nit')],
      nextAction: 'address the nits when convenient',
    };
    const receipt = receiptFromResult(7, 'C1', advisory);
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [receipt],
    });
    expect(verdict.ok).toBe(true);
  });

  it('eng-review-green-prs.TB2.AC1.blocker_finding_blocks', () => {
    const blocking: ReviewResult = {
      verdict: 'REQUEST-CHANGES',
      findings: [validFinding('blocker')],
      nextAction: 'cap the retry loop',
    };
    const receipt = receiptFromResult(7, 'C1', blocking);
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [receipt],
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/blocker/i);
  });
});

describe('eng-review independence is enforced when required', () => {
  it('eng-review-green-prs.NTB1.AC2.same_model_review_rejected_when_enabled', () => {
    const verdict = acceptReview({
      crossModelRequired: true,
      authorModel: 'M1',
      reviewerModel: 'M1',
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/same.model|independ/i);
  });

  it('eng-review-green-prs.NTB1.AC2.different_model_review_accepted', () => {
    const verdict = acceptReview({
      crossModelRequired: true,
      authorModel: 'M1',
      reviewerModel: 'M2',
    });
    expect(verdict.ok).toBe(true);
    expect(receiptFromResult(7, 'C1', approveResult, 'M2').reviewerModel).toBe('M2');
  });

  it('eng-review-green-prs.NTB1.AC2.same_model_accepted_when_disabled', () => {
    const verdict = acceptReview({
      crossModelRequired: false,
      authorModel: 'M1',
      reviewerModel: 'M1',
    });
    expect(verdict.ok).toBe(true);
  });
});

describe('eng-review finding usefulness is measurable', () => {
  it('eng-review-green-prs.TB2.AC3.finding_disposition_is_recorded', () => {
    const recorded = markActedOn({ location: 'src/x.ts:42', actedOn: false }, true);
    expect(recorded.actedOn).toBe(true);
  });

  it('eng-review-green-prs.TB2.AC3.effective_fp_rate_is_computed', () => {
    const rate = effectiveFalsePositiveRate([
      { actedOn: true },
      { actedOn: false },
      { actedOn: false },
      { actedOn: false },
    ]);
    expect(rate).toBe(0.75);
  });
});

describe('eng-review thoroughness scales to change risk', () => {
  it('eng-review-green-prs.TB2.AC2.small_low_risk_diff_gets_lightweight_review', () => {
    expect(selectReviewDepth({ changedLines: 20, touchesSensitivePath: false })).toBe(
      'lightweight',
    );
  });

  it('eng-review-green-prs.TB2.AC2.large_diff_gets_thorough_review', () => {
    expect(
      selectReviewDepth({
        changedLines: DEFAULT_REVIEW_SIZE_THRESHOLD + 1,
        touchesSensitivePath: false,
      }),
    ).toBe('thorough');
  });

  it('eng-review-green-prs.TB2.AC2.sensitive_path_escalates_regardless_of_size', () => {
    expect(selectReviewDepth({ changedLines: 5, touchesSensitivePath: true })).toBe('thorough');
  });
});

// Hardening from the quality-review independent pass (Y9WX8R): close two holes
// the original scenarios did not construct — a blocker masked by a same-head skip,
// and cross-model independence not enforced on the gate path.
describe('eng-review gate hardening', () => {
  it('eng-review-green-prs.TB2.AC1.blocker_overrides_skip_at_same_head', () => {
    const skip = recordSkip(7, 'C1', 'vendored bundle');
    expect(skip.ok).toBe(true);
    if (!skip.ok) return;
    const blocking: ReviewResult = {
      verdict: 'REQUEST-CHANGES',
      findings: [validFinding('blocker')],
      nextAction: 'fix it',
    };
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [skip.receipt, receiptFromResult(7, 'C1', blocking)],
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/blocker/i);
  });

  it('eng-review-green-prs.NTB1.AC2.gate_blocks_same_model_review_when_required', () => {
    const sameModel = receiptFromResult(7, 'C1', approveResult, 'M1');
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [sameModel],
      crossModelRequired: true,
      authorModel: 'M1',
    });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/cross.model|independent/i);
  });

  it('eng-review-green-prs.NTB1.AC2.gate_permits_independent_review_when_required', () => {
    const independent = receiptFromResult(7, 'C1', approveResult, 'M2');
    const verdict = evaluateMergeGate({
      gateEnabled: true,
      prNumber: 7,
      headSha: 'C1',
      receipts: [independent],
      crossModelRequired: true,
      authorModel: 'M1',
    });
    expect(verdict.ok).toBe(true);
  });
});
