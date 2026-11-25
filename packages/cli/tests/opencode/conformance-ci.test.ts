import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = nodePath.resolve(import.meta.dirname, '../../../../.github/workflows/ci.yml');

interface WorkflowStep {
  readonly ['continue-on-error']?: boolean;
  readonly if?: string;
  readonly name?: string;
  readonly run?: string;
}

interface Workflow {
  readonly jobs: Record<
    string,
    {
      readonly ['continue-on-error']?: boolean;
      readonly if?: string;
      readonly name?: string;
      readonly needs?: readonly string[];
      readonly steps?: readonly WorkflowStep[];
    }
  >;
}

describe('OpenCode V2 component CI lane', () => {
  function workflow(): Workflow {
    return parse(readFileSync(workflowPath, 'utf8')) as Workflow;
  }

  it('runs public retirement boundaries and V2 controller controls unconditionally', () => {
    const job = workflow().jobs['opencode-conformance'];

    expect(job).toMatchObject({ name: 'OpenCode V2 boundary checks' });
    expect(job?.if).toBeUndefined();
    expect(job?.['continue-on-error']).toBeUndefined();
    expect(job?.steps?.some(candidate => candidate.name === 'Build')).toBe(true);
    const conformanceStep = job?.steps?.find(
      candidate => candidate.name === 'Check V2 controller and retired V1 delivery',
    );
    expect(conformanceStep?.if).toBeUndefined();
    expect(conformanceStep?.['continue-on-error']).toBeUndefined();
    const script = conformanceStep?.run;
    expect(script).toContain('tests/opencode/retirement.test.ts');
    expect(script).toContain('tests/opencode/conformance.test.ts');
    expect(script).not.toContain('|| true');
  });

  it.each(['deploy-retro-relay', 'deploy-retro-collector'])(
    'blocks %s on OpenCode conformance',
    name => {
      expect(workflow().jobs[name]?.needs).toContain('opencode-conformance');
    },
  );
});
