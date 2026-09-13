import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import { shellQuote } from '../cli-protocol/replay-command.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  createExecutionPlanDeliveryDefinition,
  type DeliveryChecklistItem,
  type DeliveryProofSpecification,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
  updateDeliveryChecklistFile,
} from '../execution-plan/delivery-checklist.js';
import {
  captureDeliveryProofSubject,
  currentDeliveryProofSubject,
  executeDeliveryCommandProof,
} from '../execution-plan/delivery-proof.js';
import {
  appendDeliveryProof,
  currentDesignDecision,
  readDeliveryProof,
} from '../review/approval-ledger.js';
import type {
  ExecutionPlanDeliveryDefinition,
  UnverifiedReviewerOutput,
} from '../review/contract.js';
import { validateExecutionPlanOutput } from '../review/execution-plan-output.js';
import { reviewJobStatus } from '../review/job.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

type ReadinessState =
  | 'contributor_work_incomplete'
  | 'contributor_work_complete'
  | 'ready_for_human_review'
  | 'human_approval_satisfied_merge_pending';

interface DeliveryContext {
  readonly cwd: string;
  readonly ticketId: string;
  readonly ticketDirectory: string;
  readonly planPath: string;
  readonly plan: string;
  readonly ledgerPath: string;
  readonly items: readonly DeliveryChecklistItem[];
  readonly specifications: readonly DeliveryProofSpecification[];
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly definitionDigest: string;
  readonly admittedReviewId: string;
}

type DeliveryContextResult =
  | { readonly ok: true; readonly context: DeliveryContext }
  | { readonly ok: false; readonly result: CliResult };

function findingResult(
  command: string,
  code: string,
  message: string,
  recovery: string,
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'warning' }],
    recovery: [{ command: recovery, description: message, requiresHuman: false }],
    data: { command },
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function designApprovalEnabled(cwd: string): boolean | undefined {
  const path = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(path)) return false;
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    return (value as { designApprovalGate?: unknown }).designApprovalGate === true;
  } catch {
    return undefined;
  }
}

function healthyReviewData(cwd: string, reviewId: string): Record<string, unknown> | undefined {
  const status = reviewJobStatus(cwd, reviewId);
  if (status.state !== 'healthy') return undefined;
  if (typeof status.data !== 'object' || status.data === null) return undefined;
  return status.data as Record<string, unknown>;
}

function approvedReviewOutput(
  cwd: string,
  reviewId: string,
  planPath: string,
  definition: ExecutionPlanDeliveryDefinition,
  digest: string,
): UnverifiedReviewerOutput | undefined {
  const data = healthyReviewData(cwd, reviewId);
  if (data === undefined) return undefined;
  if (data.status !== 'approved' || data.review_kind !== 'plan-execution') return undefined;
  const targets = data.review_targets;
  if (!Array.isArray(targets)) return undefined;
  const coversPlan = targets.some(
    target => typeof target === 'string' && nodePath.resolve(cwd, target) === planPath,
  );
  if (!coversPlan) return undefined;
  if (typeof data.reviewer_output !== 'object' || data.reviewer_output === null) return undefined;
  const output = data.reviewer_output as UnverifiedReviewerOutput;
  return validateExecutionPlanOutput(output, definition, digest).kind === 'approved'
    ? output
    : undefined;
}

function admittedPlanReview(input: {
  readonly cwd: string;
  readonly ticketDirectory: string;
  readonly planPath: string;
  readonly ledger: string;
  readonly definition: ExecutionPlanDeliveryDefinition;
  readonly digest: string;
}): string | undefined {
  const scope = `${nodePath.basename(input.ticketDirectory)}:phase@plan-execution`;
  const candidates = parseReviewStamps(input.ledger)
    .filter(stamp => stamp.scope === scope && stamp.skipReason === undefined)
    .toReversed();
  for (const stamp of candidates) {
    if (
      stamp.reviewId !== undefined &&
      approvedReviewOutput(
        input.cwd,
        stamp.reviewId,
        input.planPath,
        input.definition,
        input.digest,
      ) !== undefined
    ) {
      return stamp.reviewId;
    }
  }
  return undefined;
}

