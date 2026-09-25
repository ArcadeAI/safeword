import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { shellQuote } from '../cli-protocol/replay-command.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { admittedExecutionPlanReview } from '../execution-plan/delivery-admission.js';
import {
  createExecutionPlanDeliveryDefinition,
  type DeliveryChecklistItem,
  type DeliveryProofSpecification,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
  updateDeliveryChecklistFile,
} from '../execution-plan/delivery-checklist.js';
import { createDeliveryCompatibilityRequest } from '../execution-plan/delivery-compatibility.js';
import {
  captureDeliveryProofSubject,
  currentDeliveryProofSubject,
  executeDeliveryCommandProof,
} from '../execution-plan/delivery-proof.js';
import {
  appendDeliveryCompatibility,
  appendDeliveryProof,
  currentDesignDecision,
  readDeliveryCompatibilities,
  readDeliveryProof,
} from '../review/approval-ledger.js';
import type { ExecutionPlanDeliveryDefinition, ExecutionPlanRecord } from '../review/contract.js';
import { startReviewJob } from '../review/job.js';
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
  readonly executionPlanRecord: ExecutionPlanRecord;
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

function loadExecutionPlan(
  cwd: string,
  planPath: string,
  command: string,
):
  | {
      readonly ok: true;
      readonly plan: string;
      readonly parsed: Extract<ReturnType<typeof parseDeliveryPlanContract>, { readonly ok: true }>;
    }
  | { readonly ok: false; readonly result: CliResult } {
  const relativePlanPath = nodePath.relative(cwd, planPath);
  let plan: string;
  try {
    plan = readFileSync(planPath, 'utf8');
  } catch {
    return {
      ok: false,
      result: findingResult(
        command,
        'execution_plan_unreadable',
        `Could not read ${relativePlanPath}. Repair the named Execution Plan before updating its Delivery Checklist.`,
        `Repair ${relativePlanPath} and rerun plan-execution review.`,
      ),
    };
  }
  const parsed = parseDeliveryPlanContract(plan);
  if (parsed.ok) return { ok: true, plan, parsed };
  return {
    ok: false,
    result: findingResult(
      command,
      parsed.code,
      parsed.message,
      `Repair ${relativePlanPath} and rerun plan-execution review.`,
    ),
  };
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
  const loadedPlan = loadExecutionPlan(cwd, planPath, command);
  if (!loadedPlan.ok) return loadedPlan;
  const { plan, parsed } = loadedPlan;
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
  const admittedReview = admittedExecutionPlanReview({
    cwd,
    ticketDirectory,
    planPath,
    ledger,
    definition,
    digest,
  });
  if (admittedReview === undefined) {
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
      admittedReviewId: admittedReview.reviewId,
      executionPlanRecord: admittedReview.record,
    },
  };
}

/** Whether the ticket's current Execution Plan has a valid admitted checklist. */
export function hasAdmittedDeliveryChecklist(cwd: string, ticketId: string): boolean {
  return loadDeliveryContext(cwd, ticketId, 'ticket execution-prerequisite').ok;
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
    event.definitionDigest === context.definitionDigest
    ? event
    : undefined;
}

interface ContributorEvidence {
  readonly item_id: string;
  readonly status: DeliveryChecklistItem['disposition'];
  readonly evidence_class:
    | 'current_revision_real_boundary'
    | 'reusable_earlier_revision'
    | 'partial_or_structural'
    | 'missing';
  readonly limitations: readonly ('partial_or_structural' | 'earlier_revision' | 'missing')[];
  readonly audit_receipt_id?: string;
  readonly satisfied: boolean;
}

interface HumanDependency {
  readonly item_id: string;
  readonly obligation: string;
  readonly dependency: string;
  readonly status: 'pending' | 'satisfied';
}

