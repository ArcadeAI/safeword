import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = nodePath.resolve(import.meta.dirname, '../../../../.github/workflows/ci.yml');

interface WorkflowStep {
  readonly if?: string;
  readonly name?: string;
  readonly run?: string;
}

interface Workflow {
  readonly jobs: Record<
    string,
    { readonly if?: string; readonly name?: string; readonly steps?: readonly WorkflowStep[] }
  >;
}

describe('OpenCode conformance CI lane', () => {
  it('runs the public pinned-host conformance command as an unconditional standalone job', () => {
    const workflow = parse(readFileSync(workflowPath, 'utf8')) as Workflow;
    const job = workflow.jobs['opencode-conformance'];

    expect(job).toMatchObject({ name: 'OpenCode conformance' });
    expect(job?.if).toBeUndefined();
    const script = job?.steps?.find(step => step.name === 'Run pinned OpenCode conformance')?.run;
    expect(script).toContain('bun run --cwd packages/cli build');
    expect(script).toContain('test "$(opencode --version)" = "1.18.23"');
    expect(script).toContain('installOpenCodeProfile(process.env.OPENCODE_CONFIG_DIR)');
    expect(script).toContain('safeword conformance --agents=opencode');
    expect(script).not.toContain('continue-on-error');
    expect(script).not.toContain('|| true');
  });
});
