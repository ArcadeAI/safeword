import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  assertPlanningEval,
  runPlanningEval,
  selectedPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const cases = {
  'Product Plan/spec': 'r10-downstream-claim',
  'Implementation Plan': 'r10-implementation-downstream-claim',
  'Execution Plan': 'r10-execution-downstream-claim',
} as const;

const namedClaims: Record<string, RegExp> = {
  'r10-downstream-claim': /technical feasibility and approved design/iu,
  'r10-implementation-downstream-claim': /completed implementation and release approval/iu,
  'r10-execution-downstream-claim': /passed verification and merge authority/iu,
};

Given(
  /^(Product Plan\/spec|Implementation Plan|Execution Plan) has passed its own review$/,
  function (this: SafewordWorld, artifact: keyof typeof cases) {
    const caseId = cases[artifact];
    assert.ok(caseId, `Unknown planning artifact: ${artifact}`);
    const evaluationCase = selectPlanningEval(this, caseId);
    assert.match(evaluationCase.context, /passed its own/iu);
  },
);

When(
  /^a judged semantic reviewer evaluation checks a receipt that claims (.+)$/,
  { timeout: 240_000 },
  function (this: SafewordWorld, downstreamClaim: string) {
    assert.ok(selectedPlanningEval(this).reviewed_plan.includes(downstreamClaim));
    runPlanningEval(this);
  },
);

Then(
  'the receipt is rejected with the unsupported downstream claim named',
  function (this: SafewordWorld) {
    const evaluationCase = selectedPlanningEval(this);
    const finding = namedClaims[evaluationCase.id];
    assert.ok(finding);
    assertPlanningEval(this, 'request_changes', finding);
  },
);

Given(
  'a coherent Implementation Plan has passed its own design review',
  function (this: SafewordWorld) {
    const evaluationCase = selectPlanningEval(this, 'r10-bounded-implementation-approval');
    assert.match(evaluationCase.context, /passed its own design review/iu);
  },
);

When(
  'a judged semantic reviewer evaluation checks a receipt claiming only the accepted coherent implementation design',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    const evaluationCase = selectedPlanningEval(this);
    assert.match(evaluationCase.reviewed_plan, /accepts the coherent implementation design only/iu);
    runPlanningEval(this);
  },
);

Then(
  'the receipt is accepted as a bounded Implementation Plan approval',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve');
  },
);
