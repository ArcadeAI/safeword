import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const cases = {
  'has at least one accepted scenario for every applicable outcome':
    'r16-scenario-complete-coverage',
  'has no accepted scenario for the Non-Technical Builder recovery outcome':
    'r16-scenario-missing-recovery',
} as const;

Given(
  /^an approved Product Plan persona-outcome inventory (.+)$/u,
  function (this: SafewordWorld, coverage: keyof typeof cases) {
    const selected = selectPlanningEval(this, cases[coverage]);
    assert.equal(selected.kind, 'scenario-gate');
    assert.match(
      selected.context,
      /Non-Technical Builder recovery returns to a pending change after obtaining fresh consent/u,
    );
    const hasRecovery = selected.reviewed_plan.includes('Scenario: Non-Technical Builder Recovery');
    assert.equal(hasRecovery, selected.expected_verdict === 'approve');
  },
);

When(
  'the scenario gate evaluates behavior coverage',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then('scenario coverage does not block approval', function (this: SafewordWorld) {
  assertPlanningEval(this, 'approve');
});

Then(
  'scenario approval is blocked with that uncovered recovery outcome named',
  function (this: SafewordWorld) {
    const runs = assertPlanningEval(this, 'request_changes');
    const namesRecovery = /Non[- ]Technical Builder.*recover|recover.*Non[- ]Technical Builder/iu;
    assert.ok(
      runs.filter(run => run.reviewer.findings.some(finding => namesRecovery.test(finding)))
        .length >= 2,
      'At least two correct judged rejections must name this persona and recovery in one finding.',
    );
  },
);
