import { createHash } from 'node:crypto';

import { parseDocument } from 'yaml';

export interface RemoteWorkflowContractResult {
  accepted: boolean;
  violations: string[];
}

type Mapping = Record<string, unknown>;

const FULL_SHA = /^[0-9a-f]{40}$/u;
const CHECKOUT = 'actions/checkout';
const CHECKOUT_ACTION = 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const SETUP_NODE_ACTION = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const INPUT_SHA = '${{ inputs.target_sha }}';
const INPUT_LANE = '${{ inputs.lane }}';
const RESULT_FILE = 'safeword-remote-test-result.json';
const UPLOAD_ACTION = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const VALIDATE_COMMAND =
  '[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1\n' +
  '[[ "$LANE" == "done" || "$LANE" == "full" ]] || exit 1\n';
const VERIFY_COMMAND =
  'observed_sha="$(git rev-parse HEAD)"\n' +
  'echo "observed_sha=$observed_sha" >> "$GITHUB_OUTPUT"\n' +
  '[[ "$observed_sha" == "$TARGET_SHA" ]]\n';
// Recompute with SHA-256 over the exact report step `run` string in remote-tests.yml.
const REPORT_COMMAND_SHA256 = 'b1cba179d7c3921553cb748e1c1759e2711f7aeef977317ec71515c6bd3608c9';

function mapping(value: unknown): Mapping | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Mapping)
    : undefined;
}

function hasExactKeys(value: Mapping | undefined, expected: string[]): boolean {
  const actual = Object.keys(value ?? {});
  return actual.length === expected.length && actual.every(key => expected.includes(key));
}

function hasExactEntries(value: Mapping | undefined, expected: Mapping): boolean {
  return (
    hasExactKeys(value, Object.keys(expected)) &&
    Object.entries(expected).every(([key, expectedValue]) => value?.[key] === expectedValue)
  );
}

function actionReference(value: unknown): { owner: string; revision: string } | undefined {
  if (typeof value !== 'string' || value.startsWith('./') || value.startsWith('docker://')) {
    return undefined;
  }
  const separator = value.lastIndexOf('@');
  if (separator < 1) return undefined;
  return { owner: value.slice(0, separator), revision: value.slice(separator + 1) };
}

function dispatchViolations(workflow: Mapping): string[] {
  const trigger = mapping(workflow.on);
  const inputs = mapping(mapping(trigger?.workflow_dispatch)?.inputs);
  const invalidInput = ['lane', 'target_sha'].some(name => {
    const input = mapping(inputs?.[name]);
    return input?.required !== true || input.type !== 'string' || 'default' in (input ?? {});
  });
  return [
    ...(hasExactKeys(trigger, ['workflow_dispatch']) ? [] : ['manual_dispatch_only']),
    ...(hasExactKeys(inputs, ['lane', 'target_sha']) && !invalidInput ? [] : ['required_inputs']),
  ];
}

function jobViolations(workflow: Mapping): { job: Mapping | undefined; violations: string[] } {
  const permissions = mapping(workflow.permissions);
  const jobs = mapping(workflow.jobs);
  const job = mapping(jobs?.test);
  const readOnly = hasExactKeys(permissions, ['contents']) && permissions?.contents === 'read';
  const fixedWorkflow = hasExactKeys(workflow, ['name', 'on', 'permissions', 'jobs']);
  const singleJob =
    hasExactKeys(jobs, ['test']) &&
    job !== undefined &&
    hasExactKeys(job, ['runs-on', 'steps']) &&
    job['runs-on'] === 'ubuntu-latest';
  return {
    job,
    violations: [
      ...(readOnly ? [] : ['contents_read_only']),
      ...(fixedWorkflow ? [] : ['fixed_workflow_shape']),
      ...(singleJob ? [] : ['single_read_only_job']),
    ],
  };
}