function earlierRequiredEvidence(
  context: DeliveryContext,
  item: DeliveryChecklistItem,
  event: NonNullable<ReturnType<typeof readDeliveryProof>>,
): ContributorEvidence {
  const marker = '; compatible:';
  const reasonAt = item.evidence.indexOf(marker);
  const reusableCandidate =
    item.evidenceClass === 'reusable_earlier_revision' &&
    item.revision === event.producingRevision &&
    reasonAt !== -1;
  const reasonDigest = reusableCandidate
    ? sha256(item.evidence.slice(reasonAt + marker.length))
    : undefined;
  const compatible =
    reasonDigest !== undefined &&
    readDeliveryCompatibilities(context.ledgerPath, {
      ticket: context.ticketId,
      itemId: item.id,
      proofId: item.requiredProof,
      definitionDigest: context.definitionDigest,
      deliveryReceiptId: event.id,
      reasonDigest,
      producingRevision: event.producingRevision,
    }).some(compatibility => {
      const accepted = currentDeliveryProofSubject({
        projectRoot: context.cwd,
        executionPlanPath: context.planPath,
        reviewLedgerPath: context.ledgerPath,
        producingRevision: compatibility.reviewedRevision,
      });
      return accepted.ok && accepted.current;
    });
  return {
    item_id: item.id,
    status: compatible && item.disposition === 'complete' ? 'complete' : 'open',
    evidence_class: compatible ? 'reusable_earlier_revision' : 'partial_or_structural',
    limitations: ['earlier_revision'],
    ...(!compatible && { audit_receipt_id: event.id }),
    satisfied: compatible && item.disposition === 'complete',
  };
}

function contributorEvidence(
  context: DeliveryContext,
  item: DeliveryChecklistItem,
): ContributorEvidence {
  if (item.disposition === 'not_applicable') {
    return {
      item_id: item.id,
      status: item.disposition,
      evidence_class: 'missing',
      limitations: [],
      satisfied: true,
    };
  }
  const event = receiptMatchesItem(context, item, receiptId(item));
  if (event === undefined) {
    return {
      item_id: item.id,
      status: 'open',
      evidence_class: 'missing',
      limitations: ['missing'],
      satisfied: false,
    };
  }
  const currency = currentDeliveryProofSubject({
    projectRoot: context.cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
    producingRevision: event.producingRevision,
  });
  const current = currency.ok && currency.current;
  const requiredRealBoundary =
    event.proofId === item.requiredProof && event.qualification === 'real_boundary';
  if (!requiredRealBoundary) {
    return {
      item_id: item.id,
      status: 'open',
      evidence_class: 'partial_or_structural',
      limitations: current
        ? ['partial_or_structural']
        : ['partial_or_structural', 'earlier_revision'],
      ...(!current && { audit_receipt_id: event.id }),
      satisfied: false,
    };
  }
  if (current) {
    return {
      item_id: item.id,
      status: item.disposition,
      evidence_class: 'current_revision_real_boundary',
      limitations: [],
      satisfied: item.disposition === 'complete',
    };
  }
  return earlierRequiredEvidence(context, item, event);
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
  readonly contributorEvidence: readonly ContributorEvidence[];
  readonly humanDependencies: readonly HumanDependency[];
} {
  const contributorItems = context.items.filter(item => item.owner === 'contributor');
  const contributorEvidenceItems = contributorItems.map(item => contributorEvidence(context, item));
  const openIds = new Set(
    contributorEvidenceItems
      .filter(evidence => !evidence.satisfied)
      .map(evidence => evidence.item_id),
  );
  const openContributorItems = contributorItems.filter(item => openIds.has(item.id));
  const humanItems = context.items.filter(
    item => item.owner === 'human' && item.disposition === 'pending_human',
  );
  const humanDependencies = humanItems.map(item => ({
    item_id: item.id,
    obligation: item.obligation,
    dependency: item.evidence,
    status: designApprovalSatisfied(context, item) ? ('satisfied' as const) : ('pending' as const),
  }));
  const pendingIds = new Set(
    humanDependencies
      .filter(dependency => dependency.status === 'pending')
      .map(dependency => dependency.item_id),
  );
  const pendingHumanItems = humanItems.filter(item => pendingIds.has(item.id));
  if (openContributorItems.length > 0) {
    return {
      state: 'contributor_work_incomplete',
      openContributorItems,
      pendingHumanItems,
      contributorEvidence: contributorEvidenceItems,
      humanDependencies,
    };
  }
  if (pendingHumanItems.length > 0) {
    return {
      state: 'ready_for_human_review',
      openContributorItems,
      pendingHumanItems,
      contributorEvidence: contributorEvidenceItems,
      humanDependencies,
    };
  }
  return {
    state:
      humanItems.length > 0
        ? 'human_approval_satisfied_merge_pending'
        : 'contributor_work_complete',
    openContributorItems,
    pendingHumanItems,
    contributorEvidence: contributorEvidenceItems,
    humanDependencies,
  };
}

