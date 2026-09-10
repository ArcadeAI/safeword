import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const ROUTING_REQUIREMENT =
  'Keep reversible feature-local choices in the Implementation Plan and link only difficult-to-reverse structural or shared-contract decisions to the configured durable architecture record';
const BLOCKING_REQUIREMENT =
  'A significant decision without a resolvable durable architecture link blocks approval';
const MISSING_ROUTING_FINDING = {
  severity: 'error' as const,
  message: 'The packaged contract is missing the durable-record routing requirement.',
};
const MISSING_UNRESOLVED_GATE_FINDING = {
  severity: 'error' as const,
  message: 'The packaged contract is missing the unresolved-significant-decision gate.',
};

interface PlannedDecision {
  name: string;
  significance: string;
  architectureRecord?: string;
}

function plannedDecisions(plan: string): PlannedDecision[] {
  return plan
    .split(/\n(?=### Decision: )/u)
    .filter(block => block.startsWith('### Decision: '))
    .map(block => {
      const lines = block.split('\n');
      const field = (prefix: string): string | undefined =>
        lines
          .find(line => line.startsWith(prefix))
          ?.slice(prefix.length)
          .trim();
      return {
        name: field('### Decision: ') ?? '',
        significance: field('Significance: ') ?? '',
        architectureRecord: field('Architecture record: '),
      };
    });
}

function reviewRecordingDestinations(
  contract: string,
  plan: string,
  resolvableRecords: ReadonlySet<string>,
): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  if (contract.includes(ROUTING_REQUIREMENT)) {
    for (const decision of plannedDecisions(plan)) {
      const significant = /difficult-to-reverse|shared-contract|structural/u.test(
        decision.significance,
      );
      const linked =
        decision.architectureRecord !== undefined &&
        resolvableRecords.has(decision.architectureRecord);
      if (significant && !linked) {
        findings.push({
          severity: 'error',
          message: `${decision.name} needs a resolvable durable architecture record.`,
        });
      }
      if (!significant && decision.architectureRecord !== undefined) {
        findings.push({
          severity: 'error',
          message: `${decision.name} is feature-local and belongs only in the Implementation Plan.`,
        });
      }
    }
  } else {
    findings.push(MISSING_ROUTING_FINDING);
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Decisions are recorded at the right durability.'
        : 'Decision recording destinations need changes.',
    findings,
  };
}

function reviewUnrecordedSignificantDecision(
  contract: string,
  plan: string,
  resolvableRecords: ReadonlySet<string>,
): ReviewerOutput {
  if (!contract.includes(BLOCKING_REQUIREMENT)) {
    return {
      schema_version: 1,
      dispatch_id: createHash('sha256').update(contract).digest('hex'),
      reviewer_agent: 'claude',
      verdict: 'request_changes',
      summary: 'The durable-link approval gate is missing.',
      findings: [MISSING_UNRESOLVED_GATE_FINDING],
    };
  }
  return reviewRecordingDestinations(contract, plan, resolvableRecords);
}

describe('Implementation Plan durable architecture routing', () => {
  it('keeps a reversible local choice in the plan and links only the shared contract', () => {
    const plan = `# Implementation Plan

### Decision: Retry label wording
Significance: reversible feature-local choice

### Decision: Gateway authorization contract
Significance: difficult-to-reverse shared-contract choice
Architecture record: ARCHITECTURE.md#gateway-authorization
`;

    const result = reviewRecordingDestinations(
      PLAN_REVIEW_RUBRIC,
      plan,
      new Set(['ARCHITECTURE.md#gateway-authorization']),
    );

    expect(plannedDecisions(plan).map(decision => decision.name)).toEqual([
      'Retry label wording',
      'Gateway authorization contract',
    ]);
    expect(result.findings).not.toContainEqual(MISSING_ROUTING_FINDING);
    expect(result.verdict).toBe('approve');
    expect(result.findings).toEqual([]);
  });

  it.each([
    {
      name: 'rejects a durable link on a reversible feature-local choice',
      plan: `### Decision: Retry label wording
Significance: reversible feature-local choice
Architecture record: ARCHITECTURE.md#retry-label
`,
      records: new Set(['ARCHITECTURE.md#retry-label']),
      expected: 'belongs only in the Implementation Plan',
    },
    {
      name: 'rejects a shared-contract choice whose link does not resolve',
      plan: `### Decision: Gateway authorization contract
Significance: difficult-to-reverse shared-contract choice
Architecture record: ARCHITECTURE.md#missing
`,
      records: new Set<string>(),
      expected: 'needs a resolvable durable architecture record',
    },
  ])('$name', ({ expected, plan, records }) => {
    const result = reviewRecordingDestinations(PLAN_REVIEW_RUBRIC, plan, records);

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining(expected) }),
    ]);
  });
});

describe('Implementation Plan unresolved significant decisions', () => {
  it('blocks approval when a shared-contract choice has no durable link', () => {
    const plan = `# Implementation Plan

### Decision: Gateway authorization contract
Significance: difficult-to-reverse shared-contract choice
`;

    const result = reviewUnrecordedSignificantDecision(PLAN_REVIEW_RUBRIC, plan, new Set());

    expect(result.findings).not.toContainEqual(MISSING_UNRESOLVED_GATE_FINDING);
    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('needs a resolvable durable architecture record'),
      }),
    ]);
  });

  it('approves the same decision after its durable link resolves', () => {
    const plan = `### Decision: Gateway authorization contract
Significance: difficult-to-reverse shared-contract choice
Architecture record: ARCHITECTURE.md#gateway-authorization
`;

    const result = reviewUnrecordedSignificantDecision(
      PLAN_REVIEW_RUBRIC,
      plan,
      new Set(['ARCHITECTURE.md#gateway-authorization']),
    );

    expect(result.verdict).toBe('approve');
    expect(result.findings).toEqual([]);
  });
});