function loadDeliveryContext(
  cwd: string,
  ticketId: string,
  command: string,
): DeliveryContextResult {
  const ticketDirectory = resolveTicketDirectory(cwd, ticketId);
  if (ticketDirectory === undefined) {
    return {
      ok: false,
      result: findingResult(
        command,
        'ticket_not_found',
        `Ticket ${ticketId} was not found.`,
        'safeword ticket list',
      ),
    };
  }
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const planPath = nodePath.join(ticketDirectory, 'execution-plan.md');
  if (!existsSync(ticketPath) || !existsSync(planPath)) {
    return {
      ok: false,
      result: findingResult(
        command,
        'missing_execution_plan',
        `Ticket ${ticketId} has no execution-plan.md.`,
        `safeword review run plan-execution ${nodePath.relative(cwd, planPath)}`,
      ),
    };
  }
  if (readFrontmatterScalar(readFileSync(ticketPath, 'utf8'), 'type') !== 'feature') {
    return {
      ok: false,
      result: findingResult(
        command,
        'missing_execution_plan',
        'Delivery Checklists are feature Execution Plan artifacts.',
        'Use the task or patch workflow for this ticket.',
      ),
    };
  }
  const plan = readFileSync(planPath, 'utf8');
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) {
    return {
      ok: false,
      result: findingResult(
        command,
        parsed.code,
        parsed.message,
        `Repair ${nodePath.relative(cwd, planPath)} and rerun plan-execution review.`,
      ),
    };
  }
  const designApprovalGate = designApprovalEnabled(cwd);
  if (designApprovalGate === undefined) {
    return {
      ok: false,
      result: createResult({
        state: 'failed',
        errors: [
          {
            code: 'CONFIG_UNREADABLE',
            message: '.safeword/config.json is unreadable.',
            retryable: false,
          },
        ],
        data: { command },
      }),
    };
  }
  const definition = createExecutionPlanDeliveryDefinition(parsed, designApprovalGate);
  const digest = normalizedExecutionPlanDigest(plan);
  const ledgerPath = nodePath.join(resolveNamespaceRoot(cwd), 'skill-invocations.log');
  let ledger: string;
  try {
    ledger = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
  } catch {
    return {
      ok: false,
      result: createResult({
        state: 'failed',
        errors: [
          {
            code: 'REVIEW_LEDGER_UNREADABLE',
            message: 'The review ledger is unreadable.',
            retryable: false,
          },
        ],
        data: { command },
      }),
    };
  }
  const admittedReviewId = admittedPlanReview({
    cwd,
    ticketDirectory,
    planPath,
    ledger,
    definition,
    digest,
  });
  if (admittedReviewId === undefined) {
    return {
      ok: false,
      result: findingResult(
        command,
        'review_required',
        'The current Execution Plan has no admitted plan-execution review.',
        `safeword review run plan-execution ${nodePath.relative(cwd, planPath)}`,
      ),
    };
  }
  return {
    ok: true,
    context: {
      cwd,
      ticketId,
      ticketDirectory,
      planPath,
      plan,
      ledgerPath,
      items: parsed.items,
      specifications: parsed.specifications,
      definition,
      definitionDigest: sha256(JSON.stringify(definition)),
      admittedReviewId,
    },
  };
}

function receiptId(item: DeliveryChecklistItem): string | undefined {
  const locator = item.evidence.split('; compatible:', 1)[0];
  return locator?.startsWith('receipt:') ? locator.slice('receipt:'.length) : undefined;
}

function receiptMatchesItem(
  context: DeliveryContext,
  item: DeliveryChecklistItem,
  id: string | undefined,
): ReturnType<typeof readDeliveryProof> {
  const event = id === undefined ? undefined : readDeliveryProof(context.ledgerPath, id);
  return event?.ticket === context.ticketId &&
    event.itemId === item.id &&
    event.proofId === item.requiredProof &&
    event.definitionDigest === context.definitionDigest &&
    event.qualification === 'real_boundary'
    ? event
    : undefined;
}

function contributorItemSatisfied(context: DeliveryContext, item: DeliveryChecklistItem): boolean {
  if (item.disposition === 'not_applicable') return true;
  if (item.disposition !== 'complete') return false;
  const event = receiptMatchesItem(context, item, receiptId(item));
  if (event === undefined) return false;
  const currency = currentDeliveryProofSubject({
    projectRoot: context.cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
    producingRevision: event.producingRevision,
  });
  return currency.ok && currency.current;
}

