import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../packages/cli/src/review/execution-plan-conformance.js';
import { prepareReviewPacket } from '../packages/cli/src/review/packet.js';
import { writePlanningInventories } from '../packages/cli/tests/planning-fixtures.js';
import type { SafewordWorld } from './world.js';

type Phase = 'Product Plan' | 'Implementation Plan' | 'Execution Plan';
interface ContextState {
  phase: Phase;
  packetState: string;
  root?: string;
  packet?: ReturnType<typeof prepareReviewPacket>['packet'];
  failure?: unknown;
}

const states = new WeakMap<SafewordWorld, ContextState>();
const ticketDirectory = '.project/tickets/CTX123-current-context';
const executionCase = EXECUTION_PLAN_CONFORMANCE_CASES.find(
  value => value.id === 'one-coherent-change',
);
assert.ok(executionCase, 'The canonical Execution Plan fixture must exist.');

function createProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-4200-context-'));
  writePlanningInventories(root);
  const ticket = path.join(root, ticketDirectory);
  mkdirSync(ticket, { recursive: true });
  mkdirSync(path.join(root, 'features'));
  writeFileSync(
    path.join(ticket, 'ticket.md'),
    `---\nid: CTX123\ntype: feature\nphase: intake\nstatus: in_progress\nproduct_plan_contract: v1\nscope: preserve authenticated approval\nout_of_scope: new approval authority\ndone_when: current context reaches review\nphase_anchors:\n  - scenario-gate: features/current-context.feature\n---\n# Ticket\n`,
  );
  writeFileSync(
    path.join(ticket, 'spec.md'),
    `# Product Plan: Preserve approval\n\n<!-- safeword:product-plan-contract:v1 -->\n\n## Product Bet\n\n- **Expected outcome:** Builders advance with current approval.\n- **Persona outcome inventory:** Builder receives approval or a named refusal.\n- **Known facts:** Approval authenticates the current source.\n- **Assumptions:** Review latency is acceptable.\n- **Unresolved product decisions:** none\n- **Success threshold:** Current approval advances.\n- **Project non-goals:** No new approval authority.\n\n## Jobs To Be Done\n\n### approval.BU1 — Trust approval\n\n**Persona:** Builder (BU)\n\n> When I request approval, I want current evidence, so I can trust advancement.\n\n#### approval.BU1.R1 — Preserve approval\n\nOnly current approval advances.\n\n## Surfaces\n\nAffected:\n- Safeword CLI\n`,
  );
  writeFileSync(
    path.join(ticket, 'impl-plan.md'),
    '# Implementation Plan\n\n## Approach\n\nPreserve authenticated approval.\n\n## Architecture applicability\n\nskip: No durable architecture records apply.\n\n## Data applicability\n\nskip: No product data is stored.\n',
  );
  writeFileSync(path.join(ticket, 'execution-plan.md'), executionCase.execution_plan);
  writeFileSync(
    path.join(root, 'features/current-context.feature'),
    'Feature: Trust current approval\n  Scenario: Approval\n    Given a current review\n    When the Builder requests approval\n    Then the current context reaches review\n',
  );
  return root;
}

function target(phase: Phase): {
  kind: 'quality-review' | 'plan-implementation' | 'plan-execution';
  path: string;
} {
  if (phase === 'Product Plan')
    return { kind: 'quality-review', path: `${ticketDirectory}/spec.md` };
  if (phase === 'Implementation Plan')
    return { kind: 'plan-implementation', path: `${ticketDirectory}/impl-plan.md` };
  return { kind: 'plan-execution', path: `${ticketDirectory}/execution-plan.md` };
}

function current(world: SafewordWorld): ContextState {
  const state = states.get(world);
  assert.ok(state, 'The scenario must select a planning phase and packet state.');
  return state;
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state?.root) rmSync(state.root, { recursive: true, force: true });
  states.delete(this);
});

Given(
  /^a (Product Plan|Implementation Plan|Execution Plan) review packet (.+)$/,
  function (this: SafewordWorld, phase: Phase, packetState: string) {
    states.set(this, { phase, packetState });
  },
);

When('review dispatch is prepared', function (this: SafewordWorld) {
  const state = current(this);
  const root = createProject();
  state.root = root;
  if (state.packetState === 'omits one required current input')
    rmSync(path.join(root, '.project/personas.md'));
  if (state.packetState === 'omits the accepted Implementation Plan')
    rmSync(path.join(root, ticketDirectory, 'impl-plan.md'));
  if (state.packetState === 'omits a conditionally required input whose trigger applies') {
    const planPath = path.join(root, ticketDirectory, 'impl-plan.md');
    writeFileSync(
      planPath,
      readFileSync(planPath, 'utf8').replace(
        'skip: No product data is stored.',
        'Product data is stored; review the data guide.',
      ),
    );
  }
  const selected = target(state.phase);
  const context =
    state.phase === 'Execution Plan'
      ? [
          ...(state.packetState === 'omits the accepted Implementation Plan'
            ? []
            : [`${ticketDirectory}/impl-plan.md`]),
          'features/current-context.feature',
        ]
      : [];
  try {
    const prepared = prepareReviewPacket(root, selected.kind, [selected.path], context);
    state.packet = prepared.packet;
    prepared.cleanup();
  } catch (error) {
    state.failure = error;
  }
});

Then('dispatch is blocked until that current context is included', function (this: SafewordWorld) {
  const state = current(this);
  assert.equal(state.packet, undefined, 'An incomplete packet must not enter review.');
  const expectedRole =
    state.packetState === 'omits a conditionally required input whose trigger applies'
      ? 'data'
      : state.packetState === 'omits the accepted Implementation Plan'
        ? 'accepted-upstream-plan'
        : 'personas';
  if (expectedRole === 'accepted-upstream-plan') {
    assert.match(String(state.failure), /impl-plan\.md/u);
    return;
  }
  assert.equal((state.failure as { code?: string })?.code, 'missing_planning_context');
  assert.equal((state.failure as { contextRole?: string })?.contextRole, expectedRole);
});

Then('dispatch proceeds to the semantic reviewer', function (this: SafewordWorld) {
  const state = current(this);
  assert.equal(state.failure, undefined, String(state.failure));
  assert.equal(
    state.packet?.planning_phase,
    target(state.phase).kind === 'quality-review' ? 'product-plan' : target(state.phase).kind,
  );
  assert.ok(
    state.packet?.planning_context,
    'The reviewer packet must carry resolved planning roles.',
  );
  const absences = state.packet.planning_context.absences;
  if (
    state.packetState ===
    'omits a conditionally required input whose trigger does not apply and records the justified absence'
  )
    assert.ok(
      absences.some(value => value.role === 'data' && value.reason.includes('No product data')),
    );
  if (
    state.packetState === 'omits an optional supporting input while including every required input'
  )
    assert.ok(
      absences.some(value => value.role === 'dimensions' && value.reason.includes('no dimensions')),
    );
});
