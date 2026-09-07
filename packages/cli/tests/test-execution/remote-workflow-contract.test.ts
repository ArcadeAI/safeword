import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema';
import { evaluateRemoteTestWorkflow } from '../../src/test-execution/remote-workflow-contract';
import { REMOTE_WORKFLOW_RELEASE_MANIFEST } from '../../src/test-execution/remote-workflow-state';

const workflowPath = nodePath.join(process.cwd(), 'templates', 'workflows', 'remote-tests.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const dogfoodWorkflow = readFileSync(
  nodePath.join(process.cwd(), '..', '..', '.github', 'workflows', 'safeword-remote-tests.yml'),
  'utf8',
);
const releasedV1 = readFileSync(
  nodePath.join(process.cwd(), 'tests', 'fixtures', 'remote-workflow-v1.yml'),
  'utf8',
);
const historicalFixtureDirectory = nodePath.join(process.cwd(), 'tests', 'fixtures');

function normalizedSha256(content: string): string {
  return createHash('sha256').update(content.replaceAll('\r\n', '\n')).digest('hex');
}

function replace(from: string | RegExp, to: string): string {
  const candidate = workflow.replace(from, () => to);
  expect(candidate).not.toBe(workflow);
  return candidate;
}

describe('remote workflow contract', () => {
  it('preserves the released v1 workflow identity', () => {
    expect(createHash('sha256').update(releasedV1).digest('hex')).toBe(
      'ee9b263ac749f74cfa4423f4a8930f03a357e2d823c4ac271517e81c98fecd27',
    );
  });

  it('keeps an ordered identity for every released workflow fixture', () => {
    const fixtureNames = readdirSync(historicalFixtureDirectory)
      .filter(name => /^remote-workflow-v\d+\.yml$/.test(name))
      .toSorted((left, right) => left.localeCompare(right, 'en', { numeric: true }));
    const fixtureHistory = fixtureNames.map(name => ({
      version: Number(/v(\d+)\.yml$/.exec(name)?.[1]),
      normalizedSha256: normalizedSha256(
        readFileSync(nodePath.join(historicalFixtureDirectory, name), 'utf8'),
      ),
    }));

    expect(REMOTE_WORKFLOW_RELEASE_MANIFEST).toEqual([
      {
        version: 1,
        normalizedSha256: 'ee9b263ac749f74cfa4423f4a8930f03a357e2d823c4ac271517e81c98fecd27',
      },
      {
        version: 2,
        normalizedSha256: 'f5898559f4d57c39a7887e7061d50ebaa2cbaf86159d7c93555a6c32c6d909d9',
      },
      {
        version: 3,
        normalizedSha256: '20846fed2fa9d655c2bba660cd5f7f2fd712c34ac92523d6c40846e9a8477baf',
      },
    ]);
    expect(fixtureHistory).toEqual(REMOTE_WORKFLOW_RELEASE_MANIFEST.slice(0, -1));
    expect(normalizedSha256(workflow)).toBe(
      REMOTE_WORKFLOW_RELEASE_MANIFEST.at(-1)?.normalizedSha256,
    );
  });

  it('accepts ordinary CRLF checkout conversion', () => {
    expect(evaluateRemoteTestWorkflow(workflow.replaceAll('\n', '\r\n'))).toEqual({
      accepted: true,
      violations: [],
    });
  });

  it('returns invalid YAML when materialization rejects excessive aliases', () => {
    const aliases = Array.from({ length: 101 }, () => '*value').join(', ');

    expect(evaluateRemoteTestWorkflow(`value: &value [safe]\naliases: [${aliases}]\n`)).toEqual({
      accepted: false,
      violations: ['invalid_yaml'],
    });
  });

  it('accepts the schema-catalogued bundled workflow', () => {
    const definition = SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-remote-tests.yml'];

    expect(definition?.template).toBe('workflows/remote-tests.yml');
    expect(definition?.generator).toBeTypeOf('function');
    expect(definition?.generator?.({} as never)).toBeUndefined();
    expect(evaluateRemoteTestWorkflow(workflow)).toEqual({ accepted: true, violations: [] });
    expect(dogfoodWorkflow).toBe(workflow);
    expect(evaluateRemoteTestWorkflow(dogfoodWorkflow)).toEqual({ accepted: true, violations: [] });
  });

  it.each(['install', 'upgrade', 'uninstall', 'status', 'doctor', 'reconcile'])(
    '%s leaves the optional workflow outside ordinary reconciliation',
    () => {
      const definition =
        SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-remote-tests.yml'];

      expect(definition?.generator?.({} as never)).toBeUndefined();
    },
  );

  it('delegates project preparation to Safeword configuration', () => {
    expect(workflow).toContain('project test --lane "$LANE" --execution local --prepare-remote');
    expect(workflow).not.toContain('bun install --frozen-lockfile');
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
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
      './setup-node',
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
      'run: npx --yes safeword@0.83.1',
      'run: echo "${{ inputs.lane }}" && npx --yes safeword@0.83.1',
      'shell_env_only',
    ],
    [
      'changes the test command',
      'project test --lane "$LANE" --execution local',
      'project test --lane full --execution local',
      'fixed_test_command',
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
    [
      'references the bare secrets context',
      '    runs-on: ubuntu-latest',
      '    env:\n      TOKEN: ${{ secrets }}\n    runs-on: ubuntu-latest',
      'secret_free',
    ],
  ])('rejects a candidate that %s', (_label, from, to, violation) => {
    const result = evaluateRemoteTestWorkflow(replace(from, to));

    expect(result.accepted).toBe(false);
    expect(result.violations).toContain(violation);
  });

  it('rejects a candidate that runs tests before revision verification', () => {
    const candidate = workflow.replace(
      /( {6}- name: Verify checked-out revision[\s\S]*?)( {6}- name: Set up Safeword runtime[\s\S]*?)(?= {6}- name: Write remote test result)/u,
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
