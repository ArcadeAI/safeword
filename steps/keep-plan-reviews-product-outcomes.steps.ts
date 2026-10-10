import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const inventories = {
  "inventories every accepted persona's consequential success, refusal, failure, approval, trust, and recovery outcomes":
    'r16-complete-persona-outcomes',
  "marks the Non-Technical Builder's approval outcome explicitly inapplicable with a stated reason and inventories the rest":
    'r16-explicitly-inapplicable-approval',
  "omits the Non-Technical Builder's recovery outcome": 'r16-missing-persona-recovery',
} as const;

Given(
  /^the Product Plan accepts a Technical Builder and a Non-Technical Builder and (.+)$/,
  function (this: SafewordWorld, inventory: keyof typeof inventories) {
    const caseId = inventories[inventory];
    assert.ok(caseId, `Unknown persona inventory: ${inventory}`);
    const packet = selectPlanningEval(this, caseId);
    assert.match(packet.context, /Technical Builder and Non-Technical Builder/u);
    assert.match(packet.reviewed_plan, /recovery/u);
    if (caseId === 'r16-explicitly-inapplicable-approval') {
      assert.match(packet.reviewed_plan, /approval is inapplicable because/u);
      assert.doesNotMatch(packet.reviewed_plan, /each have defined.*approval/u);
      assert.match(packet.reviewed_plan, /observer-only persona cannot authorize/u);
    }
    if (caseId === 'r16-missing-persona-recovery')
      assert.match(packet.reviewed_plan, /Non-Technical Builder recovery is absent/u);
  },
);

Given(
  /^the Product Plan contains known facts, assumptions, and unresolved product decisions and (presents an assumption as a known fact|keeps known facts, assumptions, and unresolved product decisions distinct)$/,
  function (this: SafewordWorld, epistemicState: string) {
    const packet = selectPlanningEval(
      this,
      epistemicState.startsWith('presents')
        ? 'r16-assumption-as-fact'
        : 'r16-complete-persona-outcomes',
    );
    assert.match(packet.reviewed_plan, /Known fact:/u);
    assert.match(packet.reviewed_plan, /Assumption(?:s)?:/u);
    assert.match(packet.reviewed_plan, /Unresolved (?:product )?decision(?:s)?:/u);
    if (epistemicState.startsWith('presents'))
      assert.match(
        packet.reviewed_plan,
        /Known fact: Every builder can recover an expired consent token without assistance/u,
      );
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical Product Plan completeness rubric',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then(
  'persona-outcome completeness does not block Product Plan approval',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve');
  },
);

Then('epistemic status does not block Product Plan approval', function (this: SafewordWorld) {
  assertPlanningEval(this, 'approve');
});

Then(
  'Product Plan approval is blocked naming that missing recovery outcome and reports no scenario-coverage verdict',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'request_changes', /Non-Technical Builder.{0,90}recovery/isu);
  },
);

Then(
  'Product Plan approval is blocked with the epistemic-status defect named',
  function (this: SafewordWorld) {
    assertPlanningEval(
      this,
      'request_changes',
      /(?=.*(?:assum|unsupported|unproven))(?=.*fact)/isu,
    );
  },
);
