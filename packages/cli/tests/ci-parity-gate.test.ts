/** CI workflow contract for independently visible release and quality gates. */

import { describe, expect, it } from 'vitest';

import { readGitHubWorkflow, requiredJob, requiredStep } from './helpers/github-workflow.js';

describe('CI workflow contract', () => {
  it('runs high-severity dependency auditing as an independent CI job', () => {
    const workflow = readGitHubWorkflow('ci.yml');
    const job = requiredJob(workflow, 'dependency-audit');
    const auditStep = requiredStep(job, 'Block high and critical advisories');

    expect(job.if).toBeUndefined();
    expect(job['continue-on-error']).toBeUndefined();
    expect(auditStep.run?.replaceAll(/\s+/gu, ' ').trim()).toBe('bun audit --audit-level high');
    expect(auditStep['continue-on-error']).toBeUndefined();
    expect(auditStep.if).toBeUndefined();
    expect(requiredJob(workflow, 'deploy-retro-relay').needs).toEqual([
      'dogfood-parity',
      'cli-contract',
      'dependency-audit',
      'test',
      'lint',
      'relay-inputs',
    ]);
  });

  it('runs the all-mode parity check in a standalone job', () => {
    const job = requiredJob(readGitHubWorkflow('ci.yml'), 'dogfood-parity');

    expect(job.steps?.some(step => step.run?.includes('parity-check.ts --mode=all'))).toBe(true);
  });

  it('runs one stable unconditional CLI contract context', () => {
    const workflow = readGitHubWorkflow('ci.yml');
    const job = requiredJob(workflow, 'cli-contract');
    const jobs = workflow.jobs ?? {};

    expect(job.name).toBe('CLI contract');
    expect(job['timeout-minutes']).toBe(5);
    expect(job.if).toBeUndefined();
    expect(
      job.steps?.some(
        step => step.uses === 'actions/checkout@v7' && step.with?.['fetch-depth'] === 0,
      ),
    ).toBe(true);
    expect(job.steps?.filter(step => step.run === 'bun run check:cli-contract')).toHaveLength(1);
    expect(
      Object.values(jobs)
        .flatMap(candidate => candidate.steps ?? [])
        .filter(step => step.run === 'bun run check:cli-contract'),
    ).toHaveLength(1);
  });
});
