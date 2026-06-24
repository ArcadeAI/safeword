import { describe, expect, it } from 'vitest';

// Source of truth lives under templates/ (the .safeword/hooks copy is synced).
// `.js` specifier so tsc resolves the .ts source in the typecheck graph.
import { parseReviewResult, validateReviewResult } from '../../templates/hooks/lib/pr-review.js';

const aFinding = (over: Record<string, unknown> = {}) => ({
  location: 'src/x.ts:42',
  failureMode: 'unbounded retry loop',
  severity: 'should-fix',
  ...over,
});

describe('eng-review result contract', () => {
  it('eng-review-green-prs.TB1.AC3.valid_result_accepted', () => {
    const result = validateReviewResult({
      verdict: 'APPROVE',
      findings: [aFinding({ severity: 'blocker' })],
    });
    expect(result.ok).toBe(true);
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