function evidenceGapSummary(
  context: DeliveryContext,
  evidence: readonly ContributorEvidence[],
): string {
  const gaps = evidence.flatMap(item => {
    const checklistItem = context.items.find(candidate => candidate.id === item.item_id);
    const requiredBoundary = context.specifications.find(
      candidate => candidate.id === checklistItem?.requiredProof,
    )?.boundary;
    const labels = item.limitations
      .filter(limitation => limitation !== 'missing')
      .map(limitation =>
        limitation === 'partial_or_structural'
          ? `partial or structural proof (missing real boundary: ${requiredBoundary})`
          : 'earlier revision',
      );
    return labels.length === 0 ? [] : [`${item.item_id}: ${labels.join(', ')}`];
  });
  return gaps.length === 0 ? '' : ` Evidence gaps: ${gaps.join('; ')}.`;
}

export function observeDeliveryChecklist(cwd: string, ticketId: string): CliResult {
  const command = 'ticket delivery-checklist';
  const loaded = loadDeliveryContext(cwd, ticketId, command);
  if (!loaded.ok) return loaded.result;
  const projected = readiness(loaded.context);
  const next = projected.openContributorItems[0] ?? projected.pendingHumanItems[0];
  const gaps = evidenceGapSummary(loaded.context, projected.contributorEvidence);
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: projected.state,
        message:
          next === undefined
            ? 'The Delivery Checklist is complete; merge authorization remains pending.'
            : `Next obligation: ${next.obligation}${gaps}`,
        severity: 'warning',
      },
    ],
    data: {
      command,
      readiness_state: projected.state,
      open_contributor_items: projected.openContributorItems.map(item => item.id),
      pending_human_items: projected.pendingHumanItems.map(item => item.id),
      contributor_evidence: projected.contributorEvidence,
      human_dependencies: projected.humanDependencies,
      merge_authorization: 'pending',
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
  if (item.owner !== 'contributor') {
    const humanCommand = item.evidence.startsWith(`design-approval:${context.ticketId}:`)
      ? `safeword ticket approve-plan ${context.ticketId}`
      : `safeword ticket delivery-checklist ${context.ticketId}`;
    const message = `Delivery Checklist item ${itemId} is human-owned and remains pending.`;
    return createResult({
      state: 'action_required',
      findings: [{ code: 'human_owned_item', message, severity: 'warning' }],
      recovery: [{ command: humanCommand, description: message, requiresHuman: true }],
      nextActions: [{ command: humanCommand, mutates: true, requiresHuman: true }],
      data: { command: 'ticket record-delivery-proof' },
    });
  }
  const proof = context.specifications.find(candidate => candidate.id === proofId);
  if (proof === undefined) {
    return findingResult(
      'ticket record-delivery-proof',
      'unknown_proof',
      `Delivery proof ${proofId} was not found.`,
      `safeword ticket record-delivery-proof ${context.ticketId} ${itemId} ${item.requiredProof}`,
    );
  }
  const supportingProof =
    item.disposition === 'open' && proof.qualifiesAs === 'partial_or_structural';
  if (item.requiredProof !== proofId && !supportingProof) {
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
  const recordedItem = refreshed.ok
    ? refreshed.items.find(item => item.id === itemId)
    : context.items.find(item => item.id === itemId);
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
      evidence_class:
        recordedItem?.evidenceClass ?? recordedEvidenceClass(context, itemId, proofId),
      ...(recordedItem?.category === 'dependency and pull-request decomposition' && {
        pull_request_slicing: {
          decision: context.executionPlanRecord.slicing_decision,
          rationale: context.executionPlanRecord.rationale,
          slices: context.executionPlanRecord.slices.map(slice => ({
            name: slice.name,
            prerequisites: slice.prerequisites,
          })),
        },
      }),
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
    evidenceClass: recordedEvidenceClass(context, itemId, proofId),
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

function recordedEvidenceClass(
  context: DeliveryContext,
  itemId: string,
  proofId: string,
): 'current_revision_real_boundary' | 'partial_or_structural' {
  const item = context.items.find(candidate => candidate.id === itemId);
  const proof = context.specifications.find(candidate => candidate.id === proofId);
  return item?.requiredProof === proofId && proof?.qualifiesAs === 'real_boundary'
    ? 'current_revision_real_boundary'
    : 'partial_or_structural';
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

function compatibilityRetryCommand(input: {
  readonly ticketId: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly receipt: string;
  readonly reason: string;
}): string {
  return [
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
}

function compatibilityPendingResult(input: {
  readonly retry: string;
  readonly reviewId?: string;
}): CliResult {
  const message = 'The independent compatibility review is still running; retry this command.';
  return createResult({
    state: 'action_required',
    findings: [{ code: 'compatibility_review_pending', message, severity: 'warning' }],
    effects: {
      network: [{ kind: 'review', target: 'configured external reviewer' }],
    },
    nextActions: [{ command: input.retry, mutates: true, requiresHuman: false }],
    data: {
      command: 'ticket record-delivery-proof',
      ...(input.reviewId !== undefined && { review_id: input.reviewId }),
    },
  });
}

type CompatibilityReviewFailureCode =
  | 'compatibility_review_authentication_required'
  | 'compatibility_review_denied'
  | 'compatibility_review_disabled'
  | 'compatibility_review_stale'
  | 'compatibility_review_unavailable';

function compatibilityReviewFailure(input: {
  readonly code: CompatibilityReviewFailureCode;
  readonly message: string;
  readonly command: string;
  readonly requiresHuman?: boolean;
}): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code: input.code, message: input.message, severity: 'warning' }],
    effects: { network: [{ kind: 'review', target: 'configured external reviewer' }] },
    nextActions: [
      {
        command: input.command,
        mutates: !input.requiresHuman,
        requiresHuman: input.requiresHuman ?? false,
      },
    ],
    data: { command: 'ticket record-delivery-proof' },
  });
}

