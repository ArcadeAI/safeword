import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createRedSemanticFixture,
  matchesRedSemanticExpectation,
  RED_SEMANTIC_CASES,
  type RedSemanticCase,
} from '../fixtures/executable-red-semantic.js';

interface ReportStep {
  keyword: string;
  result: { status: string; error_message?: string };
}

function assertOutcomeError(testCase: RedSemanticCase, steps: ReportStep[] | undefined): void {
  if (!('error' in testCase)) return;
  // Both fixtures share a message; their assertion values must still distinguish them.
  const outcome = steps?.find(step => step.keyword.trim() === 'Then');
  expect(outcome?.result.error_message).toContain(testCase.error);
}

describe('executable RED semantic fixtures', () => {
  it.each(RED_SEMANTIC_CASES)('$id reaches its declared Cucumber boundary', testCase => {
    const fixture = createRedSemanticFixture(testCase);
    try {
      const executed = spawnSync(fixture.argv[0] ?? '', fixture.argv.slice(1), {
        cwd: fixture.directory,
        encoding: 'utf8',
        timeout: 10_000,
      });
      expect(executed.error).toBeUndefined();
      expect(executed.status, executed.stderr).toBe(1);
      const report = JSON.parse(
        readFileSync(nodePath.join(fixture.directory, 'run-report.json'), 'utf8'),
      ) as {
        elements: { steps: ReportStep[] }[];
      }[];
      const scenario = report[0]?.elements[0];
      const steps = scenario?.steps.filter(step =>
        ['Given', 'When', 'Then'].includes(step.keyword.trim()),
      );
      expect(steps?.map(step => step.keyword.trim())).toEqual(['Given', 'When', 'Then']);
      expect(steps?.map(step => step.result.status)).toEqual(testCase.steps);
      assertOutcomeError(testCase, steps);
      expect(`${executed.stdout}${executed.stderr}`).toContain(fixture.expectedFailure);
      expect(existsSync(nodePath.join(fixture.directory, 'actor-invoked'))).toBe(
        testCase.id === 'actor-assertion' || testCase.id === 'unrelated-assertion',
      );
      if (testCase.id === 'setup-failure') {
        expect(
          scenario?.steps
            .filter(step => step.keyword.trim() === 'Before')
            .map(hook => hook.result.status),
        ).toEqual(['failed']);
      }
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });

  it.each(['approve', 'request_changes'] as const)(
    'accepts a matching independent %s verdict and gate',
    verdict => {
      const approved = verdict === 'approve';
      expect(
        matchesRedSemanticExpectation(verdict, 'claude', {
          reviewer: 'claude',
          independence: 'cross-agent',
          verdict,
          status: approved ? 'approved' : 'changes_requested',
          gate: approved ? 'approved' : 'blocked',
        }),
      ).toBe(true);
    },
  );

  it.each([
    {
      name: 'always-approve',
      expected: 'request_changes',
      verdict: 'approve',
      status: 'approved',
      gate: 'approved',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
    {
      name: 'always-reject',
      expected: 'approve',
      verdict: 'request_changes',
      status: 'changes_requested',
      gate: 'blocked',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
    {
      name: 'gate-only rejection',
      expected: 'request_changes',
      verdict: undefined,
      status: 'blocked',
      gate: 'blocked',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
    {
      name: 'wrong reviewer',
      expected: 'request_changes',
      verdict: 'request_changes',
      status: 'changes_requested',
      gate: 'blocked',
      reviewer: 'codex',
      independence: 'cross-agent',
    },
    {
      name: 'degraded review',
      expected: 'request_changes',
      verdict: 'request_changes',
      status: 'changes_requested',
      gate: 'blocked',
      reviewer: 'claude',
      independence: 'degraded',
    },
    {
      name: 'wrong verdict',
      expected: 'request_changes',
      verdict: 'approve',
      status: 'changes_requested',
      gate: 'blocked',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
    {
      name: 'wrong status',
      expected: 'request_changes',
      verdict: 'request_changes',
      status: 'approved',
      gate: 'blocked',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
    {
      name: 'wrong gate',
      expected: 'request_changes',
      verdict: 'request_changes',
      status: 'changes_requested',
      gate: 'approved',
      reviewer: 'claude',
      independence: 'cross-agent',
    },
  ] as const)('rejects a $name observation', ({ expected, ...observed }) => {
    expect(matchesRedSemanticExpectation(expected, 'claude', observed)).toBe(false);
  });
});
