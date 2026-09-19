import { createHash } from 'node:crypto';

import { DELIVERY_CHECKLIST_CATEGORIES } from '../execution-plan/delivery-checklist.js';
import type { ReviewAgent, ReviewKind } from './contract.js';
import { EXECUTION_PLAN_ADMISSION_EVIDENCE } from './execution-plan-admission.generated.js';
import { reviewPromptContract } from './review-rubric.js';
import type { ReviewRoute } from './route-config.js';

const OBLIGATIONS = [
  'Accepted behavior',
  'Migration work',
  'Rollout work',
  'Rollback work',
  'Documentation work',
  'Affected-surface work',
] as const;
const DECISIONS = [
  'One shared authorization service owns permission checks for every transport.',
  'Host-neutral dependency order keeps every intermediate merge supported.',
] as const;
const ACTIVATION_PROOFS =
  'behavior-boundary, plan-integrity, failure-signals, security-boundary, rollout-rollback, and documentation-contract';
const ALL_DELIVERY_PROOFS = `data-compatibility, ${ACTIVATION_PROOFS}`;

const IMPLEMENTATION_PLAN = `# Implementation Plan

## Accepted obligations

${OBLIGATIONS.map(obligation => `- ${obligation}`).join('\n')}

## Recorded decisions

- One shared authorization service owns permission checks for every transport.
- Host-neutral dependency order keeps every intermediate merge supported.
`;

interface SliceInput {
  readonly name: string;
  readonly purpose?: string;
  readonly boundary?: string;
  readonly prerequisites?: string;
  readonly proof?: string;
  readonly completion?: string;
  readonly tasks?: readonly string[];
}

function stagedOwners(
  prerequisite: string,
  activation: string,
): Readonly<Partial<Record<(typeof OBLIGATIONS)[number], string>>> {
  return { 'Accepted behavior': activation, 'Migration work': prerequisite };
}

function slice(input: SliceInput): string {
  const tasks = input.tasks ?? [
    `1. RED: run \`bun run test tests/execution-plan.test.ts -t "${input.name}"\` with the ${input.name} fixture and observe exit 1 with \`${input.name} is not implemented\` before editing production code.`,
    `2. GREEN: implement ${input.purpose ?? input.name} within the accepted boundary, then rerun the named RED command and observe exit 0.`,
    '3. REFACTOR: remove duplication without changing the passing result, then rerun the named command and observe exit 0.',
  ];
  return `### ${input.name}

${input.purpose === undefined ? '' : `- Purpose: ${input.purpose}\n`}${
    input.boundary === undefined ? '' : `- Boundary: ${input.boundary}\n`
  }${
    input.prerequisites === undefined ? '' : `- Prerequisites: ${input.prerequisites}\n`
  }${input.proof === undefined ? '' : `- Proof: ${input.proof}\n`}${
    input.completion === undefined ? '' : `- Completion signal: ${input.completion}\n`
  }- Relies on an unmerged successor: no

#### Tasks and tests

${tasks.join('\n')}
`;
}

const CONTRACT_SLICE: SliceInput = {
  name: 'Contract',
  purpose: 'Package the canonical Execution Planning contract.',
  boundary: 'Contract template, schema registration, and generated assets.',
  prerequisites: 'none',
  proof: 'data-compatibility: package tests compare every installed contract byte.',
  completion: 'The inert contract ships and the repository remains supported.',
  tasks: [
    '1. RED: run `bun run test:schema-compatibility` with the generated-contract fixture and observe `canonical contract bytes differ` before editing templates.',
    '2. GREEN: add the canonical contract to the template registry, regenerate its mirrors, and rerun `bun run test:schema-compatibility` with exit 0.',
    '3. REFACTOR: remove duplicate contract text, regenerate the mirrors, and rerun `bun run test:schema-compatibility` with exit 0.',
  ],
};
const ACTIVATION_SLICE: SliceInput = {
  name: 'Activation',
  purpose: 'Activate typed Execution Plan review.',
  boundary:
    'Review routing, result retention, CLI presentation, failure signals, authorization, rollout, rollback, and documentation.',
  prerequisites: 'Contract',
  proof: ACTIVATION_PROOFS,
  completion: 'The accepted behavior and every activation obligation are delivered and supported.',
  tasks: [
    '1. RED: run `bun run test:review-cli` with the approved-plan fixture and observe `typed review result is unavailable` before editing review routing.',
    '2. GREEN: connect public review routing to typed result retention, then run `bun run test:review-cli`, `bun run test:failure-signals`, `bun run test:authorization-boundary`, `bun run test:rollout-rollback`, and `bun run test:documentation-contract` with exit 0.',
    '3. REFACTOR: keep one result-retention path for every caller, then rerun the five activation proof commands with exit 0.',
  ],
};

