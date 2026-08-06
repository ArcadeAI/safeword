import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { createPrReviewSmokeFixture } from '../../src/pr-review/smoke-fixture.js';
import { getTemplatesDirectory, readFile } from '../../src/utils/fs.js';

interface Step extends Record<string, unknown> {
  env: Record<string, string>;
  name?: string;
  run?: string;
}

interface Job extends Record<string, unknown> {
  steps?: Step[];
  with?: Record<string, unknown>;
}

interface Workflow extends Record<string, unknown> {
  jobs: Record<string, Job>;
  on: Record<string, Record<string, Record<string, { type: string }>>>;
}

function namedStep(workflow: Workflow, job: string, name: string): Step {
  const step = workflow.jobs[job]?.steps?.find(candidate => candidate.name === name);
  if (step === undefined) throw new Error(`missing ${job}/${name}`);
  return step;
}

describe('disposable advisory PR review fixture', () => {
  it('derives from canonical workflows and limits drift to three bounded probes', () => {
    const templatesDirectory = getTemplatesDirectory();
    const routerSource = readFile(nodePath.join(templatesDirectory, 'workflows/pr-review.yml'));
    const workerSource = readFile(
      nodePath.join(templatesDirectory, 'workflows/pr-review-worker.yml'),
    );
    const fixture = createPrReviewSmokeFixture('0.0.0-smoke');

    expect(fixture.router).toBe(routerSource.replaceAll('__SAFEWORD_VERSION__', '0.0.0-smoke'));

    const canonicalWorker = YAML.parse(
      workerSource.replaceAll('__SAFEWORD_VERSION__', '0.0.0-smoke'),
    ) as Workflow;
    const fixtureWorker = YAML.parse(fixture.worker) as Workflow;
    for (const [job, name] of [
      ['invalidate', 'Invalidate any obsolete advisory route'],
      ['inspect', 'Inspect bounded evidence without GitHub write authority'],
      ['publish', 'Publish one ordinary pull-request comment'],
    ] as const) {
      const canonicalStep = namedStep(canonicalWorker, job, name);
      const fixtureStep = namedStep(fixtureWorker, job, name);
      fixtureStep.run = canonicalStep.run;
      fixtureStep.env = canonicalStep.env;
    }
    expect(fixtureWorker).toEqual(canonicalWorker);
  });

  it('projects the scheduled caller onto a manually dispatchable smoke sweep', () => {
    const templatesDirectory = getTemplatesDirectory();
    const router = YAML.parse(
      readFile(nodePath.join(templatesDirectory, 'workflows/pr-review.yml')),
    ) as Workflow;
    const sweep = YAML.parse(createPrReviewSmokeFixture('0.0.0-smoke').sweep) as Workflow;
    const expected = structuredClone(router.jobs['scheduled-review']);
    if (expected?.with === undefined) throw new Error('missing scheduled-review inputs');
    delete expected.needs;
    delete expected.if;
    delete expected.strategy;
    expected.with.pull_number = '${{ inputs.pull_number }}';

    expect(sweep.jobs['scheduled-review']).toEqual(expected);
    expect(sweep).toMatchObject({
      on: { workflow_dispatch: { inputs: { pull_number: { type: 'number' } } } },
    });
  });
});
