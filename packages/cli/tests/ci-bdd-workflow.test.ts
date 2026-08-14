/**
 * CI wiring guard: supported Node versions keep package coverage, while the
 * identical cross-stack Cucumber acceptance lane runs exactly once.
 */

import { describe, expect, it } from 'vitest';

import { readGitHubWorkflow, requiredJob } from './helpers/github-workflow.js';

describe('CI BDD acceptance assignment', () => {
  it('keeps both supported Node package suites but runs Cucumber once', () => {
    const testJob = requiredJob(readGitHubWorkflow('ci.yml'), 'test');
    const acceptanceSteps = (testJob.steps ?? []).filter(
      step => step.name === 'Acceptance lane (cucumber)',
    );

    expect(testJob.strategy?.matrix?.['node-version']).toEqual(['22.23.2', '24.18.1']);
    expect(acceptanceSteps).toEqual([
      {
        name: 'Acceptance lane (cucumber)',
        if: "matrix.node-version == '24.18.1'",
        run: 'bun run test:bdd',
      },
    ]);
  });
});