function reviewFindingCodes(result: CliResult): Set<string> {
  return new Set(result.findings.map(finding => finding.code));
}

function currentProofCommand(ticketId: string, itemId: string, proofId: string): string {
  return ['safeword ticket record-delivery-proof', ticketId, itemId, proofId]
    .map((part, index) => (index === 0 ? part : shellQuote(part)))
    .join(' ');
}

function mappedCompatibilityReviewFailure(input: {
  readonly review: CliResult;
  readonly retry: string;
  readonly rerun: string;
}): CliResult {
  const data = input.review.data as Record<string, unknown> | undefined;
  const findings = reviewFindingCodes(input.review);
  if (data?.status === 'changes_requested') {
    return compatibilityReviewFailure({
      code: 'compatibility_review_denied',
      message:
        'The independent reviewer found that the earlier proof no longer establishes this boundary.',
      command: input.rerun,
    });
  }
  if (findings.has('REVIEW_AUTHENTICATION_REQUIRED')) {
    const authentication = input.review.recovery[0];
    return compatibilityReviewFailure({
      code: 'compatibility_review_authentication_required',
      message: 'The independent compatibility reviewer needs authentication.',
      command: authentication?.command ?? input.retry,
      requiresHuman: true,
    });
  }
  if (findings.has('REVIEW_NOT_REQUESTED')) {
    return compatibilityReviewFailure({
      code: 'compatibility_review_disabled',
      message: 'Independent compatibility review is disabled; rerun the retained proof instead.',
      command: input.rerun,
    });
  }
  if (findings.has('REVIEW_ROUTES_EXHAUSTED') || findings.has('REVIEW_INDEPENDENCE_REQUIRED')) {
    return compatibilityReviewFailure({
      code: 'compatibility_review_unavailable',
      message:
        'No independent compatibility reviewer is available; rerun the retained proof instead.',
      command: input.rerun,
    });
  }
  return compatibilityReviewFailure({
    code: 'compatibility_review_stale',
    message: 'The compatibility review did not match the exact current request.',
    command: input.retry,
  });
}

function approvedCompatibilityReview(
  result: CliResult,
  cwd: string,
  requestPath: string,
): string | undefined {
  if (typeof result.data !== 'object' || result.data === null) return undefined;
  const data = result.data as Record<string, unknown>;
  const output = data.reviewer_output as Record<string, unknown> | undefined;
  const targets = data.review_targets;
  const author = data.author_agent;
  const reviewer = data.actual_reviewer;
  const reviewId = typeof data.review_id === 'string' ? data.review_id : undefined;
  const target = Array.isArray(targets) && targets.length === 1 ? targets[0] : undefined;
  const approved = [
    data.status === 'approved',
    data.review_kind === 'delivery-compatibility',
    data.independence === 'cross-agent',
    typeof author === 'string',
    typeof reviewer === 'string',
    author !== reviewer,
    data.assigned_reviewer === reviewer,
    output?.verdict === 'approve',
    output?.reviewer_agent === reviewer,
    typeof target === 'string' && nodePath.resolve(cwd, target) === requestPath,
    reviewId !== undefined,
  ].every(Boolean);
  return approved ? reviewId : undefined;
}

