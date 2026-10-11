import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

Given(
  'a recorded architecture, data, testing, domain, or research suggestion proposes a decision required by accepted behavior',
  function (this: SafewordWorld) {
    const selected = selectPlanningEval(this, 'r15-required-proof-decision');
    assert.equal(selected.kind, 'plan-execution');
    assert.match(selected.accepted_boundary, /CLI denial must return a nonzero exit code/u);
    assert.match(selected.reviewed_plan, /Execution-owned proof decision/u);
    assert.match(selected.reviewed_plan, /invoke the actual CLI against the real endpoint/u);
  },
);

Given(
  'a recorded architecture, data, testing, domain, or research suggestion proposes a capability outside accepted behavior whose exclusion would change the accepted outcome',
  function (this: SafewordWorld) {
    const selected = selectPlanningEval(this, 'r15-consequential-scope-choice');
    assert.equal(selected.kind, 'plan-implementation');
    assert.match(
      selected.accepted_boundary,
      /excluded a new target-owner authorization capability/u,
    );
    assert.match(selected.context, /never the target owner/u);
    assert.match(selected.reviewed_plan, /User-owned scope choice remains pending/u);
    assert.match(selected.reviewed_plan, /not selected as architecture, a delivery task/u);
  },
);

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

Then(
  'the decision is surfaced and resolved in its owning plan',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve');
    selectPlanningEval(this, 'r15-missing-required-proof-decision');
    runPlanningEval(this);
    const runs = assertPlanningEval(this, 'request_changes');
    assert.ok(
      runs.filter(run =>
        run.reviewer.findings.some(
          finding => /CLI/iu.test(finding) && /denial|refusal|exit.code/iu.test(finding),
        ),
      ).length >= 2,
      'Two correct judged findings must reject endpoint-only proof for the accepted CLI denial.',
    );
  },
);

Then(
  'the capability is surfaced as a user-owned scope choice and does not enter the plan',
  function (this: SafewordWorld) {
    const runs = assertPlanningEval(this, 'request_changes');
    assert.ok(
      runs.filter(run =>
        run.reviewer.findings.some(
          finding =>
            /target.owner|owner consent/iu.test(finding) &&
            /user.owned|user (?:must )?(?:decide|choose|authorize)|scope choice|decision owner:\s*(?:the )?user/iu.test(
              finding,
            ),
        ),
      ).length >= 2,
      'Two correct judged findings must name the consent conflict and its user-owned scope boundary.',
    );
  },
);
