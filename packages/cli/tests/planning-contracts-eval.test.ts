import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  planningContractCorpusDigest,
  planningContractRubricDigest,
  type PlanningEvalManifest,
  planningJudgeRubricDigest,
  scorePlanningCase,
} from '../scripts/lib/planning-contracts-eval.js';
import { planningContractCases } from './fixtures/planning-contracts-eval.js';

const manifest = JSON.parse(
  readFileSync(
    nodePath.resolve(import.meta.dirname, 'fixtures/planning-contracts-eval/manifest.json'),
    'utf8',
  ),
) as PlanningEvalManifest;

describe('planning contracts eval contract', () => {
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
      max_turns: 3,
      tools_disabled: true,
      session_persistence: false,
    });
    expect(new Set(planningContractCases.map(item => item.rule))).toEqual(
      new Set(['R7', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16']),
    );
    expect(planningContractCases.filter(item => item.rule === 'R7')).toHaveLength(3);
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
