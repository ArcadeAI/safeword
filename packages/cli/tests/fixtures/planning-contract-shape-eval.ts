import type { PlanningContractCase } from '../../scripts/lib/planning-contracts-eval.js';
import { PLANNING_CONTRACTS } from '../../src/planning/contracts.generated.js';
import type { PlanningContract, PlanningPhase } from '../../src/planning/phase-contract.js';

const boundary =
  'Each canonical planning contract must explicitly declare purpose, entry criteria, required content, prohibited content, review question, approval meaning, invalidating changes, and return path. Each approval is bounded to its own phase: Product accepts complete behavior for accepted personas; Implementation accepts coherent design; Execution accepts startable, provable delivery. It cannot certify downstream approval or completion.';
const context =
  'The artifact is a canonical planning contract, not a concrete project plan. Evaluate whether its stated responsibilities and approval authority are complete and coherent. Do not demand project-specific design, tasks, or execution evidence from a phase contract.';

function shapeCase(
  id: string,
  contract: object,
  expectedVerdict: PlanningContractCase['expected_verdict'],
  authority: string,
): PlanningContractCase {
  return {
    id,
    rule: 'R10',
    kind: 'quality-review',
    planning_phase: undefined,
    accepted_boundary: boundary,
    context,
    reviewed_plan: JSON.stringify(contract),
    expected_verdict: expectedVerdict,
    allowed_finding_authority: authority,
    forbidden_scope_expansion:
      'Do not invent project behavior, demand concrete implementation or execution proof, or grant downstream approval authority.',
  };
}

const phases: readonly PlanningPhase[] = ['product-plan', 'plan-implementation', 'plan-execution'];
const omissions = [
  ['reviewQuestion', 'review question'],
  ['prohibitedContent', 'prohibited content'],
  ['returnPath', 'return path'],
] as const satisfies readonly (readonly [keyof PlanningContract, string])[];

export const planningContractShapeCases: readonly PlanningContractCase[] = [
  ...phases.map(phase =>
    shapeCase(
      `r10-shape-${phase}`,
      PLANNING_CONTRACTS[phase],
      'approve',
      'All eight required elements are explicit, and approval remains bounded to this planning phase.',
    ),
  ),
  ...omissions.map(([field, label]) => {
    if (!Object.hasOwn(PLANNING_CONTRACTS['product-plan'], field))
      throw new Error(`Missing negative control field ${field}`);
    const contract: Record<string, unknown> = { ...PLANNING_CONTRACTS['product-plan'] };
    Reflect.deleteProperty(contract, field);
    return shapeCase(
      `r10-shape-missing-${field}`,
      contract,
      'request_changes',
      `The canonical contract omits its required ${label}; the finding must name that missing element.`,
    );
  }),
];
