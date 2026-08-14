import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse } from 'yaml';

export interface WorkflowStep {
  'continue-on-error'?: boolean;
  env?: Record<string, string>;
  if?: string | boolean;
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

export interface WorkflowJob {
  'continue-on-error'?: boolean;
  environment?: string;
  if?: string;
  name?: string;
  needs?: string | string[];
  outputs?: Record<string, string>;
  steps?: WorkflowStep[];
  strategy?: { matrix?: Record<string, unknown> };
  'timeout-minutes'?: number;
}

export interface GitHubWorkflow {
  concurrency?: unknown;
  jobs?: Record<string, WorkflowJob>;
  on?: unknown;
  permissions?: unknown;
}

export function readGitHubWorkflow(filename: string): GitHubWorkflow {
  const path = nodePath.resolve(import.meta.dirname, '../../../../.github/workflows', filename);
  return parse(readFileSync(path, 'utf8')) as GitHubWorkflow;
}

export function requiredJob(workflow: GitHubWorkflow, name: string): WorkflowJob {
  const job = workflow.jobs?.[name];
  if (job === undefined) throw new Error(`missing ${name} job`);
  return job;
}

export function requiredStep(job: WorkflowJob, name: string): WorkflowStep {
  const step = job.steps?.find(candidate => candidate.name === name);
  if (step === undefined) throw new Error(`missing ${name} step`);
  return step;
}