function checkoutViolations(checkout: Mapping | undefined): string[] {
  if (!checkout) return ['checkout_required'];
  const with_ = mapping(checkout.with);
  return [
    ...(with_?.['persist-credentials'] === false ? [] : ['checkout_credentials']),
    ...(with_?.ref === INPUT_SHA ? [] : ['exact_checkout_ref']),
    ...(with_?.['fetch-depth'] === 1 ? [] : ['shallow_checkout']),
    ...(hasExactEntries(with_, {
      ref: INPUT_SHA,
      'fetch-depth': 1,
      'persist-credentials': false,
    })
      ? []
      : ['exact_checkout_options']),
  ];
}

function actionViolations(job: Mapping | undefined): string[] {
  const rawSteps = Array.isArray(job?.steps) ? job.steps : [];
  const steps = rawSteps.map(step => mapping(step));
  const actionSteps = steps.filter(step => step?.uses !== undefined);
  const actions = actionSteps.map(step => actionReference(step?.uses));
  const checkoutSteps = steps.filter(step => actionReference(step?.uses)?.owner === CHECKOUT);
  return [
    ...(steps.includes(undefined) ? ['valid_steps'] : []),
    ...(actionSteps.length === actions.filter(Boolean).length ? [] : ['remote_actions_only']),
    ...(actions.some(action => !action || !FULL_SHA.test(action.revision))
      ? ['immutable_actions']
      : []),
    ...checkoutViolations(checkoutSteps.length === 1 ? checkoutSteps[0] : undefined),
  ];
}

function workflowSteps(job: Mapping | undefined): Mapping[] {
  if (!Array.isArray(job?.steps)) return [];
  return job.steps.map(step => mapping(step)).filter(step => step !== undefined);
}

function stepById(steps: Mapping[], id: string): Mapping | undefined {
  return steps.find(step => step.id === id);
}

interface StepShape {
  id?: string;
  uses?: string;
  keys: string[];
  with?: Mapping;
}

const STEP_SHAPES: StepShape[] = [
  { id: 'validate', keys: ['name', 'id', 'env', 'run'] },
  { id: 'checkout', uses: CHECKOUT_ACTION, keys: ['name', 'id', 'uses', 'with'] },
  { id: 'verify', keys: ['name', 'id', 'env', 'run'] },
  {
    uses: SETUP_NODE_ACTION,
    keys: ['name', 'uses', 'with'],
    with: { 'node-version': 24 },
  },
  { id: 'tests', keys: ['name', 'id', 'env', 'run'] },
  { id: 'report', keys: ['name', 'id', 'if', 'env', 'run'] },
  { uses: UPLOAD_ACTION, keys: ['name', 'if', 'uses', 'with'] },
];

function hasFixedStepShape(steps: Mapping[]): boolean {
  return (
    steps.length === STEP_SHAPES.length &&
    STEP_SHAPES.every((expected, index) => {
      const step = steps[index];
      if (!step) return false;
      return (
        step?.id === expected.id &&
        step.uses === expected.uses &&
        hasExactKeys(step, [...expected.keys]) &&
        (!expected.with || hasExactEntries(mapping(step.with), expected.with))
      );
    })
  );
}

function inputBindingViolations(steps: Mapping[]): string[] {
  const validate = stepById(steps, 'validate');
  const verify = stepById(steps, 'verify');
  const tests = stepById(steps, 'tests');
  const report = stepById(steps, 'report');
  const valid =
    hasExactEntries(mapping(validate?.env), { TARGET_SHA: INPUT_SHA, LANE: INPUT_LANE }) &&
    hasExactEntries(mapping(verify?.env), { TARGET_SHA: INPUT_SHA }) &&
    hasExactEntries(mapping(tests?.env), { LANE: INPUT_LANE }) &&
    hasExactEntries(mapping(report?.env), {
      TARGET_SHA: INPUT_SHA,
      LANE: INPUT_LANE,
      VALIDATION_OUTCOME: '${{ steps.validate.outcome }}',
      CHECKOUT_OUTCOME: '${{ steps.checkout.outcome }}',
      VERIFY_OUTCOME: '${{ steps.verify.outcome }}',
      OBSERVED_SHA: '${{ steps.verify.outputs.observed_sha }}',
      TEST_OUTCOME: '${{ steps.tests.outcome }}',
    });
  return valid ? [] : ['exact_input_bindings'];
}