function designApprovalSatisfied(context: DeliveryContext, item: DeliveryChecklistItem): boolean {
  const prefix = `design-approval:${context.ticketId}:`;
  if (!item.evidence.startsWith(prefix)) return false;
  const digest = item.evidence.slice(prefix.length);
  const implementationPlan = nodePath.join(context.ticketDirectory, 'impl-plan.md');
  if (!existsSync(implementationPlan)) return false;
  const currentDigest = sha256(readFileSync(implementationPlan, 'utf8'));
  return (
    digest === currentDigest &&
    currentDesignDecision(context.ledgerPath, context.ticketId, digest) === 'approved'
  );
}

function readiness(context: DeliveryContext): {
  readonly state: ReadinessState;
  readonly openContributorItems: readonly DeliveryChecklistItem[];
  readonly pendingHumanItems: readonly DeliveryChecklistItem[];
} {
  const contributorItems = context.items.filter(item => item.owner === 'contributor');
  const openContributorItems = contributorItems.filter(
    item => !contributorItemSatisfied(context, item),
  );
  const humanItems = context.items.filter(
    item => item.owner === 'human' && item.disposition === 'pending_human',
  );
  const pendingHumanItems = humanItems.filter(item => !designApprovalSatisfied(context, item));
  if (openContributorItems.length > 0) {
    return { state: 'contributor_work_incomplete', openContributorItems, pendingHumanItems };
  }
  if (pendingHumanItems.length > 0) {
    return { state: 'ready_for_human_review', openContributorItems, pendingHumanItems };
  }
  return {
    state:
      humanItems.length > 0
        ? 'human_approval_satisfied_merge_pending'
        : 'contributor_work_complete',
    openContributorItems,
    pendingHumanItems,
  };
}

export function observeDeliveryChecklist(cwd: string, ticketId: string): CliResult {
  const command = 'ticket delivery-checklist';
  const loaded = loadDeliveryContext(cwd, ticketId, command);
  if (!loaded.ok) return loaded.result;
  const projected = readiness(loaded.context);
  const next = projected.openContributorItems[0] ?? projected.pendingHumanItems[0];
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: projected.state,
        message:
          next === undefined
            ? 'The Delivery Checklist is complete; merge authorization remains pending.'
            : `Next obligation: ${next.obligation}`,
        severity: 'warning',
      },
    ],
    data: {
      command,
      readiness_state: projected.state,
      open_contributor_items: projected.openContributorItems.map(item => item.id),
      pending_human_items: projected.pendingHumanItems.map(item => item.id),
    },
  });
}

function specificationFor(
  context: DeliveryContext,
  itemId: string,
  proofId: string,
):
  CliResult | { readonly item: DeliveryChecklistItem; readonly proof: DeliveryProofSpecification } {
  const item = context.items.find(candidate => candidate.id === itemId);
  if (item === undefined) {
    return findingResult(
      'ticket record-delivery-proof',
      'unknown_checklist_item',
      `Delivery Checklist item ${itemId} was not found.`,
      `safeword ticket delivery-checklist ${context.ticketId}`,
    );
  }
  const proof = context.specifications.find(candidate => candidate.id === proofId);
  if (proof === undefined || item.requiredProof !== proofId) {
    return findingResult(
      'ticket record-delivery-proof',
      'proof_id_mismatch',
      `Item ${itemId} requires proof ${item.requiredProof}.`,
      `safeword ticket record-delivery-proof ${context.ticketId} ${itemId} ${item.requiredProof}`,
    );
  }
  return { item, proof };
}

function proofFailure(
  code: string,
  message: string,
  ticketId: string,
  itemId: string,
  proofId: string,
): CliResult {
  return findingResult(
    'ticket record-delivery-proof',
    code,
    message,
    `safeword ticket record-delivery-proof ${ticketId} ${itemId} ${proofId}`,
  );
}

interface RetainedProofEvidence {
  readonly stdout?: { readonly bytes: number; readonly sha256: string };
  readonly stderr?: { readonly bytes: number; readonly sha256: string };
  readonly sourceReviewId?: string;
}

