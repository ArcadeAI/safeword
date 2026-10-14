import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  planningContractCorpusDigest,
  planningContractRubricDigest,
  type PlanningEvalManifest,
  planningJudgePrompt,
  planningJudgeRubricDigest,
  planningReviewerPrompt,
  scorePlanningCase,
} from '../scripts/lib/planning-contracts-eval.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../src/execution-plan/delivery-checklist.js';
import { planningContractCases } from './fixtures/planning-contracts-eval.js';

const manifest = JSON.parse(
  readFileSync(
    nodePath.resolve(import.meta.dirname, 'fixtures/planning-contracts-eval/manifest.json'),
    'utf8',
  ),
) as PlanningEvalManifest;

describe('planning contracts eval contract', () => {
  it.each(['r15-guidance-candidate', 'r15-required-proof-decision'])(
    '%s supplies a complete planned delivery contract to both actors',
    id => {
      const evaluationCase = planningContractCases.find(item => item.id === id);
      if (evaluationCase === undefined) throw new Error(`Missing fixture ${id}`);
      expect(evaluationCase.expected_verdict).toBe('approve');
      const contract = parseDeliveryPlanContract(evaluationCase.reviewed_plan);
      expect(
        contract.ok,
        'An approval control must not omit the required proof table/checklist',
      ).toBe(true);
      if (!contract.ok) throw new Error(contract.message);
      const packet = JSON.parse(planningReviewerPrompt(evaluationCase).split('\n\n').at(-1) ?? '');
      expect(packet.execution_plan_delivery_definition).toEqual(
        createExecutionPlanDeliveryDefinition(contract, false),
      );
      expect(packet.execution_plan_normalized_digest).toBe(
        normalizedExecutionPlanDigest(evaluationCase.reviewed_plan),
      );
    },
  );

  it('isolates the missing CLI proof from unrelated delivery-contract omissions', () => {
    const negative = planningContractCases.find(
      item => item.id === 'r15-missing-required-proof-decision',
    );
    const positive = planningContractCases.find(item => item.id === 'r15-required-proof-decision');
    if (!negative || !positive) throw new Error('Missing paired CLI proof fixtures');
    expect(negative.expected_verdict).toBe('request_changes');
    expect(negative.accepted_boundary).toBe(positive.accepted_boundary);
    expect(parseDeliveryPlanContract(negative.reviewed_plan).ok).toBe(true);
    expect(positive.reviewed_plan).toContain('bin/account-change.js');
    expect(negative.reviewed_plan).not.toContain('bin/account-change.js');
    expect(negative.reviewed_plan).toContain(
      'no CLI denial invocation or exit-code check is planned',
    );
  });

  it('grounds judge evidence in the actual files supplied to the reviewer', () => {
    const evaluationCase = planningContractCases.find(item => item.id === 'r10-shape-product-plan');
    if (evaluationCase === undefined) throw new Error('Missing product contract fixture');
    const reviewed = JSON.parse(planningReviewerPrompt(evaluationCase).split('\n\n').at(-1) ?? '');
    const judged = JSON.parse(
      planningJudgePrompt(evaluationCase, {
        verdict: 'approve',
        evidence_claims: ['impl-plan.md declares all eight phase contract elements.'],
      })
        .split('\n\n')
        .at(-1) ?? '',
    );
    expect(judged.logical_files).toEqual(reviewed.logical_files);
    expect(judged.context_files).toEqual(reviewed.context_files);
    expect(judged.logical_files).toContainEqual({
      path: 'impl-plan.md',
      content: evaluationCase.reviewed_plan,
    });
  });

  it('places adversarial plan text inside the canonical untrusted file boundary', () => {
    const evaluationCase = planningContractCases.find(item => item.id === 'r7-plan-instruction');
    expect(evaluationCase).toBeDefined();
    if (evaluationCase === undefined) throw new Error('Missing adversarial fixture');
    const prompt = planningReviewerPrompt(evaluationCase);
    const packet = JSON.parse(prompt.split('\n\n').at(-1) ?? '');
    expect(packet.logical_files).toEqual([
      { path: 'impl-plan.md', content: evaluationCase.reviewed_plan },
    ]);
    expect(packet.context_files.map((file: { content: string }) => file.content)).toEqual([
      evaluationCase.reviewer_boundary ?? evaluationCase.accepted_boundary,
      evaluationCase.context,
    ]);
    expect(packet).not.toHaveProperty('expected_verdict');
    expect(packet).not.toHaveProperty('allowed_finding_authority');
  });

  it('pins the current rubrics, models, and a complete adversarial rule corpus', () => {
    expect(manifest.version).toBe(1);
    expect(manifest.rubric_digest).toBe(planningContractRubricDigest());
    expect(manifest.corpus_digest).toBe(planningContractCorpusDigest(planningContractCases));
    expect(manifest.judge_rubric_digest).toBe(planningJudgeRubricDigest());
    expect(manifest.reviewer_model).toBe('claude-opus-5');
    expect(manifest.judge_model).toBe('claude-sonnet-5');
    expect([manifest.repetitions, manifest.agreement_threshold]).toEqual([3, 2]);
    expect(manifest.settings).toEqual({
      effort: 'low',
      tools_disabled: true,
      session_persistence: false,
    });
    expect(new Set(planningContractCases.map(item => item.rule))).toEqual(
      new Set(['R7', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16']),
    );
    expect(planningContractCases.filter(item => item.rule === 'R7')).toHaveLength(6);
    expect(
      planningContractCases
        .filter(
          item =>
            item.rule === 'R10' &&
            item.planning_phase !== undefined &&
            item.expected_verdict === 'request_changes',
        )
        .map(item => item.planning_phase),
    ).toEqual(['product-plan', 'plan-implementation', 'plan-execution']);
    for (const phase of ['product-plan', 'plan-implementation', 'plan-execution']) {
      const negative = planningContractCases.find(
        item =>
          item.rule === 'R10' &&
          item.planning_phase === phase &&
          item.expected_verdict === 'request_changes',
      );
      const control = planningContractCases.find(
        item =>
          item.rule === 'R10' &&
          item.planning_phase === phase &&
          item.expected_verdict === 'approve',
      );
      const basePlan = (plan: string | undefined) =>
        plan?.split(/Approval (?:receipt:|of )/u, 1)[0]?.trim();
      expect(basePlan(negative?.reviewed_plan)).toBe(basePlan(control?.reviewed_plan));
    }
    expect(
      planningContractCases.filter(item => item.rule === 'R13').map(item => item.expected_verdict),
    ).toEqual(['request_changes', 'request_changes', 'approve']);
    expect(planningContractCases.map(item => item.id)).toEqual([
      ...new Set(planningContractCases.map(item => item.id)),
    ]);
  });

  it('requires two agreeing correct judged verdicts and never calls one pass enough', () => {
    const expected = planningContractCases[0];
    expect(expected).toBeDefined();
    if (expected === undefined) return;
    const correct = {
      verdict: expected.expected_verdict,
      scope_expanded: false,
      judge_correct: true,
    };
    const wrong = { ...correct, judge_correct: false };
    expect(scorePlanningCase(expected, [correct, correct, wrong], manifest)).toBe('pass');
    expect(scorePlanningCase(expected, [correct, wrong, wrong], manifest)).toBe('inconclusive');
    expect(
      scorePlanningCase(
        expected,
        [
          {
            ...correct,
            verdict: expected.expected_verdict === 'approve' ? 'request_changes' : 'approve',
          },
          correct,
          wrong,
        ],
        manifest,
      ),
    ).toBe('inconclusive');
  });
});
