import { createHash } from 'node:crypto';

import { DELIVERY_CHECKLIST_CATEGORIES } from '../execution-plan/delivery-checklist.js';
import type { ReviewAgent, ReviewKind } from './contract.js';
import { EXECUTION_PLAN_ADMISSION_EVIDENCE } from './execution-plan-admission.generated.js';
import { reviewPromptContract } from './review-rubric.js';
import type { ReviewRoute } from './route-config.js';
import { reviewOutputSchema } from './runtime.js';

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

## Binding fixture scope

- This fixture project delivers one public review command and its compatible stored result. The ticket accepts the six named obligations above, with no new transport, database, reviewer selection policy, or human approval policy.
- Existing fixture scripts exercise the public command, result reader, permission denial, activation switch, and documentation. Execution Planning determines whether delivery needs one or multiple independently supported slices.

## Accepted response and recovery contracts

- The public command and result store use the exact version-1 Execution Plan reviewer response below. Approval records its slicing decision, named slices, obligation owners, preserved decisions, normalized plan digest, and delivery definition; rejection retains its findings and has a null execution record.
- Migration preserves legacy result bytes and translates their verdict, summary, and findings through the backward-compatible reader; it does not rewrite persisted legacy records.
- The shared authorization service denies an unauthorized actor before reviewer dispatch or persistence. Denial names the affected review, exits 2, and creates no stored result.
- Activation enables the typed reader only after compatible result reading is available. Disabling activation restores the prior reader and leaves both old and new stored results readable.
- Documentation describes the same public response, denial, activation, and rollback behavior; it adds no new behavior.

Accepted response schema:

${reviewOutputSchema('plan-execution')}
`;
const DATA_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted data design

- The project-local SQLite database \`delivery.db\` stores delivery evidence.
- DeliveryStateService owns all reads and writes for that store.
`;
const DECISION_OBLIGATION_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted decision-derived work

- Apply the shared authorization decision to both gateway transports.
`;
const PROOF_OBLIGATION_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted proof-strategy work

- Implement the edited-plan denial proof through the installed CLI subprocess.
`;
const ORDERED_MIGRATION_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted migration order

- Complete Migration work before activating Accepted behavior.
`;
const MINIMAL_IMPLEMENTATION_PLAN = `# Implementation Plan

## Accepted obligations

- Accepted behavior

## Explicitly inapplicable execution work

- Migration work: not applicable because no persisted representation changes.
- Rollout work: not applicable because the behavior has no staged activation.
- Rollback work: not applicable because reverting the single behavior change is sufficient.
- Documentation work: not applicable because no public or operator contract changes.
- Affected-surface work: not applicable because no additional consumer surface changes.

## Recorded decisions

- One shared authorization service owns permission checks for every transport.
- Host-neutral dependency order keeps every intermediate merge supported.
`;
const INAPPLICABLE_OPTIONAL_WORK_IMPLEMENTATION_PLAN = `${MINIMAL_IMPLEMENTATION_PLAN}
## Binding fixture scope and accepted behavior

- This fixture repairs the existing public review command's permission denial. The authenticated actor blocked-user has no review permission for fixture-review; the existing shared authorization service owns that permission check.
- Accepted behavior: the unauthorized public command names fixture-review, exits 2, leaves the reviewer request journal empty, and creates no stored result. Existing documentation already describes this response; neither the response contract nor its persisted representation changes.
- Existing fixture scripts exercise the public command, its denied response, its reviewer journal, and its result store. No additional transport, data design, activation policy, or approval authority is introduced.
`;
const PROOF_ONLY_IMPLEMENTATION_PLAN = `${MINIMAL_IMPLEMENTATION_PLAN}
## Binding fixture scope and accepted behavior

- This fixture repairs the existing public command's edited-plan denial. An authenticated permitted actor starts with a current plan approved through the existing authenticated approval path. Editing that plan makes its prior approval unusable.
- Accepted behavior: the public command exits 2 and names the edited plan before reviewer dispatch or result persistence. The existing approval issuer and plan-version check remain authoritative; no approval policy, response format, stored representation, or documentation contract changes.
- Existing fixture helpers obtain the initial approval through that authenticated path, edit the plan, invoke the installed CLI subprocess, and inspect its exit, reviewer journal, and result store.

## Accepted proof strategy

- Edited-plan denial uses a self-contained fixture and command through the installed CLI subprocess and must assert exit code 2.
`;
const MEASUREMENT_IMPLEMENTATION_PLAN = `${IMPLEMENTATION_PLAN}
## Accepted measurement contract

- Outcome: reduce authorization latency for production gateway requests.
- Population: all production gateway authorization requests, excluding documented synthetic probes.
- Target: p95 authorization latency is at most 200 milliseconds over a rolling seven-day window.
- Measurement origin: record the duration at the gateway authorization boundary before response serialization.
- Method: publish the \`gateway_authorization_seconds\` histogram with transport and outcome dimensions.
- Validity safeguards: reject evidence when sample coverage is below 99 percent or synthetic traffic is included.
- Failure behavior: keep rollout disabled and report the measurement as invalid when a validity safeguard fails.
`;
const BASE_DECISION_ACCOUNTING = DECISIONS.map(decision => `- ${decision}: unchanged`).join('\n');

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
  boundary:
    'Contract template, schema registration, generated assets, and the compatible stored-result reader; public activation remains disabled.',
  prerequisites: 'none',
  proof: 'data-compatibility: package tests compare every installed contract byte.',
  completion:
    'The inert contract and compatible reader ship with public activation disabled; legacy bytes remain unchanged and the repository remains supported.',
  tasks: [
    '1. RED: run `bun run test:schema-compatibility` with the generated-contract fixture and observe `canonical contract bytes differ` before editing templates.',
    '2. GREEN: add the canonical contract to the template registry, regenerate its mirrors, and rerun `bun run test:schema-compatibility` with exit 0.',
    '3. RED: run `bun run test:schema-compatibility -- --fixture legacy-result` and observe exit 1 because the compatible reader cannot return the legacy verdict, summary, and findings before editing `src/review/result-store.ts`.',
    '4. GREEN: implement the accepted compatible reader in `src/review/result-store.ts` without enabling public activation, rerun both compatibility commands, and assert exact legacy verdict, summary, and findings, unchanged persisted legacy bytes, and exact typed-result contents.',
    '5. REFACTOR: remove duplicate contract text, regenerate the mirrors, and rerun both compatibility commands with exit 0 while public activation remains disabled.',
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
    '1. RED: run `bun run test:review-cli -- --fixture approved-plan` through the public CLI and observe exit 2 with `typed review result is unavailable` before editing `src/review/command.ts`.',
    '2. GREEN: connect public routing and result retention to the prerequisite schema and compatible reader; rerun the step-1 command and assert exit 0, schema-valid response, and exact slicing decision, slice names, obligation owners, unchanged decisions, normalized plan digest, and delivery definition matching approved-plan in both the public response and stored result. Seed the approved judgment with distinguishing summary, findings, evidence records, destination, and complete slice details; compare the complete supplied judgment by deep equality with both the public response and the stored-reader response.',
    '3. RED: run `bun run test:failure-signals -- --fixture authorized-reviewer-rejection` and observe exit 1 because the public or stored response loses the rejection finding or retains an approval record. Run `bun run test:authorization-boundary -- --fixture denied-review` with an unauthorized actor and an empty reviewer request journal and observe exit 1 because dispatch or persistence occurs before authorization.',
    '4. GREEN: check the accepted shared authorization service before dispatch; rerun both step-3 commands and assert unauthorized exit 2, the affected review identity, an empty reviewer journal, and no persisted result. Assert authorized reviewer rejection retains the supplied finding and a null execution record in both public and stored results. Seed the rejected judgment with distinguishing summary, findings, evidence records, and destination; compare the complete supplied judgment by deep equality with both the public response and the stored-reader response.',
    '5. RED: run `bun run test:rollout-rollback -- --fixture enabled-result` and observe exit 1 because activation ignores compatible-reader availability or disabling activation makes stored results unreadable before editing `src/review/rollout.ts`.',
    '6. GREEN: implement the accepted activation switch and rollback reader; rerun step 5 and assert activation waits for compatible reading, both formats retain their exact expected contents, and disabling activation restores the prior reader with both formats still readable.',
    '7. RED: run `bun run test:documentation-contract` and `bun run test:execution-plan-conformance` and observe exit 1 because the public response, denial, activation, rollback, or obligation mapping is missing before editing the command reference and canonical corpus.',
    '8. GREEN: document the accepted public contracts and complete the canonical obligation mapping; rerun both step-7 commands and assert exit 0.',
    '9. REFACTOR: retain one response-validation and result-retention path; run all six activation proof commands and assert exit 0 with byte-identical public response snapshots.',
  ],
};

