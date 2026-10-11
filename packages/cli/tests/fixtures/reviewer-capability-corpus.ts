import {
  createExecutionPlanDeliveryDefinition,
  DELIVERY_CHECKLIST_CATEGORIES,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import type { CapabilityManifest } from '../../src/review/capability-eval.js';
import type { ReviewPacket } from '../../src/review/contract.js';
import { reviewerPromptInstructions } from '../../src/review/review-rubric.js';
import { reviewOutputSchema } from '../../src/review/runtime.js';

const reviewerPlaceholder = '{{reviewer}}';
export const REVIEWER_CAPABILITY_RUBRICS = {
  product: reviewerPromptInstructions('quality-review', reviewerPlaceholder, 'product-plan'),
  product_schema: reviewOutputSchema('quality-review'),
  implementation: reviewerPromptInstructions(
    'plan-implementation',
    reviewerPlaceholder,
    'plan-implementation',
  ),
  implementation_schema: reviewOutputSchema('plan-implementation'),
  execution: reviewerPromptInstructions('plan-execution', reviewerPlaceholder, 'plan-execution'),
  execution_schema: reviewOutputSchema('plan-execution'),
};

const ticket = `# Ticket: Show current review status to builders

Goal: A builder can distinguish Pending, Approved, and Rejected plan reviews in the CLI. Rejected reviews show the actual blocking findings and permit repair and retry. An interrupted review or a finished review without a valid approval receipt stays Pending with its actual error and a retry action; neither condition invents rejection findings. Approval still requires the existing authenticated approval receipt. No new approval authority, storage system, or notification channel is in scope.`;

const productPlan = `# Product Plan: Show current review status

## Accepted behavior

- Persona: the builder requesting a plan review.
- Surface: the CLI review status display.
- Pending means the current review has no completed, authenticated approval or blocking reviewer verdict. A running review shows its running state. An interrupted review or a finished review without a valid approval receipt stays Pending with its actual error and a retry action; it never invents rejection findings.
- Approved means the current review has an authenticated approval receipt.
- Rejected means the current review concluded with blocking findings. Show those actual findings, and allow the builder to repair the plan and start a new review.
- A stale approval never changes the current review to Approved.
- A stale approval is a receipt for a different review job or different plan bytes. The display begins only after a review is requested; a never-requested state is outside this ticket.

## Builder outcomes

- Success: a current authenticated receipt displays Approved.
- Refusal: a reviewer verdict with blocking findings displays Rejected and those findings; no new viewer-permission refusal applies to this existing CLI command.
- Failure: interruption or a missing valid receipt displays Pending with the actual error and retry action, not a fabricated rejection.
- Approval and trust: only the authenticated receipt for the current job and plan bytes can display Approved.
- Recovery: repair and retry after Rejected, or retry the interrupted or receipt-missing review without changing plan scope.

## Scope and exclusions

Only the status display and retry path change. Existing approval authority and storage remain in place. Notifications and automatic repair are excluded.

## Evidence and decisions

Known facts: the ticket accepts three statuses and the existing authenticated receipt is the only approval authority. Assumption: the existing CLI command adds no new viewer-permission gate. Unresolved product decisions: none; the ticket specifies interrupted and receipt-missing behavior. No quantitative target is promised.

## Observable done state

A builder can distinguish all three current outcomes, see only actual blocking findings after rejection, and retry a repaired or interrupted review. A missing or stale receipt cannot appear as approval or create a false rejection.`;

const productWithoutRejection = `# Product Plan: Show current review status

## Accepted behavior

- Persona: the builder requesting a plan review.
- Surface: the CLI review status display.
- Pending means the review has not finished.
- Approved means the review has an authenticated approval receipt.

## Scope and exclusions

Only the status display changes. New approval authority and notifications are excluded.

## Observable done state

A builder can distinguish Pending from Approved.`;

const scenarios = `# Accepted scenarios

1. An unfinished current review displays Pending.
2. A current authenticated approval displays Approved.
3. A completed review with blocking findings displays Rejected and those actual findings.
4. After repairing a rejected plan, the builder can request a new review; a stale approval cannot approve it.
5. An interrupted review displays Pending with its actual error and permits retry without changing plan bytes.
6. A finished nonblocking review without a valid receipt displays Pending with its actual receipt error, no invented rejection findings, and permits retry without changing plan bytes.`;

const implementationPlan = `# Implementation Plan: Show current review status

## Architecture at a glance

The CLI reads the existing coordinator's current job and authenticated receipt. One presentation mapper turns that trusted state into Pending, Approved, or Rejected; it creates no second authority or store.

## Approach decisions and consequences

- Use the current job identifier and plan digest to bind the display to the active review. A previous job or receipt cannot supply Approved for changed plan bytes.
- The coordinator's authenticated approval receipt is the only source of Approved. Reviewer prose and an unauthenticated verdict cannot grant approval.
- A terminal rejected job supplies its recorded error findings verbatim to the CLI. The mapper does not synthesize rejection reasons or hide a real blocking finding.
- Retry creates a new review for repaired plan bytes, or for unchanged bytes after interruption or receipt failure; the old rejection and receipt remain historical evidence, never current authority.
- The coordinator atomically binds each retry to its new job identifier and plan digest. Concurrent retries may finish in any order; only the job currently bound to the plan may drive the displayed status. A crash before that binding leaves the prior terminal state visible and retryable, never falsely Approved.
- A running review displays Pending. An interrupted review displays Pending with its actual error and a retry action for unchanged bytes; it never displays Approved.
- A finished nonblocking review without a valid approval receipt displays Pending with the actual receipt error and a retry action; it never invents a rejection finding.

The alternative of persisting a separate CLI status loses synchronization with the coordinator after a retry or plan edit, so the mapper reads existing trusted records instead. This is a reversible local presentation change; no durable architecture record is needed.

## Contracts, failure behavior, and proof

The CLI status contract has exactly Pending, Approved, and Rejected. Missing or stale receipt means no approval. A failed status read reports unavailable state rather than inventing approval. Exercise all six accepted scenarios through the real CLI and coordinator boundary, including a stale receipt, actual rejection findings, interrupted retry, and finished receipt-missing retry. For both failure cases assert Pending, the actual error, no invented rejection findings, and a working retry that binds a new current job without changing plan bytes. An isolated mapper test cannot prove the public wiring; the CLI integration proof has that limit. Roll out with the existing CLI release, and roll back the presentation mapper if the user-visible state is wrong.

Architecture applicability: the CLI-to-coordinator contract is affected; no shared API or data owner changes. Data applicability: skip: no store, schema, ownership, retention, migration, or cross-system flow changes. Compatibility: the existing coordinator record and CLI exit codes stay unchanged; the new displayed Rejected label is additive to the human-readable status. Measurement applicability: skip: the Product Plan promises no quantitative target. Authorization stays with the existing authenticated receipt. Documentation impact: update the CLI status help text. Known deviations: none. Revisit the mapper only if the coordinator's receipt or job contract changes. No load-bearing external library choice is needed.`;

const implementationWithoutReceipt = implementationPlan.replace(
  "- The coordinator's authenticated approval receipt is the only source of Approved. Reviewer prose and an unauthenticated verdict cannot grant approval.\n",
  '- The reviewer output verdict is enough to display Approved, even before an authenticated approval receipt exists.\n',
);

const proofId = 'cli-status-integration';
const proofBoundary = 'CLI status command through the coordinator and authenticated receipt';
const proofInvocation = {
  type: 'command',
  cwd: 'packages/cli',
  argv: ['bun', 'run', 'test', 'tests/integration/review-status.test.ts'],
};
const checklistObligations = [
  'Show Pending, Approved, and Rejected with actual blocking findings and retry.',
  'Keep the authenticated receipt as the only approval authority.',
  'Complete the one status slice without a later merge dependency.',
  'Prove all six accepted scenarios through the CLI and coordinator.',
  'Preserve coordinator storage and CLI exit-code compatibility.',
  'Report status-read failures without inventing approval.',
  'Reject stale or missing approval receipts and preserve actual findings.',
  'Ship with the CLI release and revert the mapper if status is wrong.',
  'Update CLI status help text for all three states.',
  'Keep contributor work separate from any later human merge decision.',
  'Retain current real-boundary CLI integration evidence before completion.',
] as const;

function executionPlan(includeRejection: boolean): string {
  const completionSignal = includeRejection
    ? 'all six accepted scenarios pass through the CLI entry point and the status help text names all three states'
    : 'Pending and Approved pass through the CLI entry point and the status help text names those two states';
  const redSignal = includeRejection
    ? 'the missing Rejected/receipt-bound assertions fail'
    : 'the missing Pending/Approved assertions fail';
  const rejectionStep = includeRejection
    ? 'The same integration fixture must assert that a terminal rejection displays its actual error findings, that a repaired plan starts a new review, and that a concurrently completed non-current job cannot drive the displayed status. Simulate a crash before retry binding and assert the prior terminal state remains visible and retryable. For an interrupted review and a finished nonblocking review without a valid receipt, assert Pending, the actual error, no invented rejection findings, and a working retry that binds a new current job without changing plan bytes. Simulate a failed status read and assert unavailable rather than Approved.'
    : 'The integration fixture covers Pending and Approved states.';
  const authorityStep = includeRejection
    ? 'Through the CLI and coordinator, test a receipt for another job, a receipt for a different plan digest under the current job, and an unauthenticated approval verdict without a receipt; each must remain non-Approved. For a finished nonblocking job without a valid receipt, assert Pending with its actual receipt error and retry action. Assert unchanged CLI process exit codes for successful and failed reads against the pre-change baseline, and assert status reads leave coordinator records byte-identical.'
    : '';
  const decisionStatus = includeRejection
    ? 'Decision status: current job-and-digest binding, receipt-only approval, verbatim rejection findings, retry as a new review, atomic concurrent retry binding and crash behavior, interrupted and finished receipt-missing Pending with actual errors and unchanged-byte retry, and failed-read unavailability remain unchanged from the Implementation Plan.'
    : "Decision status: the Implementation Plan's existing coordinator/receipt source of truth is unchanged.";
  return `# Execution Plan: Show current review status

## Slicing decision

One pull request: the status mapper and its public CLI proof are one cohesive change. There is one slice and no unmerged successor dependency.

## Slice 1: Current review status

Purpose: show the accepted current status without creating approval authority. Boundary: CLI presentation over the existing coordinator and receipt. Inputs: accepted scenarios and Implementation Plan. Slice prerequisites: none. Completion signal: ${completionSignal}. Relies on unmerged successor: false.

First RED: add the failing tests/integration/review-status.test.ts fixture, run bun run test tests/integration/review-status.test.ts from packages/cli, and observe ${redSignal} before editing production code. Then implement the mapper and CLI wiring. ${rejectionStep} ${authorityStep} Run the same command again; exit 0 and the stated assertions are required. Finally update CLI help text and rerun the integration proof.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| ${proofId} | command | integration | ${proofBoundary} | real_boundary | current_required | ${JSON.stringify(proofInvocation)} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => `| status-${index + 1} | ${category} | ${checklistObligations[index]} | contributor | ${proofId} | open | missing | | |`).join('\n')}

${decisionStatus} Obligation owner: Current review status, Slice 1. The plan does not claim implementation, verification, merge, or deployment completion.`;
}

const commonContext = [
  { path: '.project/tickets/CAP100/ticket.md', content: ticket },
  { path: '.project/tickets/CAP100/scenarios.md', content: scenarios },
  {
    path: '.project/principles.md',
    content:
      'Existing authenticated receipts remain the only approval authority. Keep changes local and reversible.',
  },
  {
    path: '.project/personas.md',
    content:
      'Accepted persona: Builder. The builder needs current CLI status, actual rejection findings, and a repair and retry path.',
  },
  {
    path: '.project/surfaces.md',
    content:
      'Affected surface: the existing CLI review-status command. No other user surface is in this ticket.',
  },
  {
    path: '.project/non-goals.md',
    content: 'No new approval authority, status store, or notification channel.',
  },
  {
    path: '.project/tickets/CAP100/boundaries.md',
    content:
      'This ticket has no parent or milestone with additional scope boundaries. No architecture record applies to the local presentation mapper.',
  },
];

function packet(
  id: string,
  kind: ReviewPacket['kind'],
  planningPhase: ReviewPacket['planning_phase'],
  path: string,
  content: string,
): ReviewPacket {
  const contextFiles = [...commonContext];
  if (kind !== 'quality-review') {
    contextFiles.push({ path: '.project/tickets/CAP100/spec.md', content: productPlan });
  }
  if (kind === 'plan-execution') {
    contextFiles.push({
      path: '.project/tickets/CAP100/impl-plan.md',
      content: implementationPlan,
    });
  }
  const executionFields = (() => {
    if (kind !== 'plan-execution') return {};
    const parsed = parseDeliveryPlanContract(content);
    if (!parsed.ok) throw new Error(`Invalid capability Execution Plan: ${parsed.message}`);
    return {
      execution_plan_delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
      execution_plan_normalized_digest: normalizedExecutionPlanDigest(content),
    };
  })();
  return {
    schema_version: 1,
    dispatch_id: id,
    kind,
    planning_phase: planningPhase,
    logical_files: [{ path, content }],
    context_files: contextFiles,
    ...executionFields,
  };
}

export const REVIEWER_CAPABILITY_MANIFEST: CapabilityManifest = {
  schema_version: 1,
  owner: 'Safeword release maintainers',
  floor: { runs_per_fixture: 3, minimum_fixture_passes: 2, minimum_total_percent: 90 },
  settings: {
    anthropic_model: 'claude-opus-5',
    openai_model: 'gpt-6.1-sol',
    tools: 'review prompt forbids tools',
    claude_effort: 'medium',
    codex_reasoning: 'medium',
    review_timeout_ms: '600000',
    review_run_bound_ms: '1800000',
  },
  fixtures: [
    {
      label: { id: 'product-approve', verdict: 'approve', required: [], forbidden: [] },
      packet: packet('product-approve', 'quality-review', 'product-plan', 'spec.md', productPlan),
    },
    {
      label: {
        id: 'product-reject',
        verdict: 'request_changes',
        required: ['reject'],
        forbidden: [],
      },
      packet: packet(
        'product-reject',
        'quality-review',
        'product-plan',
        'spec.md',
        productWithoutRejection,
      ),
    },
    {
      label: { id: 'implementation-approve', verdict: 'approve', required: [], forbidden: [] },
      packet: packet(
        'implementation-approve',
        'plan-implementation',
        'plan-implementation',
        'impl-plan.md',
        implementationPlan,
      ),
    },
    {
      label: {
        id: 'implementation-reject',
        verdict: 'request_changes',
        required: ['authenticated'],
        forbidden: [],
      },
      packet: packet(
        'implementation-reject',
        'plan-implementation',
        'plan-implementation',
        'impl-plan.md',
        implementationWithoutReceipt,
      ),
    },
    {
      label: { id: 'execution-approve', verdict: 'approve', required: [], forbidden: [] },
      packet: packet(
        'execution-approve',
        'plan-execution',
        'plan-execution',
        'execution-plan.md',
        executionPlan(true),
      ),
    },
    {
      label: {
        id: 'execution-reject',
        verdict: 'request_changes',
        required: ['reject'],
        forbidden: [],
      },
      packet: packet(
        'execution-reject',
        'plan-execution',
        'plan-execution',
        'execution-plan.md',
        executionPlan(false),
      ),
    },
  ],
};
