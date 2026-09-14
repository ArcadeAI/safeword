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
}

function slice(input: SliceInput): string {
  return `### ${input.name}

${input.purpose === undefined ? '' : `- Purpose: ${input.purpose}\n`}${
    input.boundary === undefined ? '' : `- Boundary: ${input.boundary}\n`
  }${
    input.prerequisites === undefined ? '' : `- Prerequisites: ${input.prerequisites}\n`
  }${input.proof === undefined ? '' : `- Proof: ${input.proof}\n`}${
    input.completion === undefined ? '' : `- Completion signal: ${input.completion}\n`
  }`;
}

const CONTRACT_SLICE: SliceInput = {
  name: 'Contract',
  purpose: 'Package the canonical Execution Planning contract.',
  boundary: 'Contract template, schema registration, and generated assets.',
  prerequisites: 'none',
  proof: 'Package tests compare every installed contract byte.',
  completion: 'The inert contract ships and the repository remains supported.',
};
const ACTIVATION_SLICE: SliceInput = {
  name: 'Activation',
  purpose: 'Activate typed Execution Plan review.',
  boundary: 'Review routing, result retention, and CLI presentation.',
  prerequisites: 'Contract',
  proof: 'A CLI integration test observes a retained typed approval.',
  completion: 'The command is auditable and the repository remains supported.',
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

function deliveryContract(unrelated: boolean, unrealProof: boolean): string {
  const boundary = unrealProof
    ? 'Customer authorization across both live transports.'
    : 'Accepted behavior and every migration, rollout, rollback, documentation, and affected-surface obligation.';
  const argv = unrealProof
    ? ['node', '--version']
    : ['bun', 'run', 'test:execution-plan-conformance'];
  const invocation = JSON.stringify({ type: 'command', cwd: '.', argv });
  const items = DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => {
    const obligation = unrelated
      ? 'Complete the standard delivery work.'
      : CHECKLIST_OBLIGATIONS[index];
    return `| item-${index + 1} | ${category} | ${obligation} | contributor | complete-delivery | open | missing | | |`;
  }).join('\n');
  return `## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| complete-delivery | command | E2E | ${boundary} | real_boundary | current_required | ${invocation} |

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
  rationale: 'Every edit delivers one contract and one package test proves the shared outcome.',
  slices: [CONTRACT_SLICE],
});
const MULTI_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale: 'Contract delivery and activation are independently reviewable with separate proof.',
  slices: [CONTRACT_SLICE, ACTIVATION_SLICE],
});
const COMPLETE_RECORD_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One typed review-result change has one proof and one supported completion state.',
  slices: [
    {
      name: 'Typed review result',
      purpose: 'Retain one complete typed Execution Plan judgment.',
      boundary: 'Result type, validation, and persistence for that judgment.',
      prerequisites: 'none',
      proof: 'A result test asserts every retained field.',
      completion: 'A complete judgment round-trips without activating a command.',
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
      proof: 'Schema golden tests pass.',
      completion: 'The unused schema ships without changing runtime behavior.',
    },
    {
      name: 'Reader',
      purpose: 'Read and retain schema-valid results.',
      boundary: 'Reader activation and persistence only.',
      prerequisites: 'Schema',
      proof: 'A reader integration test retains a schema-valid result.',
      completion: 'The reader is active and every merge remains supported.',
    },
  ],
  obligationOwners: {
    'Accepted behavior': 'Reader',
    'Migration work': 'Schema',
  },
});
const MECHANICAL_MIRRORS_PLAN = executionPlan({
  decision: 'one pull request',
  rationale:
    'Forty generated and installed file edits mirror one canonical contract and share one parity proof.',
  slices: [
    {
      name: 'Contract mirrors',
      purpose: 'Publish one canonical contract through every generated mirror.',
      boundary: 'Canonical source plus forty mechanical generated or installed copies.',
      prerequisites: 'none',
      proof: 'One parity test compares every mirror with the canonical source.',
      completion: 'All mirrors expose the same contract and no runtime behavior changes.',
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
      proof: 'A golden test proves the schema bytes.',
      completion: 'The schema is available but unused.',
    },
    {
      name: 'Public activation',
      purpose: 'Expose the new review command.',
      boundary: 'One routing file.',
      prerequisites: 'Inert schema',
      proof: 'A CLI test proves public dispatch and retention.',
      completion: 'The command works and every merge remains supported.',
    },
  ],
});
const OBLIGATION_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale:
    'Contract delivery and release activation divide ownership without dropping an obligation.',
  slices: [
    { ...CONTRACT_SLICE, name: 'Contract owner' },
    {
      ...ACTIVATION_SLICE,
      name: 'Release owner',
      prerequisites: 'Contract owner',
      completion: 'Every accepted obligation has an owner and the repository remains supported.',
    },
  ],
});
const UNCHANGED_DECISIONS_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One activation preserves both accepted decisions exactly as approved.',
  slices: [
    {
      ...ACTIVATION_SLICE,
      name: 'Decision-preserving activation',
      prerequisites: 'none',
      boundary: 'Activate review while retaining shared authorization and host-neutral ordering.',
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
    ['Contract'],
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