function executionPlan(input: {
  readonly decision?: 'one pull request' | 'multiple pull requests';
  readonly rationale: string;
  readonly slices: readonly SliceInput[];
  readonly omittedObligation?: (typeof OBLIGATIONS)[number];
  readonly applicableObligations?: readonly (typeof OBLIGATIONS)[number][];
  readonly obligationOwners?: Readonly<Partial<Record<(typeof OBLIGATIONS)[number], string>>>;
  readonly decisionText?: string;
  readonly unrelatedChecklist?: boolean;
  readonly unrealProof?: boolean;
  readonly inapplicableOptionalWork?: boolean;
}): string {
  const owners = (input.applicableObligations ?? OBLIGATIONS)
    .filter(obligation => obligation !== input.omittedObligation)
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

${deliveryContract(
  input.unrelatedChecklist === true,
  input.unrealProof === true,
  input.inapplicableOptionalWork === true,
)}
`;
}

function withDecisionAccounting(plan: string, decisionText: string): string {
  const start = plan.indexOf(BASE_DECISION_ACCOUNTING);
  if (start === -1) throw new Error('Conformance fixture is missing base decision accounting');
  return `${plan.slice(0, start)}${decisionText}${plan.slice(start + BASE_DECISION_ACCOUNTING.length)}`;
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

function deliveryContract(
  unrelated: boolean,
  unrealProof: boolean,
  inapplicableOptionalWork: boolean,
): string {
  const inapplicableCategories = new Set([4, 7, 8]);
  const items = DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => {
    if (inapplicableOptionalWork && inapplicableCategories.has(index)) {
      return `| item-${index + 1} | ${category} | No additional ${category} work. | contributor |  | not_applicable | missing | | The accepted approach explicitly makes this category inapplicable. |`;
    }
    const defaultObligation = CHECKLIST_OBLIGATIONS[index];
    if (defaultObligation === undefined) throw new Error(`Missing obligation ${index + 1}`);
    let obligation: string = defaultObligation;
    if (unrelated) obligation = 'Complete the standard delivery work.';
    else if (inapplicableOptionalWork && index === 5)
      obligation = 'Expose typed failure signals for Accepted behavior.';
    else if (inapplicableOptionalWork && index === 6)
      obligation = 'Protect the authorization boundary for Accepted behavior.';
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
  readonly planning_destination: 'plan-execution' | 'plan-implementation';
  readonly slicing_decision?: 'one_pull_request' | 'multiple_pull_requests';
  readonly slice_names?: readonly string[];
  readonly obligations?: readonly string[];
  readonly decisions?: readonly string[];
  readonly finding_terms?: readonly string[];
}

export interface ExecutionPlanConformanceCase {
  readonly id: string;
  readonly scenario: string;
  readonly accepted_scenario: string;
  readonly implementation_plan: string;
  readonly execution_plan: string;
  readonly expectation: ExecutionPlanConformanceExpectation;
}

function acceptedBehaviorScenario(implementationPlan: string): string {
  const editedPlan = `Feature: Preserve the existing plan approval boundary
Scenario: A permitted user invokes the command after an approved plan changes
  Given the existing authenticated approval path approved the current plan
  And a permitted user changes that plan's recorded content
  When the user invokes the installed public CLI command
  Then the command names the edited plan and exits 2
  And no reviewer request or stored result is created
`;
  if (
    implementationPlan.includes(
      "This fixture repairs the existing public command's edited-plan denial",
    )
  )
    return editedPlan;
  const permission = `Feature: Preserve the accepted permission boundary
Scenario: A user without review permission requests a review
  Given authenticated blocked-user has no permission for fixture-review
  When blocked-user invokes the existing public review command
  Then the command names fixture-review and exits 2
  And no reviewer request or stored result is created
`;
  if (
    implementationPlan.includes(
      "This fixture repairs the existing public review command's permission denial",
    )
  )
    return permission;
  let result = `Feature: Preserve the accepted public review command contract
Scenario: An authorized user receives an approved reviewer judgment
  Given an authenticated permitted actor requests a review
  When the reviewer supplies an approved version-1 judgment
  Then the public command and stored-result reader retain the exact accepted response fields
Scenario: An authorized user receives a rejected reviewer judgment
  Given an authenticated permitted actor requests a review
  When the reviewer supplies rejection findings and a null execution record
  Then the public and stored responses retain those findings and the null record
Scenario: Activation preserves compatibility and recovery
  Given existing legacy and typed stored results
  When activation is enabled after compatible reading is available and subsequently disabled
  Then the prior reader is restored and both formats remain readable without rewriting legacy bytes
  And documentation describes the same public response, denial, activation, and rollback contracts
${permission.replace(/^Feature:[^\n]*\n/u, '')}`;
  if (implementationPlan.includes('## Accepted data design'))
    result += `Scenario: Delivery evidence uses the accepted store and owner
  When the existing delivery workflow writes and reads known evidence
  Then DeliveryStateService owns those operations against delivery.db
  And the exact evidence values round-trip
`;
  if (implementationPlan.includes('## Accepted measurement contract'))
    result += `Scenario: Production gateway authorization measurements satisfy the accepted safeguards
  When the existing gateway observes production authorization requests before response serialization
  Then gateway_authorization_seconds records transport and outcome dimensions
  And the seven-day production population excludes documented synthetic probes
  And valid current-revision evidence requires at least 99 percent sample coverage and p95 at most 200 milliseconds
  And invalid evidence keeps rollout disabled and is reported as invalid
`;
  if (implementationPlan.includes('## Accepted proof strategy'))
    result += editedPlan.replace(/^Feature:[^\n]*\n/u, '');
  return result;
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
    accepted_scenario: acceptedBehaviorScenario(IMPLEMENTATION_PLAN),
    implementation_plan: IMPLEMENTATION_PLAN,
    execution_plan: plan,
    expectation: {
      verdict: 'approve',
      planning_destination: 'plan-execution',
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
    accepted_scenario: acceptedBehaviorScenario(IMPLEMENTATION_PLAN),
    implementation_plan: IMPLEMENTATION_PLAN,
    execution_plan: plan,
    expectation: {
      verdict: 'request_changes',
      planning_destination: 'plan-execution',
      finding_terms: findingTerms,
    },
  };
}

function decisionChangingDiscovery(
  id: string,
  scenario: string,
  plan: string,
  findingTerms: readonly string[],
): ExecutionPlanConformanceCase {
  const testCase = denied(id, scenario, plan, findingTerms);
  return {
    ...testCase,
    expectation: { ...testCase.expectation, planning_destination: 'plan-implementation' },
  };
}

const ONE_RESPONSE_TASK =
  '2. GREEN: add the accepted result fields to `src/review/contract.ts`, route the public command through `src/review/command.ts`, and rerun the step-1 command with approved-plan as the coherent-change fixture; assert exit 0, schema-valid response, execution_plan_record.slicing_decision equal to one_pull_request, exactly one slice named Complete delivery, and exact obligation owners, unchanged decision statuses, normalized approved-plan digest, and delivery definition matching the fixture; assert all those same expected values after reading the stored result. Seed the approved judgment with distinguishing summary, findings, evidence records, destination, and complete slice details; compare the complete supplied judgment by deep equality with both the public response and the stored-reader response.';
const ONE_DENIAL_RED_TASK =
  '5. RED: run `bun run test:failure-signals -- --fixture authorized-reviewer-rejection` with a reviewer response containing request_changes, the named rejection finding, and a null execution_plan_record; observe exit 1 because the public response loses the finding or retains an approval record. Also run `bun run test:authorization-boundary -- --fixture denied-review` with an unauthorized actor and an initially empty reviewer request journal; observe exit 1 because the CLI neither names the denied review nor prevents dispatch before editing `src/review/command.ts`.';
const ONE_DENIAL_GREEN_TASK =
  '6. GREEN: call the accepted shared authorization service before reviewer dispatch in `src/review/command.ts`, rerun both step-5 commands, and assert the unauthorized call exits 2, names the affected review, leaves the reviewer request journal empty, and persists no result. For the authorized reviewer rejection, assert the public response retains the supplied rejection finding and a null execution_plan_record, and that the compatible stored-result reader returns those same values. Seed the rejected judgment with distinguishing summary, findings, evidence records, and destination; compare the complete supplied judgment by deep equality with both the public response and the stored-reader response.';

const ONE_DELIVERY_TASKS = [
  '1. RED: run `bun run test:review-cli -- --fixture approved-plan` through the public CLI and observe exit 2 with `typed review result is unavailable` before editing `src/review/command.ts`.',
  ONE_RESPONSE_TASK,
  '3. RED: run `bun run test:schema-compatibility -- --fixture legacy-result` and observe exit 1 with `legacy result cannot be read` before editing `src/review/result-store.ts`.',
  '4. GREEN: add the backward-compatible legacy-result reader in `src/review/result-store.ts`, rerun the step-3 command, and assert the stored result round-trips without rewriting legacy bytes.',
  ONE_DENIAL_RED_TASK,
  ONE_DENIAL_GREEN_TASK,
  '7. RED: run `bun run test:rollout-rollback -- --fixture enabled-result` and observe exit 1 because disabling the review command does not restore the prior readable result before editing `src/review/rollout.ts`.',
  '8. GREEN: add the accepted activation switch and rollback reader in `src/review/rollout.ts`, rerun the step-7 command, and assert activation waits for compatible reading, enabled activation reads the expected legacy-result and typed-result fixture contents, and disabling activation restores the prior reader while both formats remain readable with their exact expected contents.',
  '9. RED: run `bun run test:documentation-contract` and `bun run test:execution-plan-conformance`; observe exit 1 because the command reference omits the public response, denial, activation, or rollback contract, or the corpus omits an accepted obligation, before editing the command reference and canonical review contract.',
  '10. GREEN: document the exact public response, denial, activation, and rollback contracts and add every accepted obligation to the canonical conformance corpus, then rerun both step-9 commands and assert exit 0; assert the rendered command reference describes all four accepted contracts and that removing any one makes documentation-contract fail.',
  '11. REFACTOR: move the duplicate response validation in `src/review/command.ts` and `src/review/result-store.ts` into `src/review/contract.ts`, then rerun all seven proof commands and assert the public response snapshot is byte-identical.',
] as const;

const COMPLETE_DELIVERY_SLICE: SliceInput = {
  name: 'Complete delivery',
  purpose: 'Deliver the complete typed Execution Plan review capability.',
  boundary:
    'Contract, CLI behavior, compatibility, failure signals, authorization, rollout, rollback, and documentation.',
  prerequisites: 'none',
  proof: ALL_DELIVERY_PROOFS,
  completion:
    'Every named proof command passes on the merge candidate and every checklist item has completion evidence.',
  tasks: ONE_DELIVERY_TASKS,
};

const COMPLETE_DELIVERY_RATIONALE =
  'The public review result, its compatible persistence, permission check, failure signal, rollout switch, rollback, and documentation are inseparable facets of one command contract; none is independently useful and every proof protects that same response.';

const ONE_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: COMPLETE_DELIVERY_RATIONALE,
  slices: [COMPLETE_DELIVERY_SLICE],
});
const UNCHANGED_DECISIONS_PLAN = `${ONE_PLAN}
## Decision preservation focus

- Verify that the shared authorization service still owns permission checks for every transport.
- Verify that the dependency order remains host-neutral at every intermediate merge.
`;
const CURRENT_PROOF_ROW =
  '| item-4 | testing | Prove Accepted behavior at the named boundary. | contributor | behavior-boundary | complete | current_revision_real_boundary | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | receipt:current-proof |';
const CURRENT_BEHAVIOR_ROW =
  '| item-1 | outcome and scope | Deliver Accepted behavior. | contributor | behavior-boundary | complete | current_revision_real_boundary | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | receipt:current-proof |';
const EARLIER_PROOF_ROW =
  '| item-4 | testing | Prove Accepted behavior at the named boundary. | contributor | behavior-boundary | complete | reusable_earlier_revision | bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | receipt:earlier-proof; compatible: accepted boundary is unchanged |';
const OPEN_PROOF_ROW =
  '| item-4 | testing | Prove Accepted behavior at the named boundary. | contributor | behavior-boundary | open | missing | | |';
const OPEN_BEHAVIOR_ROW =
  '| item-1 | outcome and scope | Deliver Accepted behavior. | contributor | behavior-boundary | open | missing | | |';

function withDeliveryState(plan: string, state: string, proofRow?: string): string {
  const updated = proofRow === undefined ? plan : plan.split(OPEN_PROOF_ROW).join(proofRow);
  return `${updated}\n## Current-to-target state\n\n${state}\n`;
}