function acceptedCompatibilityResult(input: {
  readonly context: DeliveryContext;
  readonly selected: {
    readonly item: DeliveryChecklistItem;
    readonly proof: DeliveryProofSpecification;
  };
  readonly retained: NonNullable<ReturnType<typeof readDeliveryProof>>;
  readonly request: Extract<
    Awaited<ReturnType<typeof createDeliveryCompatibilityRequest>>,
    { ok: true }
  >;
  readonly reason: string;
  readonly sourceReviewId: string;
}): CliResult {
  const { context, reason, request, retained, selected, sourceReviewId } = input;
  const appended = appendDeliveryCompatibility(context.ledgerPath, {
    ticket: context.ticketId,
    itemId: selected.item.id,
    proofId: selected.proof.id,
    definitionDigest: context.definitionDigest,
    deliveryReceiptId: retained.id,
    reasonDigest: request.reasonDigest,
    producingRevision: retained.producingRevision,
    reviewedRevision: request.reviewedRevision,
    requestDigest: request.requestDigest,
    sourceReviewId,
  });
  if (appended.status === 'pending') return ledgerWriteFailure();
  const updated = updateDeliveryChecklistFile({
    path: context.planPath,
    expectedContent: context.plan,
    itemId: selected.item.id,
    proofId: selected.proof.id,
    receiptId: retained.id,
    revision: retained.producingRevision,
    evidenceClass: 'reusable_earlier_revision',
    compatibilityReason: reason,
  });
  if (!updated.ok) {
    return proofFailure(
      updated.code === 'execution_plan_changed' ? 'checklist_write_conflict' : updated.code,
      `${updated.message} Compatibility acceptance remains available.`,
      context.ticketId,
      selected.item.id,
      selected.proof.id,
    );
  }
  const result = successfulProofResult(
    context,
    selected.item.id,
    selected.proof.id,
    retained.id,
    retained.producingRevision,
  );
  return {
    ...result,
    effects: {
      ...result.effects,
      network: [{ kind: 'review', target: 'configured external reviewer' }],
    },
  };
}

// eslint-disable-next-line complexity -- Each guarded exit preserves one typed contributor recovery at this trust boundary.
export async function reuseEarlierDeliveryProof(input: {
  readonly cwd: string;
  readonly ticketId: string;
  readonly itemId: string;
  readonly proofId: string;
  readonly receipt: string;
  readonly reason: string;
  readonly confirmEgress: boolean;
}): Promise<CliResult> {
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
  if (reason.trim() === '' || /[\r\n|]/u.test(reason)) {
    return proofFailure(
      'compatible_reason_invalid',
      'The compatibility reason must be one non-empty Markdown-table-safe line.',
      ticketId,
      itemId,
      proofId,
    );
  }
  if (!confirmEgress) {
    return compatibilityConfirmationResult({ ticketId, itemId, proofId, receipt, reason });
  }
  const request = await createDeliveryCompatibilityRequest({
    projectRoot: cwd,
    executionPlanPath: context.planPath,
    reviewLedgerPath: context.ledgerPath,
    ticket: ticketId,
    itemId,
    proofId,
    definition: context.definition,
    definitionDigest: context.definitionDigest,
    deliveryReceiptId: receipt,
    reason,
    producingRevision: retained.producingRevision,
    reviewedRevision: currency.revision,
  });
  if (!request.ok) {
    return proofFailure(request.code, request.message, ticketId, itemId, proofId);
  }
  const retry = compatibilityRetryCommand({ ticketId, itemId, proofId, receipt, reason });
  const rerun = currentProofCommand(ticketId, itemId, proofId);
  const review = await startReviewJob({
    cwd,
    kind: 'delivery-compatibility',
    targets: [request.relativePath],
  });
  const data =
    typeof review.data === 'object' && review.data !== null
      ? (review.data as Record<string, unknown>)
      : undefined;
  if (data?.status === 'pending') {
    return compatibilityPendingResult({
      retry,
      ...(typeof data.review_id === 'string' && { reviewId: data.review_id }),
    });
  }
  const sourceReviewId = approvedCompatibilityReview(review, cwd, request.path);
  if (sourceReviewId !== undefined) {
    return acceptedCompatibilityResult({
      context,
      selected,
      retained,
      request,
      reason,
      sourceReviewId,
    });
  }
  return mappedCompatibilityReviewFailure({ review, retry, rerun });
}
