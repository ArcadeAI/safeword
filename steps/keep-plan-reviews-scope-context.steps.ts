import { strict as assert } from 'node:assert';
import { rmSync } from 'node:fs';

import { Given, Then, When } from '@cucumber/cucumber';

import { createScopeContextProject } from './support/planning-scope-project.js';
import {
  assertPlanningEval,
  runPlanningEval,
  selectPlanningEval,
} from './support/planning-eval.js';
import type { SafewordWorld } from './world.js';

const cases = {
  'preserves every binding boundary in those supplied sources': 'r12-complete-scope-context',
  'the supplied ticket context omits its positive scope': 'r12-missing-ticket-scope',
  'the supplied ticket context omits its exclusions': 'r12-missing-ticket-exclusions',
  'the supplied project context omits its non-goals': 'r12-missing-project-non-goals',
  'the supplied milestone context omits its non-goals': 'r12-missing-milestone-non-goals',
  'the supplied parent context omits its inherited boundary': 'r12-missing-parent-boundary',
} as const;

function capturedScopePacket(caseId: string) {
  const roots: string[] = [];
  try {
    return createScopeContextProject(caseId, roots).input;
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
}

Given(
  /^a child plan is bound by ticket scope, ticket exclusions, project non-goals, milestone non-goals, and inherited parent boundaries and its review packet includes every structurally required role and path but (.+)$/,
  function (this: SafewordWorld, state: keyof typeof cases) {
    const caseId = cases[state];
    assert.ok(caseId, `Unknown scope context: ${state}`);
    selectPlanningEval(this, caseId, capturedScopePacket(caseId));
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical accepted-boundary completeness rubric to the packet',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    runPlanningEval(this);
  },
);

Then(
  'missing boundary context does not block review dispatch or approval',
  function (this: SafewordWorld) {
    assertPlanningEval(this, 'approve');
  },
);

Then(
  /^review cannot approve and names the (missing ticket scope|missing ticket boundary|missing project boundary|missing milestone boundary|unchecked inherited boundary)$/,
  function (this: SafewordWorld, missing: string) {
    const expected = {
      'missing ticket scope': /(?=.*ticket)(?=.*scope)/isu,
      'missing ticket boundary': /(?=.*ticket)(?=.*(?:exclu|boundar))/isu,
      'missing project boundary': /(?=.*project)(?=.*(?:non.goal|boundar))/isu,
      'missing milestone boundary': /(?=.*milestone)(?=.*(?:non.goal|boundar))/isu,
      'unchecked inherited boundary': /(?:parent|inherited)/iu,
    };
    assertPlanningEval(this, 'request_changes', expected[missing as keyof typeof expected]);
  },
);
