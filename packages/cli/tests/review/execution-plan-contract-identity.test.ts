import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReviewPacket, UnverifiedReviewerOutput } from '../../src/review/contract.js';
import { EXECUTION_PLAN_REVIEW_RUBRIC } from '../../src/review/execution-plan-rubric.generated.js';
import { extractExecutionPlanReviewRubric } from '../../src/review/execution-plan-rubric.js';
import { assemblePlanContract } from '../../src/review/packet.js';
import { reconcilePlanContract } from '../../src/review/runtime.js';

const packageRoot = nodePath.resolve(import.meta.dirname, '../..');
const canonicalReference = readFileSync(
  nodePath.join(packageRoot, 'templates/skills/bdd/PLAN_EXECUTION.md'),
  'utf8',
);
const canonicalRubric = extractExecutionPlanReviewRubric(canonicalReference);
const approved: UnverifiedReviewerOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'approved',
  findings: [],
  execution_plan_record: {
    slicing_decision: 'one_pull_request',
    rationale: 'One coherent change.',
    slices: [],
    obligation_owners: [],
    decision_statuses: [],
  },
};

function packet(authorRubric: string, reviewerRubric: string): ReviewPacket {
  return {
    schema_version: 1,
    dispatch_id: 'dispatch-1',
    kind: 'plan-execution',
    logical_files: [],
    plan_contract: assemblePlanContract(authorRubric, reviewerRubric),
  };
}

describe('Execution Plan review-contract identity', () => {
  it.each([
    ['authoring', undefined, EXECUTION_PLAN_REVIEW_RUBRIC, 'authoring contract copy'],
    ['reviewer', canonicalRubric, undefined, 'generated reviewer contract copy'],
  ])('names a missing %s copy before review', (_copy, author, reviewer, expected) => {
    expect(() => assemblePlanContract(author, reviewer)).toThrow(expected);
  });

  it('names a stale generated reviewer copy even when the authoring copy is canonical', () => {
    const result = reconcilePlanContract(
      packet(canonicalRubric, `${EXECUTION_PLAN_REVIEW_RUBRIC}\nStale reviewer-only text.`),
      approved,
    );

    expect(result.verdict).toBe('request_changes');
    expect(result.execution_plan_record).toBeNull();
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('generated reviewer contract'),
      }),
    ]);
  });

  it('rejects matching version labels when both copies omit a canonical startability check', () => {
    const startability = canonicalRubric.indexOf('- **Startable steps:**');
    const followingObligation = canonicalRubric.indexOf('- **Dependency safety:**');
    const withoutStartability =
      canonicalRubric.slice(0, startability) + canonicalRubric.slice(followingObligation);
    const result = reconcilePlanContract(
      packet(withoutStartability, withoutStartability),
      approved,
    );

    expect(withoutStartability).not.toBe(canonicalRubric);
    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('canonical contract'),
      }),
    ]);
  });

  it('does not block review when both copies equal the packaged canonical bytes', () => {
    expect(EXECUTION_PLAN_REVIEW_RUBRIC).toBe(canonicalRubric);
    expect(reconcilePlanContract(packet(canonicalRubric, canonicalRubric), approved)).toBe(
      approved,
    );
  });
});
