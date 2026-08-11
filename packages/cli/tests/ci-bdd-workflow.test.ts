/**
 * CI wiring guard: supported Node versions keep package coverage, while the
 * identical cross-stack Cucumber acceptance lane runs exactly once.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = nodePath.resolve(import.meta.dirname, '../../../.github/workflows/ci.yml');

interface WorkflowStep {
  if?: string;
  name?: string;
  run?: string;
}

interface Workflow {
  jobs: {
    test: {
      steps: WorkflowStep[];
      strategy: { matrix: { 'node-version': string[] } };
    };
  };
}

describe('CI BDD acceptance assignment', () => {
  it('keeps both supported Node package suites but runs Cucumber once', () => {
    const workflow = parse(readFileSync(workflowPath, 'utf8')) as Workflow;
    const testJob = workflow.jobs.test;
    const acceptanceSteps = testJob.steps.filter(
      step => step.name === 'Acceptance lane (cucumber)',
    );

    expect(testJob.strategy.matrix['node-version']).toEqual(['22.23.2', '24.18.1']);
    expect(acceptanceSteps).toEqual([
      {
        name: 'Acceptance lane (cucumber)',
        if: "matrix.node-version == '24.18.1'",
        run: 'bun run test:bdd',
      },
    ]);
  });
});