function executionPlan(input: {
  readonly decision?: 'one pull request' | 'multiple pull requests';
  readonly rationale: string;
  readonly slices: readonly SliceInput[];
  readonly omittedObligation?: (typeof OBLIGATIONS)[number];
  readonly obligationOwners?: Readonly<Partial<Record<(typeof OBLIGATIONS)[number], string>>>;
  readonly decisionText?: string;
  readonly unrelatedChecklist?: boolean;
  readonly unrealProof?: boolean;
}): string {
  const owners = OBLIGATIONS.filter(obligation => obligation !== input.omittedObligation)
    .map((obligation, index) => {
      const fallbackOwner = index === 0 ? input.slices[0] : input.slices.at(-1);
      const owner = input.obligationOwners?.[obligation] ?? fallbackOwner?.name ?? 'Contract';
      return `- ${obligation}: ${owner}`;
    })
    .join('\n');
  return `# Execution Plan

## Pull-request slicing

${input.decision === undefined ? '' : `Decision: ${input.decision}.\n`}Rationale: ${input.rationale}

${input.slices.map(item => slice(item)).join('\n')}
## Obligation ownership

${owners}

## Decision accounting

${input.decisionText ?? DECISIONS.map(decision => `- ${decision}: unchanged`).join('\n')}

${deliveryContract(input.unrelatedChecklist === true, input.unrealProof === true)}
`;
}

const CHECKLIST_OBLIGATIONS = [
  'Deliver Accepted behavior.',
  'Preserve both recorded implementation decisions.',
  'Keep slice dependencies and pull-request boundaries supported.',
  'Prove Accepted behavior at the named boundary.',
  'Complete Migration work.',
  'Expose failure signals for Affected-surface work.',
  'Protect the Affected-surface work boundary.',
  'Complete Rollout work and Rollback work.',
  'Complete Documentation work.',
  'Assign every accepted obligation to an owner.',
  'Retain concrete completion evidence for all accepted obligations.',
] as const;

const CHECKLIST_PROOFS = [
  'behavior-boundary',
  'plan-integrity',
  'plan-integrity',
  'behavior-boundary',
  'data-compatibility',
  'failure-signals',
  'security-boundary',
  'rollout-rollback',
  'documentation-contract',
  'plan-integrity',
  'plan-integrity',
] as const;

const PROOF_SPECIFICATIONS = [
  ['behavior-boundary', 'Accepted behavior at the public CLI boundary.', 'test:review-cli'],
  [
    'plan-integrity',
    'Recorded decisions, slice dependencies, obligation ownership, and completion evidence.',
    'test:execution-plan-conformance',
  ],
  [
    'data-compatibility',
    'Migration and backward-compatibility boundaries.',
    'test:schema-compatibility',
  ],
  [
    'failure-signals',
    'Observable failure signals under injected review failure.',
    'test:failure-signals',
  ],
  [
    'security-boundary',
    'Authorization and privacy behavior at the review boundary.',
    'test:authorization-boundary',
  ],
  [
    'rollout-rollback',
    'Rollout activation and rollback recovery behavior.',
    'test:rollout-rollback',
  ],
  [
    'documentation-contract',
    'Published documentation examples and links.',
    'test:documentation-contract',
  ],
] as const;

