/** CI workflow contract for independently visible release and quality gates. */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = nodePath.resolve(import.meta.dirname, '../../../.github/workflows/ci.yml');

interface WorkflowStep {
  'continue-on-error'?: boolean;
  if?: string | boolean;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowJob {
  'continue-on-error'?: boolean;
  name?: string;
  if?: string;
  steps?: WorkflowStep[];
  'timeout-minutes'?: number;
  needs?: string | string[];
}

function workflowJobs(): Record<string, WorkflowJob> {
  const workflow = parse(readFileSync(workflowPath, 'utf8')) as {
    jobs?: Record<string, WorkflowJob>;
  };
  return workflow.jobs ?? {};
}

function requiredJob(jobs: Record<string, WorkflowJob>, name: string): WorkflowJob {
  const job = jobs[name];
  if (job === undefined) throw new Error(`missing ${name} job`);
  return job;
}

function requiredStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = job.steps?.find(candidate => candidate.name === name);
  if (step === undefined) throw new Error(`missing ${name} step`);
  return step;
}

describe('CI workflow contract', () => {
  it('runs high-severity dependency auditing as an independent CI job', () => {
    const jobs = workflowJobs();
    const job = requiredJob(jobs, 'dependency-audit');
    const auditStep = requiredStep(job, 'Block high and critical advisories');

    expect(job.if).toBeUndefined();
    expect(job['continue-on-error']).toBeUndefined();
    expect(auditStep.run?.replaceAll(/\s+/gu, ' ').trim()).toBe('bun audit --audit-level high');
    expect(auditStep['continue-on-error']).toBeUndefined();
    expect(auditStep.if).toBeUndefined();
    expect(requiredJob(jobs, 'deploy-retro-relay').needs).toContain('dependency-audit');
  });

  it('runs the all-mode parity check in a standalone job', () => {
    const job = workflowJobs()['dogfood-parity'];

    expect(job).toBeDefined();
    expect(job?.steps?.some(step => step.run?.includes('parity-check.ts --mode=all'))).toBe(true);
  });

  it('runs one stable unconditional CLI contract context', () => {
    const jobs = workflowJobs();
    const job = jobs['cli-contract'];

    expect(job).toBeDefined();
    expect(job?.name).toBe('CLI contract');
    expect(job?.['timeout-minutes']).toBe(5);
    expect(job?.if).toBeUndefined();
    expect(
      job?.steps?.some(
        step => step.uses === 'actions/checkout@v7' && step.with?.['fetch-depth'] === 0,
      ),
    ).toBe(true);
    expect(job?.steps?.filter(step => step.run === 'bun run check:cli-contract')).toHaveLength(1);
    expect(
      Object.values(jobs)
        .flatMap(candidate => candidate.steps ?? [])
        .filter(step => step.run === 'bun run check:cli-contract'),
    ).toHaveLength(1);
  });
});