const ABSENT_WORK_CLAIMED_COMPLETE_PLAN = withDeliveryState(
  ONE_PLAN,
  `- Obligation: Prove Accepted behavior at the named boundary.
- Current implementation: absent.
- Evidence: missing.
- Target work: implement the accepted behavior and collect current-revision real-boundary proof.
- Claimed delivery state: complete.`,
);
function withRequiredReplacements(
  plan: string,
  replacements: readonly (readonly [string, string])[],
): string {
  for (const [before, after] of replacements) {
    if (!plan.includes(before))
      throw new Error('Conformance fixture is missing expected task text');
    plan = plan.replace(before, () => after);
  }
  return plan;
}

const CURRENT_PROOF_BASE_PLAN = withRequiredReplacements(
  executionPlan({
    decision: 'one pull request',
    rationale:
      'The existing public response remains proven while compatible reading, recovery, and documentation complete the same command contract.',
    slices: [
      {
        ...COMPLETE_DELIVERY_SLICE,
        tasks: [
          '0. VERIFY: retain the current-revision receipts for `bun run test:review-cli -- --fixture approved-plan`, `bun run test:failure-signals -- --fixture authorized-reviewer-rejection`, and `bun run test:authorization-boundary -- --fixture denied-review`. They already prove the exact approved public and stored response, retained rejection finding and null execution record, and unauthorized exit 2 with the affected review identity, an empty reviewer journal, and no stored result. Rerun these regression commands after each remaining change; no response or permission implementation remains outstanding.',
          ...ONE_DELIVERY_TASKS.slice(2, 4),
          ...ONE_DELIVERY_TASKS.slice(6),
        ],
      },
    ],
  }),
  [[OPEN_BEHAVIOR_ROW, CURRENT_BEHAVIOR_ROW]],
);
const CURRENT_PROOF_PLAN = withDeliveryState(
  CURRENT_PROOF_BASE_PLAN,
  `- Obligation: Prove Accepted behavior at the named boundary.
- Current implementation: matches the accepted design.
- Evidence: current-revision real-boundary proof.
- Receipt: the specified command exited 0 on the recorded revision and its receipt is retained.
- Target work: none.
- Recorded delivery state: implemented and proven.`,
  CURRENT_PROOF_ROW,
);
const EARLIER_PROOF_CLAIMED_CURRENT_PLAN = withDeliveryState(
  ONE_PLAN,
  `- Obligation: Prove Accepted behavior at the named boundary.
- Current implementation: matches the accepted design.
- Evidence: reusable earlier-revision proof only.
- Target work: collect current-revision real-boundary proof.
- Claimed delivery state: implemented and proven at the current revision.`,
  EARLIER_PROOF_ROW,
);
const KNOWN_DEFECT_CLAIMED_COMPLETE_PLAN = withDeliveryState(
  ONE_PLAN,
  `- Obligation: Deliver Accepted behavior.
- Current implementation: known defect contradicts the accepted design.
- Evidence: the failing behavior is reproduced at the accepted boundary.
- Target work: correct the defect and collect current-revision real-boundary proof.
- Claimed delivery state: complete.`,
);
const PENDING_HUMAN_CLAIMED_COMPLETE_PLAN = withDeliveryState(
  ONE_PLAN.split(OPEN_PROOF_ROW)
    .join(CURRENT_PROOF_ROW)
    .replace(
      '| item-7 | security and privacy | Protect the Affected-surface work boundary. | contributor | security-boundary | open | missing | | |',
      '| item-7 | security and privacy | Approve the Affected-surface work boundary. | human |  | pending_human | missing | | Security approval by the named reviewer. |',
    ),
  `- Obligation: Activate the accepted behavior after security approval.
- Contributor work: complete.
- Evidence: current-revision real-boundary proof.
- Human authority: pending security approval.
- Target work: obtain the named security approval.
- Claimed delivery state: complete.`,
);
const MEASUREMENT_EXECUTION_BLOCK = `
## Measurement execution

- Owner: Complete delivery.
- Dependency order: add instrumentation, validate its samples, then collect current-revision evidence.
- Instrumentation: record the duration at the gateway authorization boundary before response serialization and publish the \`gateway_authorization_seconds\` histogram with transport and outcome dimensions. Step 12 RED: add production-permitted, production-denied, and synthetic-probe fixtures in tests/gateway-authorization-metrics.test.ts; drive the existing public gateway authorization boundary and run bun run test tests/gateway-authorization-metrics.test.ts -t emitted-histogram. Observe exit 1 because production requests do not emit the expected histogram observations before editing src/gateway/authorization.ts. Step 13 GREEN: use the existing gateway metrics publisher at that accepted boundary, counting the eligible production-request census separately from successfully observed histogram samples; rerun step 12 and assert durations are observed before serialization with exact transport and outcome labels for permitted and denied production requests, while synthetic probes are excluded from the production population. Step 14 REFACTOR: share the instrumentation path and rerun the public authorization and emitted-histogram tests with identical responses and observations.
- Tests: prove the histogram covers production gateway authorization requests, excludes documented synthetic probes, and rejects evidence below 99 percent sample coverage.
- Evidence collection: query the rolling seven-day window and retain the population, sample coverage, p95 result, target comparison, and source revision. Step 15 RED: add valid-window, low-coverage, synthetic-contamination, and over-target fixtures in tests/gateway-measurement-collection.test.ts; run bun run test tests/gateway-measurement-collection.test.ts -t seven-day-evidence and observe exit 1 because accepted measurements cannot be collected or invalid samples enable rollout before editing scripts/collect-gateway-measurement.ts. Step 16 GREEN: implement the collector against the existing gateway histogram query, rerun step 15, and assert the seven-day production population, synthetic exclusion, coverage computed as observed samples divided by the independent eligible-request census and at least 99 percent, milliseconds-converted p95 at most 200, and recorded source revision. The low-coverage fixture must have 98 observed samples for 100 eligible requests; synthetic requests belong to neither count. Low coverage or synthetic contamination must produce invalid evidence and keep rollout disabled; over-target valid evidence must leave the success criterion unmet. Step 17 COLLECT: run bun scripts/collect-gateway-measurement.ts --window-days 7 --output .evidence/gateway-measurement.json against the existing production gateway metrics source and retain the source revision, population, coverage, p95, target comparison, and validity result; do not mark completion until valid current-revision evidence meets the accepted target. Step 18 REFACTOR: share collection validation and rerun the four fixtures with identical classification, artifact fields, and rollout decisions.
- Completion signal: current-revision evidence shows p95 authorization latency at or below 200 milliseconds with at least 99 percent valid sample coverage.
- Preserved contract: the accepted outcome, population, target, measurement origin, method, validity safeguards, and failure behavior remain unchanged.
- Failure handling: keep rollout disabled and report the measurement as invalid when a validity safeguard fails.
`;
const MEASUREMENT_PLAN = `${withRequiredReplacements(ONE_PLAN, [
  [
    '\n\n## Delivery checklist',
    `\n| measurement-evidence | command | E2E | Current-revision production gateway histogram, seven-day population, p95, coverage, synthetic exclusion, and rollout validity. | real_boundary | current_required | ${JSON.stringify({ type: 'command', cwd: '.', argv: ['bun', 'scripts/collect-gateway-measurement.ts', '--window-days', '7', '--output', '.evidence/gateway-measurement.json'] })} |\n\n## Delivery checklist`,
  ],
]).trimEnd()}
| item-12 | testing | Implement and collect the accepted gateway authorization measurement. | contributor | measurement-evidence | open | missing | | |
${MEASUREMENT_EXECUTION_BLOCK}`;
const MISSING_MEASUREMENT_INSTRUMENTATION_PLAN = MEASUREMENT_PLAN.replace(
  /^- Instrumentation:.*\n/m,
  '',
);
const MISSING_MEASUREMENT_EVIDENCE_PLAN = MEASUREMENT_PLAN.replace(
  /^- Evidence collection:.*\n/m,
  '',
);
const CHANGED_MEASUREMENT_TARGET_PLAN = MEASUREMENT_PLAN.replace(
  'at or below 200 milliseconds',
  'at or below 300 milliseconds',
);
const CHANGED_MEASUREMENT_ORIGIN_PLAN = MEASUREMENT_PLAN.replace(
  'at the gateway authorization boundary before response serialization',
  'in the client after response parsing',
);
const WEAKENED_MEASUREMENT_SAFEGUARD_PLAN = MEASUREMENT_PLAN.replace(
  'rejects evidence below 99 percent sample coverage',
  'accepts evidence at any sample coverage',
);
const CHANGED_MEASUREMENT_FAILURE_PLAN = MEASUREMENT_PLAN.replace(
  'keep rollout disabled and report the measurement as invalid when a validity safeguard fails',
  'continue rollout and treat missing samples as a passing measurement',
);
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
      completion:
        'A complete judgment round-trips, every named proof command passes on the merge candidate, and every accepted obligation has completion evidence.',
      tasks: ONE_DELIVERY_TASKS.map(task =>
        task.replaceAll('Complete delivery', 'Typed review result'),
      ),
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
      boundary:
        'Types, schema, and a compatible stored-result reader helper; public activation remains disabled.',
      prerequisites: 'none',
      proof: 'data-compatibility: schema golden tests pass.',
      completion:
        'The unused schema and compatible reader helper ship without activating the public command; legacy stored bytes remain unchanged.',
      tasks: [
        '1. RED: run `bun run test:schema-compatibility` with the result-schema fixture and observe `result schema is missing` before editing schema files.',
        '2. GREEN: add the inert result schema without a runtime consumer, then rerun `bun run test:schema-compatibility` with exit 0.',
        '3. RED: run `bun run test:schema-compatibility -- --fixture legacy-result` and observe exit 1 because the compatible reader cannot return the legacy verdict, summary, and findings before editing `src/review/result-schema.ts`.',
        '4. GREEN: add the compatible reader helper beside the schema without enabling public activation; rerun both compatibility commands and assert exact legacy verdict, summary, and findings, unchanged persisted legacy bytes, and exact typed-result contents.',
        '5. REFACTOR: remove duplicate schema declarations and rerun both compatibility commands with exit 0 while public activation remains disabled.',
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
      tasks: ACTIVATION_SLICE.tasks,
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
        ...ONE_DELIVERY_TASKS.map(task => task.replaceAll('Complete delivery', 'Contract mirrors')),
        '12. RED: run `bun run test:schema-compatibility -- --fixture generated-mirror` and observe exit 1 with `generated contract bytes differ` before editing the canonical template.',
        '13. GREEN: update the canonical template and regenerate every registered mirror, then rerun the step-12 command and assert every installed contract byte matches the canonical source.',
        '14. REFACTOR: remove duplicate hand-authored mirror text, regenerate, and rerun all seven named proof commands with exit 0.',
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
      boundary:
        'One schema file containing the schema and compatible reader helper; public activation remains disabled.',
      prerequisites: 'none',
      proof: 'data-compatibility: a golden test proves the schema bytes.',
      completion:
        'The schema and compatible reader helper are available but public activation remains disabled; legacy stored bytes remain unchanged.',
      tasks: [
        '1. RED: run `bun run test:schema-compatibility` with the public-result fixture and observe `public result schema is missing` before editing schema files.',
        '2. GREEN: add the inert public result schema, then rerun `bun run test:schema-compatibility` with exit 0.',
        '3. RED: run `bun run test:schema-compatibility -- --fixture legacy-result` and observe exit 1 because the compatible reader cannot return the legacy verdict, summary, and findings before editing the same schema file.',
        '4. GREEN: add the compatible reader helper in that same schema file without enabling public activation; rerun both compatibility commands and assert exact legacy verdict, summary, and findings, unchanged persisted legacy bytes, and exact typed-result contents.',
        '5. REFACTOR: consolidate schema declarations and rerun both compatibility commands with exit 0 while public activation remains disabled.',
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
      tasks: ACTIVATION_SLICE.tasks,
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
function permissionDenialTasks(
  testFile: string,
  command: string,
  productionFile: string,
): readonly string[] {
  return [
    `1. RED: create the denied-request fixture in tests/fixtures/denied-request.ts with authenticated blocked-user lacking permission for fixture-review, an empty reviewer request journal, and an empty result store. Add the public-CLI denial assertion in ${testFile}; run ${command}, bun run test:failure-signals -- --fixture denied-request, and bun run test:authorization-boundary -- --fixture denied-request. Observe exit 1 with unauthorized request reached reviewer because the journal is nonempty before editing ${productionFile}.`,
    `2. GREEN: call the existing shared authorization service before dispatch in ${productionFile}; rerun all three step-1 commands and assert test-runner exit 0, public-command exit 2 naming fixture-review, an empty reviewer journal, and no stored result.`,
    '3. REFACTOR: move duplicate permission checks into the existing shared authorizer without changing its authority. Rerun all three denial commands and bun run test:execution-plan-conformance; assert the public response, decision preservation, single-slice dependencies, ownership, and retained completion evidence remain unchanged.',
  ];
}

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
      tasks: permissionDenialTasks(
        'tests/auth.test.ts',
        'bun run test tests/auth.test.ts -t denied-request',
        'src/auth.ts',
      ),
    },
  ],
  applicableObligations: ['Accepted behavior'],
  inapplicableOptionalWork: true,
});

const EXACT_CLI_DENIAL_PROOF_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One edited-plan denial is one independently provable behavior.',
  slices: [
    {
      name: 'Edited-plan denial proof',
      purpose: 'Prove the accepted edited-plan denial.',
      boundary: 'Installed CLI subprocess response.',
      prerequisites: 'none',
      proof: 'behavior-boundary, failure-signals, security-boundary, and plan-integrity',
      completion:
        'The focused test runner exits 0 after asserting that the installed CLI exits 2 for the edited-plan fixture; the full behavior, failure, security, and plan-integrity proofs pass.',
      tasks: [
        '1. RED: create `tests/fixtures/edited-plan` with an approved plan, edit its recorded content, run `bun run test tests/cli-protocol/phase-gates.test.ts -t edited-plan` through the installed CLI subprocess, and observe the test runner fail because the CLI does not yet exit 2 before editing production code.',
        '2. GREEN: implement the accepted edited-plan denial in `src/review/command.ts`, rerun the step-1 command, and assert test-runner exit 0 plus installed-CLI exit 2; then run `bun run test:failure-signals`, `bun run test:authorization-boundary`, and `bun run test:execution-plan-conformance` with exit 0.',
        '3. REFACTOR: move duplicate plan-currentness validation from `src/review/command.ts` into `src/review/contract.ts`, rerun all four named proof commands, and assert the installed-CLI denial response is unchanged.',
      ],
    },
  ],
  applicableObligations: ['Accepted behavior'],
  inapplicableOptionalWork: true,
});
const MISSING_CLI_SUBPROCESS_BOUNDARY_PLAN = withRequiredReplacements(EXACT_CLI_DENIAL_PROOF_PLAN, [
  ['through the installed CLI subprocess,', 'through the TBD CLI boundary,'],
]);
const MISSING_DENIED_EXIT_ASSERTION_PLAN = withRequiredReplacements(EXACT_CLI_DENIAL_PROOF_PLAN, [
  [
    'because the CLI does not yet exit 2 before editing production code.',
    'because the CLI does not yet produce the TBD denied-exit result before editing production code.',
  ],
]);
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
const BLOCKED_FIRST_PREREQUISITE_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale: 'Activation follows a contract that is not yet complete.',
  slices: [
    {
      ...ACTIVATION_SLICE,
      name: 'Activation',
      prerequisites: 'Unfinished contract',
    },
  ],
});
const NO_EXECUTABLE_STEPS_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One authorization change is one review unit.',
  slices: [
    {
      ...CONTRACT_SLICE,
      name: 'Authorization change',
      tasks: [],
    },
  ],
});
const RISK_FIRST_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale: 'Resolve the highest-risk contract assumption before activating the command.',
  slices: [
    {
      ...CONTRACT_SLICE,
      name: 'Risk probe',
      purpose: 'Prove the canonical result contract before any consumer activates it.',
      completion: 'The highest-risk contract assumption is proven before activation begins.',
    },
    {
      ...ACTIVATION_SLICE,
      name: 'Activation',
      prerequisites: 'Risk probe',
      proof: ALL_DELIVERY_PROOFS,
    },
  ],
  obligationOwners: stagedOwners('Risk probe', 'Activation'),
});
const PARALLEL_AFTER_PROBE_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale:
    'Resolve the shared contract risk first, then implement two independently provable consumers in parallel.',
  slices: [
    {
      ...CONTRACT_SLICE,
      name: 'Risk probe',
      purpose: 'Prove the accepted shared contract before either consumer uses it.',
      completion: 'The shared contract is proven before either consumer begins.',
    },
    {
      name: 'CLI consumer',
      purpose: 'Activate the public CLI consumer after the shared contract is proven.',
      prerequisites: 'Risk probe',
      boundary:
        'CLI routing, result retention, permission denial, failure signals, activation, and rollback; documentation is owned by Documentation consumer.',
      proof:
        'behavior-boundary, plan-integrity, failure-signals, security-boundary, and rollout-rollback',
      completion: 'The CLI consumer passes every named boundary proof.',
      tasks: ACTIVATION_SLICE.tasks
        ?.filter(task => !task.startsWith('7.') && !task.startsWith('8.'))
        .map(task =>
          task.startsWith('9.')
            ? '9. REFACTOR: retain one response-validation and result-retention path; rerun the five CLI proof commands with exit 0 and byte-identical public response snapshots.'
            : task,
        ),
    },
    {
      name: 'Documentation consumer',
      purpose:
        'Publish the independent documentation consumer after the shared contract is proven.',
      prerequisites: 'Risk probe',
      boundary: 'Published command documentation only; no CLI routing changes.',
      proof: 'documentation-contract',
      completion: 'The documented command matches the proven shared contract.',
      tasks: [
        '1. RED: add the activation-states documentation fixture using the prerequisite shared contract and both disabled and enabled activation states. Run `bun run test:documentation-contract -- --fixture activation-states` and observe exit 1 because the rendered reference omits response fields, denial, or recovery conditions before editing `docs/commands/review.md`.',
        '2. GREEN: publish the accepted contract reference in `docs/commands/review.md`; state that typed response activation requires the completed CLI consumer and compatible reader. Rerun step 1 and assert enabled documentation matches the exact version-1 response schema, unauthorized denial names the review and exits 2 without dispatch or persistence, and disabling activation restores the prior reader with both stored formats readable. Assert disabled-state documentation preserves the prior contract and does not advertise typed activation as already available. This reference can ship while the CLI consumer is still inactive.',
        '3. REFACTOR: remove duplicate examples, then rerun the activation-states documentation command and assert identical rendered contracts in both states.',
      ],
    },
  ],
  obligationOwners: {
    'Accepted behavior': 'CLI consumer',
    'Migration work': 'Risk probe',
    'Rollout work': 'CLI consumer',
    'Rollback work': 'CLI consumer',
    'Documentation work': 'Documentation consumer',
    'Affected-surface work': 'CLI consumer',
  },
});

const MIGRATION_WITHOUT_COMPLETION_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'The migration and behavior activation form one coherent delivery change.',
  slices: [
    {
      ...ACTIVATION_SLICE,
      name: 'Behavior delivery',
      proof: ALL_DELIVERY_PROOFS,
      completion: 'Accepted behavior passes at the public boundary.',
    },
  ],
});
const MIGRATION_WITHOUT_DEPENDENCY_ORDER_PLAN = executionPlan({
  decision: 'multiple pull requests',
  rationale: 'Migration and activation are independently reviewable changes.',
  slices: [
    { ...CONTRACT_SLICE, name: 'Migration', purpose: 'Complete the accepted migration.' },
    {
      ...ACTIVATION_SLICE,
      name: 'Behavior activation',
      prerequisites: 'none',
    },
  ],
  obligationOwners: stagedOwners('Migration', 'Behavior activation'),
});
const INAPPLICABLE_OPTIONAL_WORK_PLAN = executionPlan({
  decision: 'one pull request',
  rationale: 'One accepted behavior is one independently provable change.',
  slices: [
    {
      ...ACTIVATION_SLICE,
      name: 'Behavior delivery',
      prerequisites: 'none',
      boundary:
        'The accepted behavior only; no migration, rollout, rollback, documentation, or additional surface work.',
      proof: 'behavior-boundary',
      completion: 'Accepted behavior passes at its public boundary.',
      tasks: permissionDenialTasks(
        'tests/review-cli.test.ts',
        'bun run test:review-cli -- --fixture denied-request',
        'src/review/command.ts',
      ),
    },
  ],
  applicableObligations: ['Accepted behavior'],
  inapplicableOptionalWork: true,
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
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [{ ...COMPLETE_DELIVERY_SLICE, [field]: undefined }],
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
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [COMPLETE_DELIVERY_SLICE],
      omittedObligation: obligation,
    }),
    [obligation],
  );
}

const conformanceCases: readonly ExecutionPlanConformanceCase[] = [
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
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [COMPLETE_DELIVERY_SLICE],
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
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [COMPLETE_DELIVERY_SLICE],
      unrealProof: true,
    }),
    ['proof', 'boundary'],
  ),
  approved(
    'purpose-in-rationale',
    'A coherent purpose stated in the rationale and boundary does not require a repeated label.',
    executionPlan({
      decision: 'one pull request',
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [{ ...COMPLETE_DELIVERY_SLICE, purpose: undefined }],
    }),
    'one_pull_request',
    ['Complete delivery'],
  ),
  approved(
    'boundary-in-tasks',
    'A clear boundary stated in the rationale and tasks does not require a repeated label.',
    executionPlan({
      decision: 'one pull request',
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [{ ...COMPLETE_DELIVERY_SLICE, boundary: undefined }],
    }),
    'one_pull_request',
    ['Complete delivery'],
  ),
  missingFieldCase('missing-prerequisites', 'prerequisites', 'prerequisite'),
  approved(
    'proof-in-tasks',
    'A slice proof obligation stated in its exact test steps does not require a repeated label.',
    executionPlan({
      decision: 'one pull request',
      rationale: COMPLETE_DELIVERY_RATIONALE,
      slices: [{ ...COMPLETE_DELIVERY_SLICE, proof: undefined }],
    }),
    'one_pull_request',
    ['Complete delivery'],
  ),
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
    ['independent', 'contract'],
  ),
  decisionChangingDiscovery(
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
      slices: [COMPLETE_DELIVERY_SLICE],
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
    ['Complete delivery'],
  ),
  {
    ...denied(
      'vague-data-ownership',
      'A vague store reference is denied and reported as an unnamed accepted data decision.',
      withDecisionAccounting(
        ONE_PLAN,
        '- One shared authorization service owns permission checks for every transport: unchanged\n- Host-neutral dependency order keeps every intermediate merge supported: unchanged\n- Use the appropriate store and ownership contract during implementation.',
      ),
      ['delivery.db', 'DeliveryStateService'],
    ),
    implementation_plan: DATA_IMPLEMENTATION_PLAN,
  },
  {
    ...decisionChangingDiscovery(
      'invented-data-ownership',
      'A concrete data design invented downstream is denied and reported as an invented data decision.',
      withDecisionAccounting(
        ONE_PLAN,
        '- One shared authorization service owns permission checks for every transport: unchanged\n- Host-neutral dependency order keeps every intermediate merge supported: unchanged\n- Store delivery evidence in Redis and let ReviewService own reads and writes.',
      ),
      ['Redis', 'ReviewService'],
    ),
  },
  {
    ...approved(
      'accepted-data-ownership',
      'The accepted concrete store and owner do not block semantic approval.',
      withRequiredReplacements(
        `${withDecisionAccounting(
          ONE_PLAN,
          '- One shared authorization service owns permission checks for every transport: unchanged\n- Host-neutral dependency order keeps every intermediate merge supported: unchanged\n- The project-local SQLite database `delivery.db` stores delivery evidence: unchanged\n- DeliveryStateService owns all reads and writes for that store: unchanged',
        ).trimEnd()}