async function runRetainedProof(
  context: DeliveryContext,
  proof: DeliveryProofSpecification,
  itemId: string,
): Promise<CliResult | RetainedProofEvidence> {
  if (proof.method === 'review_receipt') {
    if (proof.invocation.type === 'review_receipt' && proof.invocation.kind === 'plan-execution') {
      return { sourceReviewId: context.admittedReviewId };
    }
    return proofFailure(
      'review_required',
      'The retained proof review is not currently admitted.',
      context.ticketId,
      itemId,
      proof.id,
    );
  }
  if (proof.invocation.type !== 'command') {
    return proofFailure(
      'invalid_execution_plan',
      'The retained command proof has an invalid invocation.',
      context.ticketId,
      itemId,
      proof.id,
    );
  }
  const execution = await executeDeliveryCommandProof({
    projectRoot: context.cwd,
    specification: { ...proof, method: 'command', invocation: proof.invocation },
  });
  if (
    execution.termination.exitCode !== 0 ||
    execution.termination.signal !== null ||
    execution.termination.timedOut
  ) {
    return proofFailure(
      'proof_command_failed',
      'The retained proof command did not pass.',
      context.ticketId,
      itemId,
      proof.id,
    );
  }
  return { stdout: execution.stdout, stderr: execution.stderr };
}

function ledgerWriteFailure(): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'REVIEW_LEDGER_WRITE_FAILED',
        message: 'The proof receipt could not be written safely.',
        retryable: true,
      },
    ],
    data: { command: 'ticket record-delivery-proof' },
  });
}

function successfulProofResult(
  context: DeliveryContext,
  itemId: string,
  proofId: string,
  receipt: string,
  revision: string,
): CliResult {
  const refreshed = parseDeliveryPlanContract(readFileSync(context.planPath, 'utf8'));
  const next = refreshed.ok
    ? refreshed.items.find(item => item.owner === 'contributor' && item.disposition === 'open')
    : undefined;
  return createResult({
    state: 'changed',
    changed: true,
    effects: {
      files: [context.ledgerPath, context.planPath].map(target => ({
        kind: 'update',
        target: nodePath.relative(context.cwd, target),
      })),
    },
    data: {
      command: 'ticket record-delivery-proof',
      ticket: context.ticketId,
      item_id: itemId,
      proof_id: proofId,
      receipt_id: receipt,
      producing_revision: revision,
      ...(next !== undefined && { next_open_obligation: next.obligation }),
    },
  });
}

function appendProofReceipt(
  context: DeliveryContext,
  itemId: string,
  proof: DeliveryProofSpecification,
  revision: string,
  evidence: RetainedProofEvidence,
) {
  return appendDeliveryProof(context.ledgerPath, {
    ticket: context.ticketId,
    itemId,
    proofId: proof.id,
    method: proof.method,
    scope: proof.scope,
    boundary: proof.boundary,
    qualification: proof.qualifiesAs,
    producingRevision: revision,
    definitionDigest: context.definitionDigest,
    invocationDigest: sha256(JSON.stringify(proof.invocation)),
    outcome: 'passed',
    ...(evidence.stdout !== undefined && { stdout: evidence.stdout }),
    ...(evidence.stderr !== undefined && { stderr: evidence.stderr }),
    ...(evidence.sourceReviewId !== undefined && { sourceReviewId: evidence.sourceReviewId }),
  });
}

function updatePlanWithReceipt(
  context: DeliveryContext,
  itemId: string,
  proofId: string,
  receiptIdentifier: string,
  revision: string,
): CliResult | undefined {
  const updated = updateDeliveryChecklistFile({
    path: context.planPath,
    expectedContent: context.plan,
    itemId,
    proofId,
    receiptId: receiptIdentifier,
    revision,
    evidenceClass: 'current_revision_real_boundary',
  });
  if (updated.ok) return undefined;
  return proofFailure(
    updated.code === 'execution_plan_changed' ? 'checklist_write_conflict' : updated.code,
    `${updated.message} Receipt ${receiptIdentifier} remains available.`,
    context.ticketId,
    itemId,
    proofId,
  );
}