function deliveryContract(unrelated: boolean, unrealProof: boolean): string {
  const items = DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => {
    const obligation = unrelated
      ? 'Complete the standard delivery work.'
      : CHECKLIST_OBLIGATIONS[index];
    const proof = unrealProof ? 'complete-delivery' : CHECKLIST_PROOFS[index];
    return `| item-${index + 1} | ${category} | ${obligation} | contributor | ${proof} | open | missing | | |`;
  }).join('\n');
  const proofRows = unrealProof
    ? `| complete-delivery | command | E2E | Customer authorization across both live transports. | real_boundary | current_required | ${JSON.stringify(
        { type: 'command', cwd: '.', argv: ['node', '--version'] },
      )} |`
    : PROOF_SPECIFICATIONS.map(
        ([proofId, boundary, script]) =>
          `| ${proofId} | command | E2E | ${boundary} | real_boundary | current_required | ${JSON.stringify(
            { type: 'command', cwd: '.', argv: ['bun', 'run', script] },
          )} |`,
      ).join('\n');
  return `## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
${proofRows}

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${items}`;
}

export interface ExecutionPlanConformanceExpectation {
  readonly verdict: 'approve' | 'request_changes';
  readonly slicing_decision?: 'one_pull_request' | 'multiple_pull_requests';
  readonly slice_names?: readonly string[];
  readonly obligations?: readonly string[];
  readonly decisions?: readonly string[];
  readonly finding_terms?: readonly string[];
}

export interface ExecutionPlanConformanceCase {
  readonly id: string;
  readonly scenario: string;
  readonly implementation_plan: string;
  readonly execution_plan: string;
  readonly expectation: ExecutionPlanConformanceExpectation;
}

function approved(
  id: string,
  scenario: string,
  plan: string,
  slicingDecision: 'one_pull_request' | 'multiple_pull_requests',
  sliceNames: readonly string[],
): ExecutionPlanConformanceCase {
  return {
    id,
    scenario,
    implementation_plan: IMPLEMENTATION_PLAN,
    execution_plan: plan,
    expectation: {
      verdict: 'approve',
      slicing_decision: slicingDecision,
      slice_names: sliceNames,
      obligations: OBLIGATIONS,
      decisions: DECISIONS,
    },
  };
}

function denied(
  id: string,
  scenario: string,
  plan: string,
  findingTerms: readonly string[],
): ExecutionPlanConformanceCase {
  return {
    id,
    scenario,
    implementation_plan: IMPLEMENTATION_PLAN,
    execution_plan: plan,
    expectation: { verdict: 'request_changes', finding_terms: findingTerms },
  };
}

const ONE_PLAN = executionPlan({
  decision: 'one pull request',
  rationale:
    'Contract, activation, and delivery obligations form one independently provable review capability.',
  slices: [
    {
      name: 'Complete delivery',
      purpose: 'Deliver the complete typed Execution Plan review capability.',
      boundary:
        'Contract, CLI behavior, compatibility, failure signals, authorization, rollout, rollback, and documentation.',
      prerequisites: 'none',
      proof: ALL_DELIVERY_PROOFS,
      completion:
        'Every named proof command passes on the merge candidate and every checklist item has completion evidence.',
      tasks: [
        '1. RED: run `bun run test:review-cli` with the approved-plan fixture and observe `typed review result is unavailable` before editing production code.',
        '2. GREEN: add the canonical contract, wire typed review and authorization, complete migration and rollback handling, and publish the documented command; then run every proof command named by the slice with exit 0.',
        '3. REFACTOR: consolidate shared result validation without changing public output, then rerun every named proof command with exit 0.',
      ],
    },
  ],
});
const DISMISSED_APPLICABLE_WORK_PLAN = ONE_PLAN.replace(
  '| item-4 | testing | Prove Accepted behavior at the named boundary. | contributor | behavior-boundary | open | missing | | |',
  '| item-4 | testing | Prove Accepted behavior at the named boundary. | contributor |  | not_applicable | missing | | No runtime proof is needed. |',
).replace(
  '| item-11 | completion evidence | Retain concrete completion evidence for all accepted obligations. | contributor | plan-integrity | open | missing | | |',
  '| item-11 | completion evidence | Retain concrete completion evidence for all accepted obligations. | contributor | plan-integrity | open | missing | | |\n| item-12 | testing | Exercise an unrelated smoke check. | contributor | behavior-boundary | open | missing | | |',
);
const APPLICABILITY_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted proof boundaries

