import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const cases = {
  'a requirement accepted upstream is unmet': 'r11-unmet-accepted-requirement',
  'an optional resilience improvement outside accepted scope': 'r11-optional-architecture',
  'a replacement architecture selected only by the reviewer': 'r11-optional-architecture',
  'a uniquely determined correction under an accepted decision':
    'r11-uniquely-determined-correction',
} as const;

Given(
  /^a recorded planning-review finding of (.+)$/,
  function (this: SafewordWorld, finding: keyof typeof cases) {
    const caseId = cases[finding];
    assert.ok(caseId, `Unknown finding authority case: ${finding}`);
    const evaluationCase = selectPlanningEval(this, caseId);
    if (caseId !== 'r11-optional-architecture') {
      assert.match(evaluationCase.accepted_boundary, /manual\.BU1\.R1/u);
      assert.equal(evaluationCase.expected_verdict, 'request_changes');
      assert.match(
        evaluationCase.reviewed_plan,
        caseId === 'r11-unmet-accepted-requirement'
          ? /without checking consent/u
          : /after the account write/u,
      );
      assert.doesNotMatch(
        evaluationCase.reviewed_plan,
        /checks a consent token linked to the requesting user and target account before any write/u,
      );
      return;
    }
    assert.match(
      evaluationCase.context,
      /Reviewer preference: replace the consent-token API with a new event bus for resilience/u,
    );
    assert.match(evaluationCase.reviewed_plan, /consent-token API/u);
    assert.match(evaluationCase.accepted_boundary, /explicit user authorization/u);
    assert.equal(evaluationCase.expected_verdict, 'approve');
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical finding-authority rubric against the accepted contract and scope',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then(
  'the suggestion remains nonblocking until the user accepts it',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve', undefined, /event[ -]?bus/iu);
  },
);

Then(
  'the review blocks with the violated Rule, defect, unresolved choice, and constraints named',
  function (this: SafewordWorld) {
    assertPlanningEval(
      this,
      'request_changes',
      /(?=.*manual\.BU1\.R1)(?=.*(?:authoriz|consent|token))(?=.*(?:before|unchecked|without))(?=.*(?:user|owner))(?=.*account)(?=.*(?:unresolved|undecided|binding|bound|tie|link))(?=.*(?:migration|background|existing.{0,20}(?:token|API)))/isu,
    );
  },
);

Then(
  'the review blocks with the uniquely determined correction named',
  function (this: SafewordWorld) {
    assertPlanningEval(
      this,
      'request_changes',
      /(?=.*(?:consent|token|authoriz))(?=.*after)(?=.*before)(?=.*(?:write|mutation))/isu,
    );
  },
);

Then(
  'the reviewer-authored decision is recorded as a nonblocking suggestion and the review does not block on it',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve', undefined, /event[ -]?bus/iu);
  },
);