| item-12 | testing | Prove delivery.db storage and DeliveryStateService ownership through the existing delivery workflow. | contributor | owned-store | open | missing | | |

## Accepted data decision execution

- Owner: Complete delivery.
- 12. RED: add the owned-store fixture in tests/delivery-state.test.ts with a known delivery-evidence row and a temporary delivery.db. Invoke the existing delivery workflow to write and read that evidence. Run bun run test tests/delivery-state.test.ts -t owned-store and observe exit 1 because the workflow does not read and write the evidence through DeliveryStateService into delivery.db before editing src/delivery-state.ts.
- 13. GREEN: route the existing delivery workflow's evidence reads and writes through the accepted DeliveryStateService in src/delivery-state.ts. Rerun step 12 by invoking that workflow and assert the exact fixture row is present in delivery.db, the workflow returns those same values, and the service's read/write trace contains every workflow evidence operation. Rerun the public response and authorization fixtures to assert unchanged responses and no unauthorized persistence.
- 14. REFACTOR: remove duplicate evidence access without changing the accepted store or owner; rerun the owned-store and public response commands with the same row, trace, and denial assertions.
`,
        [
          [
            '\n\n## Delivery checklist',
            '\n| owned-store | command | E2E | Existing delivery workflow writes and reads known evidence through DeliveryStateService against delivery.db. | real_boundary | current_required | {"type":"command","cwd":".","argv":["bun","run","test","tests/delivery-state.test.ts","-t","owned-store"]} |\n\n## Delivery checklist',
          ],
          [
            'Preserve both recorded implementation decisions.',
            'Preserve all four recorded implementation decisions, including delivery.db storage and DeliveryStateService ownership.',
          ],
        ],
      ),
      'one_pull_request',
      ['Complete delivery'],
    ),
    implementation_plan: DATA_IMPLEMENTATION_PLAN,
    expectation: {
      verdict: 'approve',
      planning_destination: 'plan-execution',
      slicing_decision: 'one_pull_request',
      slice_names: ['Complete delivery'],
      obligations: OBLIGATIONS,
      decisions: [
        ...DECISIONS,
        'The project-local SQLite database `delivery.db` stores delivery evidence.',
        'DeliveryStateService owns all reads and writes for that store.',
      ],
    },
  },
  missingObligationCase('missing-behavior-obligation', 'Accepted behavior'),
  {
    ...denied(
      'missing-decision-obligation',
      'Accepted decision-derived work has no owning slice.',
      executionPlan({
        decision: 'one pull request',
        rationale: COMPLETE_DELIVERY_RATIONALE,
        slices: [COMPLETE_DELIVERY_SLICE],
      }),
      ['decision-derived work'],
    ),
    implementation_plan: DECISION_OBLIGATION_IMPLEMENTATION_PLAN,
  },
  {
    ...denied(
      'missing-proof-strategy-obligation',
      'Accepted proof-strategy work has no owning slice.',
      executionPlan({
        decision: 'one pull request',
        rationale: COMPLETE_DELIVERY_RATIONALE,
        slices: [COMPLETE_DELIVERY_SLICE],
      }),
      ['proof-strategy work'],
    ),
    implementation_plan: PROOF_OBLIGATION_IMPLEMENTATION_PLAN,
  },
  missingObligationCase('missing-migration-obligation', 'Migration work'),
  missingObligationCase('missing-rollout-obligation', 'Rollout work'),
  missingObligationCase('missing-rollback-obligation', 'Rollback work'),
  missingObligationCase('missing-documentation-obligation', 'Documentation work'),
  missingObligationCase('missing-affected-surface-obligation', 'Affected-surface work'),
  {
    ...denied(
      'migration-missing-completion-signal',
      'Owned migration work without a migration completion signal is incomplete.',
      MIGRATION_WITHOUT_COMPLETION_PLAN,
      ['migration', 'completion signal'],
    ),
    implementation_plan: ORDERED_MIGRATION_IMPLEMENTATION_PLAN,
  },
  {
    ...denied(
      'migration-missing-dependency-order',
      'Owned migration work without its accepted dependency order is incomplete.',
      MIGRATION_WITHOUT_DEPENDENCY_ORDER_PLAN,
      ['migration', 'dependency'],
    ),
    implementation_plan: ORDERED_MIGRATION_IMPLEMENTATION_PLAN,
  },
  {
    ...approved(
      'explicitly-inapplicable-obligations',
      'One accepted behavior remains owned without manufacturing explicitly inapplicable optional work.',
      INAPPLICABLE_OPTIONAL_WORK_PLAN,
      'one_pull_request',
      ['Behavior delivery'],
    ),
    implementation_plan: INAPPLICABLE_OPTIONAL_WORK_IMPLEMENTATION_PLAN,
    expectation: {
      verdict: 'approve',
      planning_destination: 'plan-execution',
      slicing_decision: 'one_pull_request',
      slice_names: ['Behavior delivery'],
      obligations: ['Accepted behavior'],
      decisions: DECISIONS,
    },
  },
  denied(
    'absent-work-is-not-complete',
    'Absent implementation remains target work and cannot be called complete.',
    ABSENT_WORK_CLAIMED_COMPLETE_PLAN,
    ['absent', 'complete'],
  ),
  approved(
    'current-proof-supports-completion',
    'Matching implementation with current-revision real-boundary proof may be recorded as implemented and proven.',
    CURRENT_PROOF_PLAN,
    'one_pull_request',
    ['Complete delivery'],
  ),
  denied(
    'earlier-proof-remains-open',
    'Reusable earlier-revision proof remains open until current proof is collected.',
    EARLIER_PROOF_CLAIMED_CURRENT_PLAN,
    ['earlier', 'open'],
  ),
  denied(
    'known-defect-is-not-complete',
    'A known defect remains separate target correction work and cannot be called complete.',
    KNOWN_DEFECT_CLAIMED_COMPLETE_PLAN,
    ['defect', 'complete'],
  ),
  denied(
    'pending-human-authority-is-not-complete',
    'Completed contributor work remains incomplete while required human authority is pending.',
    PENDING_HUMAN_CLAIMED_COMPLETE_PLAN,
    ['human', 'pending'],
  ),
  {
    ...approved(
      'complete-measurement-execution',
      'Accepted measurement decisions map to owned instrumentation, tests, evidence collection, and a completion signal.',
      MEASUREMENT_PLAN,
      'one_pull_request',
      ['Complete delivery'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...denied(
      'missing-measurement-instrumentation',
      'Accepted measurement execution without the instrumentation work is denied.',
      MISSING_MEASUREMENT_INSTRUMENTATION_PLAN,
      ['instrumentation'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...denied(
      'missing-measurement-evidence-collection',
      'Accepted measurement execution without evidence collection is denied.',
      MISSING_MEASUREMENT_EVIDENCE_PLAN,
      ['evidence', 'collection'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...decisionChangingDiscovery(
      'changed-measurement-target',
      'Execution Planning cannot change the accepted Product-owned measurement target.',
      CHANGED_MEASUREMENT_TARGET_PLAN,
      ['target', '200'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...decisionChangingDiscovery(
      'changed-measurement-origin',
      'Execution Planning cannot change the accepted measurement origin.',
      CHANGED_MEASUREMENT_ORIGIN_PLAN,
      ['measurement origin', 'gateway'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...decisionChangingDiscovery(
      'weakened-measurement-safeguard',
      'Execution Planning cannot weaken an accepted measurement validity safeguard.',
      WEAKENED_MEASUREMENT_SAFEGUARD_PLAN,
      ['validity', '99'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  {
    ...decisionChangingDiscovery(
      'changed-measurement-failure-behavior',
      'Execution Planning cannot redefine accepted measurement failure behavior.',
      CHANGED_MEASUREMENT_FAILURE_PLAN,
      ['failure', 'rollout'],
    ),
    implementation_plan: MEASUREMENT_IMPLEMENTATION_PLAN,
  },
  decisionChangingDiscovery(
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
    'fixture-discovery-stays-in-execution-planning',
    'A discovered fixture implementation change preserves every accepted decision and proof boundary.',
    `${executionPlan({
      decision: 'one pull request',
      rationale:
        'The same public command contract requires only a mechanical fixture representation repair.',
      slices: [
        {
          ...COMPLETE_DELIVERY_SLICE,
          tasks: [
            ...ONE_DELIVERY_TASKS,
            '12. RED: add the literal-fixture regression in tests/fixtures/approved-plan.test.ts with the existing approved-plan expected contents. Run bun run test tests/fixtures/approved-plan.test.ts -t literal-fixture and observe exit 1 because the builder output differs from those expected contents before editing tests/fixtures/approved-plan.ts.',
            '13. GREEN: replace the builder in tests/fixtures/approved-plan.ts with a literal containing the same canonical expected contents. Rerun step 12 and bun run test:review-cli -- --fixture approved-plan; assert identical fixture bytes, exact public and stored responses, obligation owners, unchanged decisions, normalized plan digest, and delivery definition.',
            '14. REFACTOR: remove the unused builder and rerun both fixture and public-boundary commands with identical expected contents and actor assertions.',
          ],
        },
      ],
    })}\n## Discovery\n\nThe fixture implementation moves from a builder to a literal in steps 12–14 without changing behavior, API, data, or proof boundaries.\n`,
    'one_pull_request',
    ['Complete delivery'],
  ),
  approved(
    'test-command-discovery-stays-in-execution-planning',
    'A discovered test-command change preserves every accepted decision and proof boundary.',
    `${withRequiredReplacements(
      ONE_PLAN.replaceAll('bun run test:review-cli', 'bun run --cwd packages/cli test:review-cli'),
      [
        [
          JSON.stringify({ type: 'command', cwd: '.', argv: ['bun', 'run', 'test:review-cli'] }),
          JSON.stringify({
            type: 'command',
            cwd: 'packages/cli',
            argv: ['bun', 'run', 'test:review-cli'],
          }),
        ],
      ],
    )}\n## Discovery\n\nThe existing public-review boundary suite lives in packages/cli. Its task invocations now run the same test:review-cli script through that package-local runner from the project root; its behavior-boundary proof uses cwd packages/cli. Fixture inputs, response and actor assertions, and the public CLI subprocess boundary are unchanged.\n`,
    'one_pull_request',
    ['Complete delivery'],
  ),
  approved(
    'path-only-discovery-stays-in-execution-planning',
    'A file or helper location change with no contract consequence stays in Execution Planning.',
    `${ONE_PLAN}\n## Discovery\n\nMove one helper file without changing behavior, API, data, or proof boundaries.\n`,
    'one_pull_request',
    ['Complete delivery'],
  ),
  decisionChangingDiscovery(
    'accepted-design-discovery-returns-to-implementation-planning',
    'A discovery requires replacing the accepted shared authorization design.',
    `${ONE_PLAN}\n## Discovery\n\nImplementation requires moving authorization ownership from the accepted shared service into each transport.\n`,
    ['authorization', 'decision'],
  ),
  decisionChangingDiscovery(
    'accepted-proof-discovery-returns-to-implementation-planning',
    'A discovery requires replacing an accepted real-boundary proof with structural evidence.',
    `${ONE_PLAN}\n## Discovery\n\nThe accepted public CLI proof cannot run; replace it with a parser unit test that does not exercise that boundary.\n`,
    ['proof', 'boundary'],
  ),
  decisionChangingDiscovery(
    'path-and-api-discovery-returns-to-implementation-planning',
    'A file-path discovery also changes the accepted API contract.',
    `${ONE_PLAN}\n## Discovery\n\nMove the handler file and replace the accepted public command response with a new API contract.\n`,
    ['api', 'contract'],
  ),
  {
    ...approved(
      'fresh-context-first-red',
      'A fresh-context agent can begin with the named highest-risk RED without inventing a decision.',
      STARTABLE_PLAN,
      'one_pull_request',
      ['Authorization denial'],
    ),
    implementation_plan: INAPPLICABLE_OPTIONAL_WORK_IMPLEMENTATION_PLAN,
    expectation: {
      verdict: 'approve',
      planning_destination: 'plan-execution',
      slicing_decision: 'one_pull_request',
      slice_names: ['Authorization denial'],
      obligations: ['Accepted behavior'],
      decisions: DECISIONS,
    },
  },
  {
    ...approved(
      'exact-cli-denial-proof',
      'A complete proof step names its fixture, command, edit action, denied exit assertion, and installed CLI subprocess boundary.',
      EXACT_CLI_DENIAL_PROOF_PLAN,
      'one_pull_request',
      ['Edited-plan denial proof'],
    ),
    implementation_plan: PROOF_ONLY_IMPLEMENTATION_PLAN,
    expectation: {
      verdict: 'approve',
      planning_destination: 'plan-execution',
      slicing_decision: 'one_pull_request',
      slice_names: ['Edited-plan denial proof'],
      obligations: ['Accepted behavior'],
      decisions: DECISIONS,
    },
  },
  {
    ...denied(
      'missing-cli-subprocess-boundary',
      'A proof step with a placeholder actor boundary is denied with the missing subprocess boundary named.',
      MISSING_CLI_SUBPROCESS_BOUNDARY_PLAN,
      ['subprocess', 'boundary'],
    ),
    implementation_plan: PROOF_ONLY_IMPLEMENTATION_PLAN,
  },
  {
    ...denied(
      'missing-denied-exit-assertion',
      'A proof step with a placeholder denied-exit result is denied with the missing exit assertion named.',
      MISSING_DENIED_EXIT_ASSERTION_PLAN,
      ['exit', 'assertion'],
    ),
    implementation_plan: PROOF_ONLY_IMPLEMENTATION_PLAN,
  },
  decisionChangingDiscovery(
    'later-step-is-not-startable',
    'A concrete first RED cannot hide an unresolved behavior decision in the fourth step.',
    LATER_UNSTARTABLE_PLAN,
    ['behavior', 'decision'],
  ),
  denied(
    'blocked-first-prerequisite',
    'The first planned slice depends on an incomplete prerequisite and is not startable.',
    BLOCKED_FIRST_PREREQUISITE_PLAN,
    ['prerequisite', 'startable'],
  ),
  denied(
    'no-executable-steps',
    'A plan with no executable task leaves a fresh agent with no startable step.',
    NO_EXECUTABLE_STEPS_PLAN,
    ['executable', 'step'],
  ),
  approved(
    'risk-first-ordering',
    'Independent work orders the highest-risk probe before activation.',
    RISK_FIRST_PLAN,
    'multiple_pull_requests',
    ['Risk probe', 'Activation'],
  ),
  approved(
    'parallel-safe-after-probe',
    'Independent consumers may proceed in parallel after the shared risk probe.',
    PARALLEL_AFTER_PROBE_PLAN,
    'multiple_pull_requests',
    ['Risk probe', 'CLI consumer', 'Documentation consumer'],
  ),
];

export const EXECUTION_PLAN_CONFORMANCE_CASES: readonly ExecutionPlanConformanceCase[] =
  conformanceCases.map(testCase => ({
    ...testCase,
    accepted_scenario: acceptedBehaviorScenario(testCase.implementation_plan),
  }));

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
