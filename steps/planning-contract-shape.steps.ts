import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { PLANNING_CONTRACTS } from '../packages/cli/src/planning/contracts.generated.js';
import {
  assertPlanningEval,
  runPlanningEval,
  selectedPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const phases = {
  'Product Plan/spec': {
    phase: 'product-plan',
    claim: 'the right complete behavior for accepted personas',
    meaning:
      /behavior is ready for scenario definition.*not scenario acceptance, design approval, startable delivery, or completion/iu,
  },
  'Implementation Plan': {
    phase: 'plan-implementation',
    claim: 'the accepted coherent implementation design',
    meaning:
      /approach is ready for Execution Planning.*does not approve delivery sequencing, coding, verification, merge, or deployment/iu,
  },
  'Execution Plan': {
    phase: 'plan-execution',
    claim: 'startable and provable delivery of the accepted design',
    meaning:
      /authorizes its bounded coding work when the configured authority permits it.*does not establish implementation, verification, merge, promotion, or deployment completion/iu,
  },
} as const;
const omissions = {
  'its review question': { field: 'reviewQuestion', finding: /review\s*question/iu },
  'prohibited content': { field: 'prohibitedContent', finding: /prohibited\s*content/iu },
  'its return path': { field: 'returnPath', finding: /return\s*path/iu },
} as const;

Given(
  /^the canonical (Product Plan\/spec|Implementation Plan|Execution Plan) contract is presented$/,
  function (this: SafewordWorld, artifact: keyof typeof phases) {
    const { phase } = phases[artifact];
    const evaluation = selectPlanningEval(this, `r10-shape-${phase}`);
    const contract = PLANNING_CONTRACTS[phase];
    assert.equal(evaluation.reviewed_plan, JSON.stringify(contract));
    for (const field of [
      'purpose',
      'entryCriteria',
      'requiredContent',
      'prohibitedContent',
      'reviewQuestion',
      'approvalMeaning',
      'invalidation',
      'returnPath',
    ] as const) {
      assert.ok(Object.hasOwn(contract, field), `Canonical ${phase} lacks ${field}`);
      assert.ok(contract[field].trim(), `Canonical ${phase} has empty ${field}`);
    }
    assert.match(contract.approvalMeaning, phases[artifact].meaning);
  },
);

Given(
  /^a canonical planning contract omits (its review question|prohibited content|its return path)$/,
  function (this: SafewordWorld, requiredElement: keyof typeof omissions) {
    const { field } = omissions[requiredElement];
    assert.ok(Object.hasOwn(PLANNING_CONTRACTS['product-plan'], field));
    const evaluation = selectPlanningEval(this, `r10-shape-missing-${field}`);
    const supplied = JSON.parse(evaluation.reviewed_plan) as Record<string, unknown>;
    const expected: Record<string, unknown> = { ...PLANNING_CONTRACTS['product-plan'] };
    delete expected[field];
    assert.deepEqual(supplied, expected);
    assert.equal(Object.hasOwn(supplied, field), false);
  },
);

When(
  'a judged semantic reviewer evaluation checks its completeness against the canonical contract-shape rubric',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then(
  /^it declares purpose, entry requirements, required and prohibited content, its review question, approval meaning, invalidating changes, and return path and limits approval to (.+)$/,
  function (this: SafewordWorld, approvedClaim: string) {
    const evaluation = selectedPlanningEval(this);
    const phase = Object.values(phases).find(item => `r10-shape-${item.phase}` === evaluation.id);
    assert.ok(phase);
    assert.equal(approvedClaim, phase.claim);
    assertPlanningEval(this, 'approve');
  },
);

Then(
  /^the contract is rejected with the missing (its review question|prohibited content|its return path) named$/,
  function (this: SafewordWorld, requiredElement: keyof typeof omissions) {
    const { field, finding } = omissions[requiredElement];
    assert.equal(selectedPlanningEval(this).id, `r10-shape-missing-${field}`);
    assertPlanningEval(this, 'request_changes', finding);
  },
);