- Accepted behavior must be proven through behavior-boundary; this is applicable contributor work.
`;
const MULTI_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale: 'Contract delivery and activation are independently reviewable with separate proof.',
  slices: [CONTRACT_SLICE, ACTIVATION_SLICE],
  obligationOwners: stagedOwners('Contract', 'Activation'),
});
const COMPLETE_RECORD_PLAN = executionPlan({
  decision: 'one pull request',
  rationale:
    'One typed review-result capability has one cohesive boundary and independently verifiable delivery proofs.',
  slices: [
    {
      name: 'Typed review result',
      purpose: 'Deliver and retain one complete typed Execution Plan judgment.',
      boundary:
        'Result type, validation, persistence, compatibility, failure and security behavior, rollout, rollback, and documentation.',
      prerequisites: 'none',
      proof: ALL_DELIVERY_PROOFS,
      completion: 'A complete judgment round-trips and every accepted obligation is supported.',
      tasks: [
        '1. RED: run `bun run test:review-cli` with a complete-result fixture and observe `typed review result does not round-trip` before editing persistence.',
        '2. GREEN: implement schema validation and result persistence for the complete typed judgment, then run every proof command named by the slice with exit 0.',
        '3. REFACTOR: share one validator between write and read paths, then rerun every named proof command with exit 0.',
      ],
    },
  ],
});
const ORDERED_SCHEMA_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale:
    'The reader compiles only after its schema exists, while each merge remains supported.',
  slices: [
    {
      name: 'Schema',
      purpose: 'Add the inert result schema.',
      boundary: 'Types and schema only; no reader calls it.',
      prerequisites: 'none',
      proof: 'data-compatibility: schema golden tests pass.',
      completion: 'The unused schema ships without changing runtime behavior.',
      tasks: [
        '1. RED: run `bun run test:schema-compatibility` with the result-schema fixture and observe `result schema is missing` before editing schema files.',
        '2. GREEN: add the inert result schema without a runtime consumer, then rerun `bun run test:schema-compatibility` with exit 0.',
        '3. REFACTOR: remove duplicate schema declarations and rerun `bun run test:schema-compatibility` with exit 0.',
      ],
    },
    {
      name: 'Reader',
      purpose: 'Read and retain schema-valid results.',
      boundary:
        'Reader activation, persistence, failure signals, authorization, rollout, rollback, and documentation.',
      prerequisites: 'Schema',
      proof: ACTIVATION_PROOFS,
      completion: 'The reader and every activation obligation are supported.',
      tasks: [
        '1. RED: run `bun run test:review-cli` with a schema-valid result and observe `result reader is unavailable` before editing the reader.',
        '2. GREEN: read and retain schema-valid results through the public review command, then run every activation proof command with exit 0.',
        '3. REFACTOR: reuse the schema validator in the reader and rerun every activation proof command with exit 0.',
      ],
    },
  ],
  obligationOwners: stagedOwners('Schema', 'Reader'),
});
const MECHANICAL_MIRRORS_PLAN = executionPlan({
  decision: 'one pull request',
  rationale:
    'Forty generated and installed edits deliver one canonical contract with one cohesive proof set.',
  slices: [
    {
      name: 'Contract mirrors',
      purpose: 'Publish one canonical contract through every generated mirror.',
      boundary:
        'Canonical source, mechanical mirrors, compatibility, failure and security behavior, rollout, rollback, and documentation.',
      prerequisites: 'none',
      proof: ALL_DELIVERY_PROOFS,
      completion: 'All mirrors and every accepted delivery obligation are supported.',
      tasks: [
        '1. RED: run `bun run test:schema-compatibility` with the generated-mirror fixture and observe `generated contract bytes differ` before editing the canonical template.',
        '2. GREEN: update the canonical template and regenerate every registered mirror, then run every proof command named by the slice with exit 0.',
        '3. REFACTOR: remove duplicate hand-authored mirror text, regenerate, and rerun every named proof command with exit 0.',
      ],
    },
  ],
});
const FEW_FILES_TWO_OUTCOMES_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale:
    'Only two files change, but inert schema delivery and public activation are separately valuable and provable.',
  slices: [
    {
      name: 'Inert schema',
      purpose: 'Ship a typed schema without changing public behavior.',
      boundary: 'One schema file.',
      prerequisites: 'none',
      proof: 'data-compatibility: a golden test proves the schema bytes.',
      completion: 'The schema is available but unused.',
      tasks: [
        '1. RED: run `bun run test:schema-compatibility` with the public-result fixture and observe `public result schema is missing` before editing schema files.',
        '2. GREEN: add the inert public result schema, then rerun `bun run test:schema-compatibility` with exit 0.',
        '3. REFACTOR: consolidate schema declarations and rerun `bun run test:schema-compatibility` with exit 0.',
      ],
    },
    {
      name: 'Public activation',
      purpose: 'Expose the new review command.',
      boundary:
        'Public routing, failure signals, authorization, rollout, rollback, and documentation.',
      prerequisites: 'Inert schema',
      proof: ACTIVATION_PROOFS,
      completion: 'The command and every activation obligation are supported.',
      tasks: [
        '1. RED: run `bun run test:review-cli` with the public-command fixture and observe `review command is unavailable` before editing routing.',
        '2. GREEN: register the public review command and connect it to schema-valid results, then run every activation proof command with exit 0.',
        '3. REFACTOR: keep one command-routing path and rerun every activation proof command with exit 0.',
      ],
    },
  ],
  obligationOwners: stagedOwners('Inert schema', 'Public activation'),
});
const OBLIGATION_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale:
    'The inert contract is reviewable through byte-compatibility proof before the separately provable public review activation consumes it.',
  slices: [
    { ...CONTRACT_SLICE, name: 'Contract owner' },
    {
      ...ACTIVATION_SLICE,
      name: 'Release owner',
      prerequisites: 'Contract owner',
      completion: 'Every accepted obligation has an owner and the repository remains supported.',
    },
  ],
  obligationOwners: stagedOwners('Contract owner', 'Release owner'),
});
const UNCHANGED_DECISIONS_PLAN = executionPlan({
  decision: 'one pull request',
  rationale:
    'One cohesive activation preserves both accepted decisions and proves every delivery obligation independently.',
  slices: [
    {
      ...ACTIVATION_SLICE,
      name: 'Decision-preserving activation',
      prerequisites: 'none',
      boundary:
        'Contract compatibility, review activation, shared authorization, host-neutral ordering, failure signals, rollout, rollback, and documentation.',
      proof: ALL_DELIVERY_PROOFS,
    },
  ],
});
const STARTABLE_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One authorization denial is one independently provable behavior.',
  slices: [
    {
      name: 'Authorization denial',
      purpose: 'Reject a denied request.',
      boundary: 'Public authorization response.',
      prerequisites: 'none',
      proof: 'behavior-boundary',
      completion: 'The denied request returns the accepted error.',
      tasks: [
        '1. RED: run `bun run test tests/auth.test.ts -t denied-request` and observe exit 1 before editing `src/auth.ts`.',
        '2. GREEN: implement the accepted denial in `src/auth.ts`.',
        '3. REFACTOR: keep the authorization boundary in one owner.',
      ],
    },
  ],
});
const LATER_UNSTARTABLE_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One authorization denial is one independently provable behavior.',
  slices: [
    {
      name: 'Authorization denial',
      purpose: 'Reject a denied request.',
      boundary: 'Public authorization response.',
      prerequisites: 'none',
      proof: 'behavior-boundary',
      completion: 'The denied request returns the accepted error.',
      tasks: [
        '1. RED: run `bun run test tests/auth.test.ts -t denied-request` and observe exit 1 before editing `src/auth.ts`.',
        '2. GREEN: implement the accepted denial in `src/auth.ts`.',
        '3. REFACTOR: keep the authorization boundary in one owner.',
        '4. TODO: decide whether denied authorization returns an error or an empty result before implementation.',
      ],
    },
  ],
});

function missingFieldCase(
  id: string,
  field: keyof Omit<SliceInput, 'name'>,
  term: string,
): ExecutionPlanConformanceCase {
  return denied(
    id,
    `A planned pull request omits its ${term}; review names ${term} as required.`,
    executionPlan({
      decision: 'one pull request',
      rationale: 'The contribution claims to be one coherent change.',
      slices: [{ ...CONTRACT_SLICE, [field]: undefined }],
    }),
    [term],
  );
}

function missingObligationCase(
  id: string,
  obligation: (typeof OBLIGATIONS)[number],
): ExecutionPlanConformanceCase {
  return denied(
    id,
    `The accepted ${obligation} has no owning slice; review names the unassigned obligation.`,
    executionPlan({
      decision: 'one pull request',
      rationale: 'The contribution claims to preserve the accepted approach.',
      slices: [CONTRACT_SLICE],
      omittedObligation: obligation,
    }),
    [obligation],
  );
}

export const EXECUTION_PLAN_CONFORMANCE_CASES: readonly ExecutionPlanConformanceCase[] = [
  approved(
    'one-coherent-change',
    'One coherent change records one pull request.',
    ONE_PLAN,
    'one_pull_request',
    ['Complete delivery'],
  ),
  approved(
    'several-ordered-changes',
    'Several independent changes record ordered pull requests.',
    MULTI_PLAN,
    'multiple_pull_requests',
    ['Contract', 'Activation'],
  ),
  denied(
    'omitted-slicing-decision',
    'An omitted slicing decision is denied as undecided.',
    executionPlan({
      rationale: 'Contract and activation are described but the slicing decision is unspecified.',
      slices: [CONTRACT_SLICE, ACTIVATION_SLICE],
    }),
    ['slicing', 'decision'],
  ),
  approved(
    'complete-slice-record',
    'A complete slice receives a complete record.',
    COMPLETE_RECORD_PLAN,
    'one_pull_request',
    ['Typed review result'],
  ),
  denied(
    'generic-checklist',
    'A structurally complete checklist unrelated to the accepted scenarios and approach is denied.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'The contribution claims one coherent outcome.',
      slices: [CONTRACT_SLICE],
      unrelatedChecklist: true,
    }),
    ['checklist', 'accepted'],
  ),
  {
    ...denied(
      'dismissed-applicable-work',
      'Applicable contributor work cannot be dismissed as not applicable.',
      DISMISSED_APPLICABLE_WORK_PLAN,
      ['item-4', 'behavior-boundary'],
    ),
    implementation_plan: APPLICABILITY_IMPLEMENTATION_PLAN,
  },
  denied(
    'proof-does-not-exercise-boundary',
    'A command that cannot exercise its claimed real boundary is denied.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'The contribution claims one coherent outcome.',
      slices: [CONTRACT_SLICE],
      unrealProof: true,
    }),
    ['proof', 'boundary'],
  ),
  missingFieldCase('missing-purpose', 'purpose', 'purpose'),
  missingFieldCase('missing-boundary', 'boundary', 'boundary'),
  missingFieldCase('missing-prerequisites', 'prerequisites', 'prerequisite'),
  missingFieldCase('missing-proof', 'proof', 'proof'),
  missingFieldCase('missing-completion-signal', 'completion', 'completion signal'),
  denied(
    'two-independent-purposes',
    'One slice with two independently valuable purposes is denied.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'The author put both outcomes together because they touch review code.',
      slices: [
        {
          ...CONTRACT_SLICE,
          purpose: 'Package the contract and independently activate public CLI routing.',
          boundary: 'Contract generation plus unrelated public command activation.',
          proof: 'Package tests prove the contract; CLI tests separately prove activation.',
        },
      ],
    }),
    ['two', 'purpose'],
  ),
  denied(
    'unresolved-authorization-decision',
    'A formally complete slice leaving authorization ownership undecided is denied.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'The slice is mechanically complete.',
      slices: [
        {
          ...CONTRACT_SLICE,
          boundary:
            'The implementer will decide whether each transport or one service owns authorization.',
        },
      ],
    }),
    ['authorization'],
  ),
  approved(
    'ordered-schema-before-reader',
    'Schema addition precedes reader activation.',
    ORDERED_SCHEMA_PLAN,
    'multiple_pull_requests',
    ['Schema', 'Reader'],
  ),
  denied(
    'unsafe-intermediate-merge',
    'An earlier merge requiring an unmerged handler is denied with its missing prerequisite.',
    executionPlan({
      decision: 'multiple pull requests',
      rationale: 'The workflow state and handler are in separate pull requests.',
      slices: [
        {
          ...CONTRACT_SLICE,
          purpose: 'Emit a required state that no merged code can handle.',
          completion: 'The new unsupported state is emitted.',
        },
        {
          ...ACTIVATION_SLICE,
          prerequisites: 'none',
          purpose: 'Add the only handler for the required state.',
        },
      ],
    }),
    ['supported', 'prerequisite'],
  ),
  approved(
    'many-mechanical-edits',
    'Many mechanical edits with one proof remain one concern.',
    MECHANICAL_MIRRORS_PLAN,
    'one_pull_request',
    ['Contract mirrors'],
  ),
  approved(
    'few-files-two-outcomes',
    'Few edits with two separately provable outcomes become two concerns.',
    FEW_FILES_TWO_OUTCOMES_PLAN,
    'multiple_pull_requests',
    ['Inert schema', 'Public activation'],
  ),
  denied(
    'line-count-only-rationale',
    'Line count alone cannot justify a review boundary.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'This is reviewable only because it is below 400 changed lines.',
      slices: [CONTRACT_SLICE],
    }),
    ['conceptual', 'proof'],
  ),
  approved(
    'all-obligations-assigned',
    'Every accepted obligation has an owner.',
    OBLIGATION_PLAN,
    'multiple_pull_requests',
    ['Contract owner', 'Release owner'],
  ),
  approved(
    'all-decisions-unchanged',
    'Every accepted decision remains unchanged.',
    UNCHANGED_DECISIONS_PLAN,
    'one_pull_request',
    ['Decision-preserving activation'],
  ),
  missingObligationCase('missing-behavior-obligation', 'Accepted behavior'),
  missingObligationCase('missing-migration-obligation', 'Migration work'),
  missingObligationCase('missing-rollout-obligation', 'Rollout work'),
  missingObligationCase('missing-rollback-obligation', 'Rollback work'),
  missingObligationCase('missing-documentation-obligation', 'Documentation work'),
  missingObligationCase('missing-affected-surface-obligation', 'Affected-surface work'),
  denied(
    'reopened-authorization-decision',
    'A slice cannot move the accepted shared authorization boundary.',
    executionPlan({
      decision: 'one pull request',
      rationale: 'The slice replaces the accepted authorization design.',
      slices: [{ ...CONTRACT_SLICE, purpose: 'Move authorization into each transport.' }],
      decisionText:
        '- One shared authorization service owns permission checks for every transport: changed to per-transport checks\n- Host-neutral dependency order keeps every intermediate merge supported: unchanged',
    }),
    ['authorization'],
  ),
  approved(
    'fresh-context-first-red',
    'A fresh-context agent can begin with the named highest-risk RED without inventing a decision.',
    STARTABLE_PLAN,
    'one_pull_request',
    ['Authorization denial'],
  ),
  denied(
    'later-step-is-not-startable',
    'A concrete first RED cannot hide an unresolved behavior decision in the fourth step.',
    LATER_UNSTARTABLE_PLAN,
    ['task 4', 'behavior decision'],
  ),
];

export interface ExecutionPlanConformanceResult {
  readonly case_id: string;
  readonly reviewer: ReviewAgent;
  readonly model?: string;
  readonly passed: boolean;
}

export interface ExecutionPlanAdmissionIdentity {
  readonly reviewer: ReviewAgent;
  readonly model?: string;
  readonly case_ids: readonly string[];
}

export interface ExecutionPlanAdmissionEvidence {
  readonly schema_version: 1;
  readonly contract_sha256: string;
  readonly corpus_sha256: string;
  readonly identities: readonly ExecutionPlanAdmissionIdentity[];
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function executionPlanConformanceDigests(): {
  readonly contract_sha256: string;
  readonly corpus_sha256: string;
} {
  return {
    contract_sha256: sha256(reviewPromptContract('plan-execution')),
    corpus_sha256: sha256(JSON.stringify(EXECUTION_PLAN_CONFORMANCE_CASES)),
  };
}

function identityKey(result: Pick<ExecutionPlanConformanceResult, 'reviewer' | 'model'>): string {
  return `${result.reviewer}\0${result.model ?? '<runtime-default>'}`;
}

function isValidConformanceResult(result: ExecutionPlanConformanceResult): boolean {
  return (
    (result.reviewer === 'claude' || result.reviewer === 'codex') &&
    typeof result.passed === 'boolean' &&
    result.passed &&
    typeof result.case_id === 'string' &&
    result.case_id.trim() !== '' &&
    (result.model === undefined || (typeof result.model === 'string' && result.model.trim() !== ''))
  );
}

export function buildExecutionPlanAdmissionEvidence(
  results: readonly ExecutionPlanConformanceResult[],
): ExecutionPlanAdmissionEvidence {
  if (results.some(result => !isValidConformanceResult(result))) throw incompleteMatrixError();
  const expected = EXECUTION_PLAN_CONFORMANCE_CASES.map(testCase => testCase.id);
  const grouped = new Map<string, ExecutionPlanConformanceResult[]>();
  for (const result of results) {
    const key = identityKey(result);
    grouped.set(key, [...(grouped.get(key) ?? []), result]);
  }
  if (grouped.size === 0) throw incompleteMatrixError();

  const identities = Array.from(grouped.values(), group => {
    const first = group[0];
    if (first === undefined) throw incompleteMatrixError();
    const actual = group.map(result => result.case_id);
    if (
      actual.length !== expected.length ||
      new Set(actual).size !== actual.length ||
      expected.some(caseId => !actual.includes(caseId))
    ) {
      throw incompleteMatrixError();
    }
    return {
      reviewer: first.reviewer,
      ...(first.model !== undefined && { model: first.model }),
      case_ids: expected,
    };
  });
  return { schema_version: 1, ...executionPlanConformanceDigests(), identities };
}

function incompleteMatrixError(): Error {
  return new Error('Expected a complete passing Execution Plan conformance matrix per identity');
}

export function renderExecutionPlanAdmissionEvidence(
  results: readonly ExecutionPlanConformanceResult[],
): string {
  const evidence = buildExecutionPlanAdmissionEvidence(results);
  return [
    '// Generated by scripts/generate-execution-plan-admission.ts. Do not edit.',
    'export const EXECUTION_PLAN_ADMISSION_EVIDENCE =',
    `  ${JSON.stringify(evidence, undefined, 2)} as const;`,
    '',
  ].join('\n');
}

function hasCurrentDigests(evidence: ExecutionPlanAdmissionEvidence): boolean {
  const current = executionPlanConformanceDigests();
  return (
    evidence.schema_version === 1 &&
    evidence.contract_sha256 === current.contract_sha256 &&
    evidence.corpus_sha256 === current.corpus_sha256
  );
}

function admittedIdentity(
  route: ReviewRoute,
  identities: readonly ExecutionPlanAdmissionIdentity[],
): boolean {
  const expectedCases = EXECUTION_PLAN_CONFORMANCE_CASES.map(testCase => testCase.id);
  return identities.some(identity => {
    const sameModel =
      route.model === undefined ? identity.model === undefined : identity.model === route.model;
    return (
      (identity.reviewer === 'claude' || identity.reviewer === 'codex') &&
      identity.reviewer === route.reviewer &&
      sameModel &&
      identity.case_ids.length === expectedCases.length &&
      identity.case_ids.every((caseId, index) => caseId === expectedCases[index])
    );
  });
}

export function filterExecutionPlanRoutes(
  kind: ReviewKind,
  routes: readonly ReviewRoute[],
  evidence: ExecutionPlanAdmissionEvidence | undefined = EXECUTION_PLAN_ADMISSION_EVIDENCE,
): readonly ReviewRoute[] {
  if (kind !== 'plan-execution') return routes;
  if (evidence === undefined || !hasCurrentDigests(evidence)) return [];
  return routes.filter(route => admittedIdentity(route, evidence.identities));
}
