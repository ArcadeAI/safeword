import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema';
import { evaluateRemoteTestWorkflow } from '../../src/test-execution/remote-workflow-contract';

const workflowPath = nodePath.join(process.cwd(), 'templates', 'workflows', 'remote-tests.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const dogfoodWorkflow = readFileSync(
  nodePath.join(process.cwd(), '..', '..', '.github', 'workflows', 'safeword-remote-tests.yml'),
  'utf8',
);

function replace(from: string | RegExp, to: string): string {
  const candidate = workflow.replace(from, () => to);
  expect(candidate).not.toBe(workflow);
  return candidate;
}

describe('remote workflow contract', () => {
  it('accepts the schema-catalogued bundled workflow', () => {
    const definition = SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-remote-tests.yml'];

    expect(definition?.template).toBe('workflows/remote-tests.yml');
    expect(definition?.generator).toBeTypeOf('function');
    expect(definition?.generator?.({} as never)).toBeUndefined();
    expect(evaluateRemoteTestWorkflow(workflow)).toEqual({ accepted: true, violations: [] });
    expect(dogfoodWorkflow).toBe(workflow);
    expect(evaluateRemoteTestWorkflow(dogfoodWorkflow)).toEqual({ accepted: true, violations: [] });
  });

  it('installs the checked-out project dependencies before running tests', () => {
    expect(workflow).toContain(
      '      - name: Install project dependencies\n        run: bun install --frozen-lockfile',
    );
    expect(workflow.indexOf('Install project dependencies')).toBeLessThan(
      workflow.indexOf('Run requested test lane'),
    );
  });

  it.each([
    [
      'adds a trigger',
      'on:\n  workflow_dispatch:',
      'on:\n  push:\n  workflow_dispatch:',
      'manual_dispatch_only',
    ],
    [
      'adds workflow defaults',
      'permissions:',
      'defaults:\n  run:\n    shell: sh\n\npermissions:',
      'fixed_workflow_shape',
    ],
    [
      'defaults an input',
      '        required: true\n        type: string',
      '        required: true\n        default: main\n        type: string',
      'required_inputs',
    ],
    [
      'misbinds validation input',
      'TARGET_SHA: ${{ inputs.target_sha }}',
      'TARGET_SHA: ${{ inputs.lane }}',
      'exact_input_bindings',
    ],
    [
      'removes request validation',
      '[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1',
      'true',
      'fixed_validation',
    ],
    [
      'misbinds checkout ref',
      'ref: ${{ inputs.target_sha }}',
      'ref: ${{ github.sha }}',
      'exact_checkout_ref',
    ],
    [
      'adds a checkout option',
      '          fetch-depth: 1',
      '          fetch-depth: 1\n          submodules: recursive',
      'exact_checkout_options',
    ],
    [
      'overrides job permissions',
      '    runs-on: ubuntu-latest',
      '    permissions:\n      contents: write\n    runs-on: ubuntu-latest',
      'single_read_only_job',
    ],
    [
      'adds a job environment',
      '    runs-on: ubuntu-latest',
      '    runs-on: ubuntu-latest\n    env:\n      NODE_OPTIONS: --require ./forge.js',
      'single_read_only_job',
    ],
    [
      'changes the runner label',
      '    runs-on: ubuntu-latest',
      '    runs-on: self-hosted',
      'single_read_only_job',
    ],
    [
      'uses a local action',
      'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6',
      './setup-bun',
      'remote_actions_only',
    ],
    [
      'uses a reusable workflow',
      '    runs-on: ubuntu-latest',
      '    uses: owner/repository/.github/workflows/test.yml@0123456789012345678901234567890123456789',
      'single_read_only_job',
    ],
    [
      'continues after a failed test',
      '        id: tests',
      '        id: tests\n        continue-on-error: true',
      'fail_stop',
    ],
    [
      'changes a step condition',
      '        if: always()',
      '        if: success()',
      'fixed_conditions',
    ],
    [
      'injects an expression into shell',
      'run: bunx safeword@0.78.3',
      'run: echo "${{ inputs.lane }}" && bunx safeword@0.78.3',
      'shell_env_only',
    ],
    [
      'changes the test command',
      'project test --lane "$LANE" --execution local',
      'project test --lane full --execution local',
      'fixed_test_command',
    ],
    [
      'changes the dependency install command',
      'bun install --frozen-lockfile',
      'bun install',
      'fixed_dependency_install',
    ],
    [
      'fabricates the verified revision',
      'observed_sha="$(git rev-parse HEAD)"',
      'observed_sha="$TARGET_SHA"',
      'fixed_revision_verification',
    ],
    [
      'adds an execution step',
      '      - name: Run requested test lane',
      '      - name: Change revision\n        run: git checkout main\n\n      - name: Run requested test lane',
      'fixed_step_shape',
    ],
    [
      'changes a result key',
      '            schema_version: 1,',
      '            version: 1,',
      'fixed_result_protocol',
    ],
    [
      'overrides the computed result',
      "          require('node:fs').writeFileSync(",
      "          result.status = 'passed';\n          require('node:fs').writeFileSync(",
      'fixed_result_protocol',
    ],
    [
      'changes the artifact name',
      '          name: safeword-remote-test-result',
      '          name: other-result',
      'fixed_result_protocol',
    ],
    [
      'changes the artifact path',
      '          path: safeword-remote-test-result.json',
      '          path: other-result.json',
      'fixed_result_protocol',
    ],
    [
      'references the whole secrets context',
      '    runs-on: ubuntu-latest',
      '    env:\n      ALL_SECRETS: ${{ toJSON(secrets) }}\n    runs-on: ubuntu-latest',
      'secret_free',
    ],
    [
      'references an uppercase secrets context',
      '    runs-on: ubuntu-latest',
      '    env:\n      TOKEN: ${{ SECRETS.GITHUB_TOKEN }}\n    runs-on: ubuntu-latest',
      'secret_free',
    ],
    [
      'references a secret with bracket notation',
      '    runs-on: ubuntu-latest',
      "    env:\n      TOKEN: ${{ secrets['SAFEWORD_TOKEN'] }}\n    runs-on: ubuntu-latest",
      'secret_free',
    ],
    [
      'references a secret after a literal brace',
      '    runs-on: ubuntu-latest',
      "    env:\n      TOKEN: ${{ format('{0}', secrets.TOKEN) }}\n    runs-on: ubuntu-latest",
      'secret_free',
    ],
  ])('rejects a candidate that %s', (_label, from, to, violation) => {
    const result = evaluateRemoteTestWorkflow(replace(from, to));

    expect(result.accepted).toBe(false);
    expect(result.violations).toContain(violation);
  });

  it('rejects a candidate that runs tests before revision verification', () => {
    const candidate = workflow.replace(
      /( {6}- name: Verify checked-out revision[\s\S]*?)( {6}- name: Set up Bun[\s\S]*?)(?= {6}- name: Write remote test result)/u,
      (_match, verify: string, tests: string) => `${tests}${verify}`,
    );

    expect(candidate).not.toBe(workflow);
    expect(evaluateRemoteTestWorkflow(candidate).violations).toContain('fixed_step_shape');
  });

  it('allows comments that describe the secret-free contract', () => {
    const candidate = workflow.replace(
      'permissions:',
      '# No secrets are passed to this job.\npermissions:',
    );

    expect(evaluateRemoteTestWorkflow(candidate)).toEqual({ accepted: true, violations: [] });
  });

  it('allows descriptions that name the secret-free contract', () => {
    const candidate = workflow.replace('Full commit SHA to test', 'Full commit SHA; no secrets');

    expect(evaluateRemoteTestWorkflow(candidate)).toEqual({ accepted: true, violations: [] });
  });
});
