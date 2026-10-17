import { describe, expect, it } from 'vitest';

import {
  buildExecutionPlanAdmissionEvidence,
  EXECUTION_PLAN_CONFORMANCE_CASES,
} from '../../src/review/execution-plan-conformance.js';
import { EXECUTION_PLAN_SLICING_CASES } from '../fixtures/execution-plan-slicing-cases.js';

describe('single-defect slicing acceptance fixtures', () => {
  it('makes plan integrity discriminate owners, decisions, dependencies and completion proofs', () => {
    const approvals = EXECUTION_PLAN_SLICING_CASES.filter(
      testCase =>
        testCase.expectation.verdict === 'approve' &&
        testCase.execution_plan.includes('RED (plan-integrity'),
    );
    expect(approvals.length).toBeGreaterThan(0);
    for (const testCase of approvals) {
      expect(testCase.execution_plan).toContain('expected_decisions');
      expect(testCase.execution_plan).toContain('expected_dependency_edges');
      expect(testCase.execution_plan).toContain('expected_obligation_owners');
      expect(testCase.execution_plan).toContain('expected_required_proofs');
      expect(testCase.execution_plan).toContain('expected_completion_signals');
      expect(testCase.execution_plan).toContain('negative record mutations');
      expect(testCase.execution_plan).not.toContain('authorize an edited plan');
    }
  });

  it.each(['few-files-two-outcomes', 'ordered-schema-before-reader', 'several-ordered-changes'])(
    'proves %s predecessor delivery without a future activation dependency',
    id => {
      const testCase = EXECUTION_PLAN_SLICING_CASES.find(candidate => candidate.id === id);
      if (testCase === undefined) throw new Error('Missing two-outcome positive');
      const inert = testCase.execution_plan.split(/^### /mu, 2)[1];
      if (inert === undefined) throw new Error('Missing predecessor slice');
      expect(inert).toContain('fixture.expected_cli_response');
      expect(inert).toContain('before any new consumer exists');
      expect(inert).not.toContain('activation disabled');
      expect(inert).toContain('installed-package consumer');
      expect(testCase.execution_plan).not.toContain('Only two files change');
      expect(testCase.expectation.verdict).toBe('approve');
    },
  );

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
    const baseline = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'complete-slice-record',
    );
    const omitted = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'missing-proof',
    );
    if (baseline === undefined || omitted === undefined) throw new Error('Missing proof pair');
    expect(baseline.execution_plan.match(/^### /gmu)).toHaveLength(1);
    const tasks = '#### Tasks and tests';
    const ownership = '## Obligation ownership';
    expect(omitted.execution_plan.slice(0, omitted.execution_plan.indexOf(tasks))).toBe(
      baseline.execution_plan
        .slice(0, baseline.execution_plan.indexOf(tasks))
        .replace(/^- Proof:.*\n/mu, ''),
    );
    expect(omitted.execution_plan.slice(omitted.execution_plan.indexOf(ownership))).toBe(
      baseline.execution_plan.slice(baseline.execution_plan.indexOf(ownership)),
    );
    expect(omitted?.execution_plan).not.toMatch(/^- Proof:/mu);
    expect(omitted?.execution_plan).not.toContain('RED (');
    expect(omitted?.execution_plan).toContain(
      'No verification procedure is assigned to this slice.',
    );
    expect(omitted?.expectation.finding_subject).toBe('Typed review result');
    expect(omitted.execution_plan).toContain('Output: the exported judgment contract');
    expect(omitted.execution_plan).toContain('Output: both response and retained judgment');
  });

  it('keeps the positive mirror inventory concrete, nonempty and ordered before consumers', () => {
    const mirrors = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'many-mechanical-edits',
    );
    if (mirrors === undefined) throw new Error('Missing mirror case');
    const paths = mirrors.execution_plan.match(/^- generated\/host-\d+\/review-contract.ts$/gmu);
    expect(paths).toHaveLength(12);
    expect(new Set(paths).size).toBe(12);
    expect(mirrors.execution_plan).toContain('Zero mirrors must fail.');
    expect(mirrors.execution_plan).toContain('before any installed-package consumer runs');
    expect(mirrors.execution_plan.indexOf('1. RED')).toBeLessThan(
      mirrors.execution_plan.indexOf('2. GREEN'),
    );
    expect(mirrors.execution_plan.indexOf('2. GREEN')).toBeLessThan(
      mirrors.execution_plan.indexOf('3. REFACTOR'),
    );
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

  it('keeps repair of an already settled authorization decision in Execution Planning', () => {
    const baseline = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'one-coherent-change',
    );
    const repair = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'settled-authorization-proof-repair',
    );
    if (baseline === undefined || repair === undefined)
      throw new Error('Missing authorization pair');
    expect(repair.implementation_plan).toBe(baseline.implementation_plan);
    expect(repair.scenario).toBe(baseline.scenario);
    expect(repair.execution_plan).toBe(
      baseline.execution_plan
        .replace(
          '{"type":"command","cwd":".","argv":["bun","run","test:authorization-boundary"]}',
          '{"type":"command","cwd":".","argv":["node","-e","process.stdout.write(\'ok\')"]}',
        )
        .replaceAll(
          'bun run test:authorization-boundary',
          'node -e "process.stdout.write(\'ok\')"',
        ),
    );
    expect(repair.expectation).toMatchObject({
      planning_destination: 'plan-execution',
      finding_subject: 'security-boundary',
      finding_terms: ['proof', 'boundary'],
    });
    expect(EXECUTION_PLAN_CONFORMANCE_CASES.map(candidate => candidate.id)).toContain(
      'unresolved-authorization-decision',
    );
    expect(EXECUTION_PLAN_SLICING_CASES.map(candidate => candidate.id)).not.toContain(
      'unresolved-authorization-decision',
    );
  });

  it('routes genuinely missing authorization ownership to Implementation Planning', () => {
    const baseline = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'one-coherent-change',
    );
    const missing = EXECUTION_PLAN_SLICING_CASES.find(
      candidate => candidate.id === 'missing-authorization-ownership',
    );
    if (baseline === undefined || missing === undefined)
      throw new Error('Missing unresolved-design pair');
    const acceptedDecision =
      'One shared authorization service owns permission checks for every transport.';
    expect(missing.implementation_plan).toBe(
      baseline.implementation_plan.replace(`- ${acceptedDecision}\n`, ''),
    );
    expect(missing.execution_plan).not.toContain(`- ${acceptedDecision}: unchanged`);
    expect(missing.execution_plan).not.toContain('accepted shared authorization service');
    expect(missing.execution_plan).not.toContain('shared-service assertion');
    expect(missing.scenario).not.toContain('shared authorization service');
    expect(missing.execution_plan).toContain('authorization ownership remains undecided');
    for (const input of [missing.implementation_plan, missing.execution_plan, missing.scenario])
      expect(input).not.toContain('plan-implementation');
    expect(missing.expectation).toMatchObject({
      verdict: 'request_changes',
      planning_destination: 'plan-implementation',
      finding_subject: 'Complete delivery',
      finding_terms: ['authorization', 'ownership'],
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
