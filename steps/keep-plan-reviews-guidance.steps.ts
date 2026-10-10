import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

Given(
  'a recorded architecture, data, testing, domain, or research suggestion proposes an unrelated capability whose exclusion does not change the accepted outcome',
  function (this: SafewordWorld) {
    const selected = selectPlanningEval(this, 'r15-guidance-candidate');
    assert.match(selected.context, /Architecture guide suggests automatic migration/u);
    assert.match(
      selected.context,
      /Excluding it does not change the accepted manual-authorization outcome/u,
    );
    assert.match(
      selected.accepted_boundary,
      /require explicit user authorization before account changes/u,
    );
    assert.doesNotMatch(selected.reviewed_plan, /automatic migration/u);
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical accepted-boundary guidance rubric to the suggestion',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then('the capability is dropped', function (this: SafewordWorld) {
  assertPlanningEval(this, 'approve', undefined, /migration/iu);
});