function hasInvalidCondition(steps: Mapping[]): boolean {
  return steps.some(step => {
    const expected = step.id === 'report' || step.uses === UPLOAD_ACTION ? 'always()' : undefined;
    return step.if !== expected;
  });
}

function hasUnsafeShell(steps: Mapping[]): boolean {
  return steps.some(step => typeof step.run === 'string' && step.run.includes('${{'));
}

function commandViolations(steps: Mapping[]): string[] {
  const testRun = stepById(steps, 'tests')?.run;
  const violations = [
    ...(stepById(steps, 'validate')?.run === VALIDATE_COMMAND ? [] : ['fixed_validation']),
    ...(stepById(steps, 'verify')?.run === VERIFY_COMMAND ? [] : ['fixed_revision_verification']),
  ];
  return testRun ===
    'npx --yes safeword@0.83.1 project test --lane "$LANE" --execution local --prepare-remote'
    ? violations
    : [...violations, 'fixed_test_command'];
}

function executionViolations(steps: Mapping[]): string[] {
  return [
    ...(steps.some(step => step['continue-on-error'] !== undefined) ? ['fail_stop'] : []),
    ...(hasInvalidCondition(steps) ? ['fixed_conditions'] : []),
    ...(hasUnsafeShell(steps) ? ['shell_env_only'] : []),
    ...commandViolations(steps),
    ...(hasFixedStepShape(steps) ? [] : ['fixed_step_shape']),
  ];
}

function hasFixedUpload(steps: Mapping[]): boolean {
  const uploadWith = mapping(steps.find(step => step.uses === UPLOAD_ACTION)?.with);
  return hasExactEntries(uploadWith, {
    name: 'safeword-remote-test-result',
    path: RESULT_FILE,
    'if-no-files-found': 'error',
  });
}

function resultViolations(steps: Mapping[]): string[] {
  const reportRun = stepById(steps, 'report')?.run;
  const reportValid =
    typeof reportRun === 'string' &&
    createHash('sha256').update(reportRun).digest('hex') === REPORT_COMMAND_SHA256;
  return reportValid && hasFixedUpload(steps) ? [] : ['fixed_result_protocol'];
}

function hasSecretsKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(item => hasSecretsKey(item));
  const object = mapping(value);
  return object
    ? Object.entries(object).some(([key, child]) => key === 'secrets' || hasSecretsKey(child))
    : false;
}

function hasSecretExpression(value: unknown): boolean {
  if (typeof value === 'string') {
    return /\$\{\{[\s\S]*\bsecrets(?:\s*[.()[\]]|\s*\}\})/iu.test(value);
  }
  if (Array.isArray(value)) return value.some(item => hasSecretExpression(item));
  const object = mapping(value);
  return object ? Object.values(object).some(child => hasSecretExpression(child)) : false;
}

function secretViolations(workflow: Mapping): string[] {
  return hasSecretsKey(workflow) || hasSecretExpression(workflow) ? ['secret_free'] : [];
}

export function evaluateRemoteTestWorkflow(source: string): RemoteWorkflowContractResult {
  let workflow: Mapping | undefined;
  try {
    const document = parseDocument(source, { uniqueKeys: true });
    workflow = document.errors.length === 0 ? mapping(document.toJS()) : undefined;
  } catch {
    workflow = undefined;
  }
  if (!workflow) return { accepted: false, violations: ['invalid_yaml'] };

  const job = jobViolations(workflow);
  const steps = workflowSteps(job.job);
  const violations = [
    ...dispatchViolations(workflow),
    ...job.violations,
    ...actionViolations(job.job),
    ...inputBindingViolations(steps),
    ...executionViolations(steps),
    ...resultViolations(steps),
    ...secretViolations(workflow),
  ];
  const uniqueViolations = [...new Set(violations)];
  return { accepted: uniqueViolations.length === 0, violations: uniqueViolations };
}
