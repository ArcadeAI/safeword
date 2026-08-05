import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const templatesDirectory = nodePath.join(import.meta.dirname, '../../templates/workflows');
const routerPath = nodePath.join(templatesDirectory, 'pr-review.yml');
const workerPath = nodePath.join(templatesDirectory, 'pr-review-worker.yml');

describe('advisory PR review workflow contract', () => {
  it('ships a router and a reusable worker with one per-PR privilege boundary', () => {
    expect(existsSync(routerPath), 'missing PR review router template').toBe(true);
    expect(existsSync(workerPath), 'missing reusable PR review worker template').toBe(true);

    const router = YAML.parse(readFileSync(routerPath, 'utf8')) as Record<string, unknown>;
    const worker = YAML.parse(readFileSync(workerPath, 'utf8')) as Record<string, unknown>;

    expect(router).toMatchObject({
      on: {
        pull_request_target: {
          types: ['opened', 'reopened', 'synchronize', 'ready_for_review', 'converted_to_draft'],
        },
        schedule: [{ cron: '*/5 * * * *' }],
      },
      jobs: {
        'event-review': {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
        },
        'scheduled-review': {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
        },
      },
    });
    expect(worker).toMatchObject({
      on: {
        workflow_call: {
          inputs: {
            pull_number: { required: true, type: 'number' },
            cancel_in_progress: { required: true, type: 'boolean' },
          },
        },
      },
      concurrency: {
        group: 'pr-review-${{ inputs.pull_number }}',
        'cancel-in-progress': '${{ inputs.cancel_in_progress }}',
      },
      jobs: {
        inspect: {
          environment: { name: 'safeword-pr-review-model', deployment: false },
          permissions: { contents: 'read', 'pull-requests': 'read' },
        },
        publish: {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
        },
      },
    });

    const workerSource = readFileSync(workerPath, 'utf8');
    expect(workerSource).not.toMatch(/actions\/checkout|gh pr checkout|git fetch/);

    const workerJobs = worker.jobs as Record<string, Record<string, unknown>>;
    for (const jobName of ['invalidate', 'publish']) {
      const writeCapableJob = workerJobs[jobName];
      expect(writeCapableJob.environment).toBeUndefined();
      expect(JSON.stringify(writeCapableJob)).not.toContain('safeword-pr-review-model');
      expect(JSON.stringify(writeCapableJob)).not.toContain('secrets.');
    }
  });
});
