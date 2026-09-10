import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const SIGNIFICANCE_OBLIGATION = 'Architecture significance';
const SIGNIFICANCE_CLAUSE_FIXTURE = `- **Architecture significance:** Determine significance
  from shared API and migration compatibility effects, never file count or labels.`;

interface ChangeImpact {
  name: string;
  files: number;
  sharedApi: 'changed' | 'preserved';
  migrationCompatibility: 'changed' | 'preserved';
  architectureRecord?: string;
}

function parseChanges(plan: string): ChangeImpact[] {
  return plan
    .split(/\n(?=### Change: )/u)
    .filter(block => block.startsWith('### Change: '))
    .map(block => {
      const lines = block.split('\n');
      const field = (prefix: string): string | undefined =>
        lines
          .find(line => line.startsWith(prefix))
          ?.slice(prefix.length)
          .trim();
      return {
        name: field('### Change: ') ?? '',
        files: Number(field('Files changed: ')),
        sharedApi: field('Shared API effect: ') === 'changed' ? 'changed' : 'preserved',
        migrationCompatibility:
          field('Migration compatibility effect: ') === 'changed' ? 'changed' : 'preserved',
        architectureRecord: field('Architecture record: '),
      };
    });
}

function significanceClause(contract: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${SIGNIFICANCE_OBLIGATION}:**`))
    ?.split('\n\n', 1)[0];
}

function missingSignificanceRequirements(contract: string): string[] {
  const clause = significanceClause(contract);
  if (clause === undefined) return [SIGNIFICANCE_OBLIGATION];
  const normalized = clause.replaceAll(/\s+/gu, ' ').toLowerCase();
  return ['shared api', 'migration compatibility', 'file count', 'labels'].filter(
    requirement => !normalized.includes(requirement),
  );
}

function reviewArchitectureSignificance(
  contract: string,
  plan: string,
  classify = (change: ChangeImpact): boolean =>
    change.sharedApi === 'changed' || change.migrationCompatibility === 'changed',
): ReviewerOutput {
  const findings: { severity: 'error'; message: string }[] = [];
  const missingRequirements = missingSignificanceRequirements(contract);
  if (missingRequirements.length === 0) {
    for (const change of parseChanges(plan)) {
      const significant = classify(change);
      if (significant && change.architectureRecord === undefined) {
        findings.push({
          severity: 'error',
          message: `${change.name} requires a durable architecture record.`,
        });
      }
    }
  } else {
    findings.push({
      severity: 'error',
      message: `The packaged contract is missing semantic architecture-significance triggers: ${missingRequirements.join(', ')}.`,
    });
  }

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Architecture significance follows behavior.'
        : 'Architecture significance needs changes.',
    findings,
  };
}

describe('Implementation Plan semantic architecture significance', () => {
  it.each([
    {
      significantChange: 'Shared request schema',
      sharedApi: 'changed',
      migrationCompatibility: 'preserved',
    },
    {
      significantChange: 'Migration compatibility boundary',
      sharedApi: 'preserved',
      migrationCompatibility: 'changed',
    },
  ] as const)(
    'requires a record for $significantChange while ignoring a many-file mechanical edit',
    ({ migrationCompatibility, sharedApi, significantChange }) => {
      const plan = `# Implementation Plan

### Change: ${significantChange}
Files changed: 1
Shared API effect: ${sharedApi}
Migration compatibility effect: ${migrationCompatibility}

### Change: Generated import formatting
Files changed: 24
Shared API effect: preserved
Migration compatibility effect: preserved
`;

      const result = reviewArchitectureSignificance(PLAN_REVIEW_RUBRIC, plan);

      expect(
        result.findings.filter(finding => finding.message.startsWith('The packaged contract')),
        'The packaged contract is missing semantic architecture-significance triggers.',
      ).toEqual([]);
      expect(result.verdict).toBe('request_changes');
      expect(result.findings).toEqual([
        expect.objectContaining({ message: expect.stringContaining(significantChange) }),
      ]);
      const countBasedMutation = reviewArchitectureSignificance(
        SIGNIFICANCE_CLAUSE_FIXTURE,
        plan,
        change => change.files > 1,
      );
      expect(countBasedMutation.findings).toEqual([
        expect.objectContaining({
          message: expect.stringContaining('Generated import formatting'),
        }),
      ]);
    },
  );
});