export async function recordDeliveryProof(
  cwd: string,
  ticketId: string,
  itemId: string,
  proofId: string,
): Promise<CliResult> {
  const command = 'ticket record-delivery-proof';
  const loaded = loadDeliveryContext(cwd, ticketId, command);
  if (!loaded.ok) return loaded.result;
  const context = loaded.context;
  const selected = specificationFor(context, itemId, proofId);
  if ('schemaVersion' in selected) return selected;
  const subject = captureDeliveryProofSubject({
    projectRoot: cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
  });
  if (!subject.ok) return proofFailure(subject.code, subject.message, ticketId, itemId, proofId);
  const evidence = await runRetainedProof(context, selected.proof, itemId);
  if ('schemaVersion' in evidence) return evidence;

  const after = captureDeliveryProofSubject({
    projectRoot: cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
  });
  if (!after.ok || after.revision !== subject.revision) {
    return proofFailure(
      'proof_subject_dirty',
      'The contribution changed while proof was running.',
      ticketId,
      itemId,
      proofId,
    );
  }
  const appended = appendProofReceipt(context, itemId, selected.proof, subject.revision, evidence);
  if (appended.status === 'pending' || appended.receiptId === undefined) {
    return ledgerWriteFailure();
  }
  const updateFailureResult = updatePlanWithReceipt(
    context,
    itemId,
    proofId,
    appended.receiptId,
    subject.revision,
  );
  if (updateFailureResult !== undefined) return updateFailureResult;
  return successfulProofResult(context, itemId, proofId, appended.receiptId, subject.revision);
}

function compatibilityConfirmationResult(input: {
  readonly ticketId: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly receipt: string;
  readonly reason: string;
}): CliResult {
  const command = [
    'safeword ticket record-delivery-proof',
    shellQuote(input.ticketId),
    shellQuote(input.itemId),
    shellQuote(input.proofId),
    '--receipt',
    shellQuote(input.receipt),
    '--compatible-reason',
    shellQuote(input.reason),
    '--confirm-egress',
  ].join(' ');
  const message =
    'The complete contribution diff will leave this machine for the configured external reviewer. Confirm egress to continue.';
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'compatibility_review_confirmation_required',
        message,
        severity: 'warning',
      },
    ],
    recovery: [{ command, description: message, requiresHuman: true }],
    nextActions: [{ command, mutates: true, requiresHuman: true }],
    data: { command: 'ticket record-delivery-proof' },
  });
}

export function reuseEarlierDeliveryProof(input: {
  readonly cwd: string;
  readonly ticketId: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly receipt: string;
  readonly reason: string;
  readonly confirmEgress: boolean;
}): CliResult {
  const { confirmEgress, cwd, itemId, proofId, reason, receipt, ticketId } = input;
  const command = 'ticket record-delivery-proof';
  const loaded = loadDeliveryContext(cwd, ticketId, command);
  if (!loaded.ok) return loaded.result;
  const context = loaded.context;
  const selected = specificationFor(context, itemId, proofId);
  if ('schemaVersion' in selected) return selected;
  if (selected.proof.currency !== 'compatible_earlier_allowed') {
    return proofFailure(
      'proof_requires_current_revision',
      `Proof ${proofId} must run at the current revision.`,
      ticketId,
      itemId,
      proofId,
    );
  }
  const retained = receiptMatchesItem(context, selected.item, receipt);
  if (retained === undefined) {
    return proofFailure(
      'proof_receipt_mismatch',
      `Receipt ${receipt} does not prove item ${itemId} with proof ${proofId}.`,
      ticketId,
      itemId,
      proofId,
    );
  }
  const currency = currentDeliveryProofSubject({
    projectRoot: cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
    producingRevision: retained.producingRevision,
  });
  if (!currency.ok) {
    return proofFailure(currency.code, currency.message, ticketId, itemId, proofId);
  }
  if (currency.current) {
    return proofFailure(
      'proof_receipt_current',
      `Receipt ${receipt} already proves the current contribution revision.`,
      ticketId,
      itemId,
      proofId,
    );
  }
  if (!confirmEgress) {
    return compatibilityConfirmationResult({ ticketId, itemId, proofId, receipt, reason });
  }
  return proofFailure(
    'compatibility_review_stale',
    'Earlier-revision proof requires a current independent compatibility review.',
    ticketId,
    itemId,
    proofId,
  );
}
