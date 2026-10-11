import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { assessRecoveryReport } from '../../src/review/ledger-recovery-report.js';

// Synthetic parser controls, never signed observations or actor-facing proof.
const census = JSON.parse(
  readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../../../../.project/tickets/V2ZPV1-recover-accurate-completion-evidence/case-census.json',
    ),
    'utf8',
  ),
) as {
  cases: {
    name: string;
    sourceLines: number[];
    caseDigest: string;
    status: string;
    proofMapping?: { definitions: { text: string; definition: string }[] };
  }[];
};
const active = census.cases.filter(item => item.status === 'active-proof-unmapped');
const deferred = census.cases.find(item => item.status !== 'active-proof-unmapped');
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Synthetic control is missing required fixture data.');
  return value;
}
function passingReport() {
  return [
    {
      uri: 'features/keep-plan-reviews-current-and-trustworthy.feature',
      elements: active.map(item => ({
        name: item.name,
        line: item.sourceLines.at(-1),
        steps: required(item.proofMapping).definitions.map(step => ({
          name: step.text,
          match: { location: step.definition },
          result: { status: 'passed' },
        })),
      })),
    },
  ];
}

describe('exact current-scope recovery report contract', () => {
  it('summarizes precisely the pinned 142 active cases without certifying deferred cases', () => {
    expect(
      assessRecoveryReport(passingReport(), 0),
      'The exact active report must produce a bounded summary',
    ).toEqual({ passed: 142, deferred: 33, cases: active.map(item => item.caseDigest) });
  });
  it('refuses a same-count replacement by a deferred Examples row', () => {
    const report = passingReport();
    const replacement = required(deferred);
    required(required(report[0]).elements[0]).name = replacement.name;
    required(required(report[0]).elements[0]).line = replacement.sourceLines.at(-1);
    expect(required(report[0]).elements).toHaveLength(142);
    expect(assessRecoveryReport(report, 0)).toBeUndefined();
  });
  it('refuses duplicates even with 142 results', () => {
    const report = passingReport();
    required(report[0]).elements[1] = required(required(report[0]).elements[0]);
    expect(assessRecoveryReport(report, 0)).toBeUndefined();
  });
  it('refuses skipped steps and failed hidden hooks', () => {
    const skipped = passingReport();
    required(required(required(skipped[0]).elements[0]).steps[0]).result.status = 'skipped';
    expect(assessRecoveryReport(skipped, 0)).toBeUndefined();
    const hook = passingReport();
    (required(required(hook[0]).elements[0]).steps as unknown[]).push({
      hidden: true,
      keyword: 'After',
      result: { status: 'failed' },
    });
    expect(assessRecoveryReport(hook, 0)).toBeUndefined();
  });
  it('refuses missing assertions and nonzero process exit', () => {
    const report = passingReport();
    required(required(report[0]).elements[0]).steps.pop();
    expect(assessRecoveryReport(report, 0)).toBeUndefined();
    expect(assessRecoveryReport(passingReport(), 1)).toBeUndefined();
  });
});
