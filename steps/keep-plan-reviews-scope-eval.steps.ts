import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const cases = {
  'omits authorization behavior': 'r13-in-scope-omission',
  'includes automatic account migration': 'r13-out-of-scope-addition',
  'decides authorization and excludes account migration': 'r13-conforming-boundary',
} as const;

Given(
  /^an accepted boundary requires authorization and excludes automatic account migration and the plan (.+)$/,
  function (this: SafewordWorld, planState: keyof typeof cases) {
    const caseId = cases[planState];
    assert.ok(caseId, `Unknown R13 plan state: ${planState}`);
    const evaluationCase = selectPlanningEval(this, caseId);
    assert.match(evaluationCase.accepted_boundary, /explicit user authorization/u);
    assert.match(evaluationCase.accepted_boundary, /no automatic account migration/u);
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical bidirectional scope-completeness rubric to the plan',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then('approval is blocked with the in-scope omission named', function (this: SafewordWorld) {
  assertPlanningEval(this, 'request_changes', /authoriz/iu);
});

Then('approval is blocked with the out-of-scope proposal named', function (this: SafewordWorld) {
  assertPlanningEval(this, 'request_changes', /automatic.{0,20}migrat/iu);
});

Then('scope completeness does not block approval', function (this: SafewordWorld) {
  assertPlanningEval(this, 'approve');
});
