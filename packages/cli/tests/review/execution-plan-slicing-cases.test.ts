import { describe, expect, it } from 'vitest';

import {
  buildExecutionPlanAdmissionEvidence,
  EXECUTION_PLAN_CONFORMANCE_CASES,
} from '../../src/review/execution-plan-conformance.js';
import { EXECUTION_PLAN_SLICING_CASES } from '../fixtures/execution-plan-slicing-cases.js';

describe('single-defect slicing acceptance fixtures', () => {
  it.each([
    ['missing-purpose', 'Purpose'],
    ['missing-boundary', 'Boundary'],
    ['missing-prerequisites', 'Prerequisites'],
    ['missing-completion-signal', 'Completion signal'],
  ])('isolates %s from an otherwise approvable slice', (id, label) => {
    const baseline = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'complete-slice-record',
    );
    const rejected = EXECUTION_PLAN_SLICING_CASES.find(candidate => candidate.id === id);
    if (baseline === undefined || rejected === undefined)
      throw new Error('Missing conformance pair');
    const omittedLine = baseline.execution_plan
      .split('\n')
      .find(line => line.startsWith(`- ${label}:`));
    if (omittedLine === undefined) throw new Error(`Missing baseline ${label}`);
    expect(rejected.implementation_plan).toBe(baseline.implementation_plan);
    expect(rejected.execution_plan).toBe(
      baseline.execution_plan.replace(omittedLine, () => `- ${label}: Not specified.`),
    );
    expect(rejected.expectation.finding_subject).toBe('Typed review result');
  });
  it('omits the proof obligation rather than only its Markdown label', () => {
    const omitted = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'missing-proof',
    );
    expect(omitted?.execution_plan).not.toMatch(/^- Proof:/mu);
    expect(omitted?.execution_plan).not.toContain('RED (');
    expect(omitted?.execution_plan).toContain(
      'No verification procedure is assigned to this slice.',
    );
    expect(omitted?.expectation.finding_subject).toBe('Typed review result');
  });

  it('keeps expected verdicts and defect descriptions out of reviewer scenario context', () => {
    const approving = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'complete-slice-record',
    );
    const rejecting = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'missing-proof',
    );
    expect(approving?.scenario).toBe(rejecting?.scenario);
    for (const testCase of EXECUTION_PLAN_SLICING_CASES) {
      expect(testCase.scenario).not.toContain(testCase.id);
      expect(testCase.scenario).not.toContain(testCase.expectation.verdict);
    }
  });

  it('isolates the implementer-deferred authorization boundary without a routing hint', () => {
    const baseline = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'one-coherent-change',
    );
    const deferred = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'unresolved-authorization-decision',
    );
    if (baseline === undefined || deferred === undefined)
      throw new Error('Missing authorization pair');
    const baselineBoundary = baseline.execution_plan
      .split('\n')
      .find(line => line.startsWith('- Boundary:'));
    const deferredBoundary = deferred.execution_plan
      .split('\n')
      .find(line => line.startsWith('- Boundary:'));
    if (baselineBoundary === undefined || deferredBoundary === undefined)
      throw new Error('Missing boundary');
    expect(deferred.implementation_plan).toBe(baseline.implementation_plan);
    expect(deferred.scenario).toBe(baseline.scenario);
    expect(deferred.execution_plan.replace(deferredBoundary, () => baselineBoundary)).toBe(
      baseline.execution_plan,
    );
    expect(deferredBoundary).toContain('implementer must choose authorization ownership');
    expect(deferred.expectation).toMatchObject({
      planning_destination: 'plan-implementation',
      finding_subject: 'Complete delivery',
      finding_terms: ['authorization', 'boundary'],
    });
  });

  it('rejects acceptance results as admission evidence', () => {
    const results = EXECUTION_PLAN_CONFORMANCE_CASES.map(testCase => ({
      case_id: `acceptance:${testCase.id}`,
      reviewer: 'claude' as const,
      model: 'opus',
      passed: true,
    }));
    const originalIds = results.map(result => ({
      ...result,
      case_id: result.case_id.slice('acceptance:'.length),
    }));
    expect(buildExecutionPlanAdmissionEvidence(originalIds).identities).toHaveLength(1);
    expect(() => buildExecutionPlanAdmissionEvidence(results)).toThrow(
      'Expected a complete passing Execution Plan conformance matrix per identity',
    );
  });
});
