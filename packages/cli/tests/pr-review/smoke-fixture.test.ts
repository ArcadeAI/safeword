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
  it('emits a complete runnable review configuration', () => {
    const fixture = createPrReviewSmokeFixture('0.0.0-smoke');

    expect(JSON.parse(fixture.config)).toEqual({
      prReview: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.2',
        maxTotalBytes: 100_000,
        requiredChecks: [],
      },
    });
  });

  it('derives from canonical workflows and limits drift to bounded command probes', () => {
    const templatesDirectory = getTemplatesDirectory();
    const publisherSource = readFile(
      nodePath.join(templatesDirectory, 'workflows/pr-review-publisher.yml'),
    );
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
    const fixtureInspect = namedStep(
      fixtureWorker,
      'inspect',
      'Inspect bounded evidence without GitHub write authority',
    );
    expect(fixtureInspect.env).toMatchObject({
      GH_TOKEN: '${{ github.token }}',
      GITHUB_TOKEN: '${{ github.token }}',
      SAFEWORD_PR_NUMBER: '${{ inputs.pull_number }}',
    });
    expect(fixtureInspect.run).toContain('inspection-input.json');
    expect(fixtureInspect.run).toContain('full-file context did not match the exact fork blob');
    expect(fixtureInspect.run).toContain("grep -q 'HTTP 403'");
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

    const canonicalPublisher = YAML.parse(
      publisherSource.replaceAll('__SAFEWORD_VERSION__', '0.0.0-smoke'),
    ) as Workflow;
    const fixturePublisher = YAML.parse(fixture.publisher) as Workflow;
    for (const name of [
      'Invalidate any obsolete advisory route',
      'Publish one ordinary pull-request comment',
    ]) {
      const canonicalStep = namedStep(canonicalPublisher, 'publish-event-result', name);
      const fixtureStep = namedStep(fixturePublisher, 'publish-event-result', name);
      fixtureStep.run = canonicalStep.run;
      fixtureStep.env = canonicalStep.env;
    }
    expect(fixturePublisher).toEqual(canonicalPublisher);
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
    expected.with.pull_number = '${{ fromJSON(inputs.pull_number) }}';

    expect(sweep.jobs['scheduled-review']).toEqual(expected);
    expect(sweep).toMatchObject({
      on: { workflow_dispatch: { inputs: { pull_number: { type: 'string' } } } },
    });
  });
});
