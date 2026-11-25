import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  type EvaluationCase,
  type EvaluationContract,
  type EvaluationRecord,
  verifyEvaluationCorpus,
  verifyEvaluationCorpusSafety,
} from '../../scripts/lib/data-architecture-eval.js';
import { retrospectiveEvaluationGuide } from '../fixtures/retrospective-review-eval/guide.js';

const directory = path.resolve(import.meta.dirname, '../fixtures/retrospective-review-eval');
const cases = JSON.parse(
  readFileSync(path.join(directory, 'cases.json'), 'utf8'),
) as EvaluationCase[];
const contract = JSON.parse(
  readFileSync(path.join(directory, 'contract.json'), 'utf8'),
) as EvaluationContract;
const records = JSON.parse(
  readFileSync(path.join(directory, 'records.json'), 'utf8'),
) as EvaluationRecord[];
const canonicalGuide = retrospectiveEvaluationGuide();

it('regrades the complete recorded retrospective semantic corpus against current reviewer rules', () => {
  expect(verifyEvaluationCorpusSafety({ cases, contract })).toEqual({
    accepted: true,
    diagnostics: [],
  });
  expect(verifyEvaluationCorpus({ canonicalGuide, cases, contract, records })).toEqual({
    accepted: true,
    diagnostics: [],
  });
});

it.each(['approve', 'reject'])('refuses a reviewer that always returns %s', decision => {
  const corrupted = records.map(record => ({
    ...record,
    response: {
      ...record.response,
      decisionIds: [`decision.${decision}`],
    },
  }));
  const result = verifyEvaluationCorpus({ canonicalGuide, cases, contract, records: corrupted });
  expect(result.accepted).toBe(false);
  expect(result.diagnostics.join('\n')).toContain('forbidden decision');
});

it('refuses recorded decisions after the actual reviewer rules change', () => {
  const result = verifyEvaluationCorpus({
    canonicalGuide: `${canonicalGuide}\nChanged rule`,
    cases,
    contract,
    records,
  });
  expect(result.accepted).toBe(false);
  expect(result.diagnostics.join('\n')).toContain('guide hash does not match');
});

it('refuses a corpus that omits a recorded negative case', () => {
  const result = verifyEvaluationCorpus({
    canonicalGuide,
    cases,
    contract,
    records: records.slice(0, -1),
  });
  expect(result.accepted).toBe(false);
  expect(result.diagnostics.join('\n')).toContain('missing a record');
});

it('keeps per-case oracle labels out of the prompts given to the model', () => {
  for (const record of records) {
    const prompt = JSON.parse(record.prompt) as { case: Record<string, unknown>; rubric?: unknown };
    expect(Object.keys(prompt.case).toSorted((left, right) => left.localeCompare(right))).toEqual([
      'id',
      'text',
    ]);
    expect(prompt.rubric).toBeUndefined();
  }
});
