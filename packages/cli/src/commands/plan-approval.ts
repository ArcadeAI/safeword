import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import { evaluateExecutionPlanningEntry } from '../../templates/hooks/lib/plan-gate.js';
import {
  gatePhaseAdvance,
  hashArtifact,
  parseReviewStamps,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { appendDesignDecision, currentDesignDecision } from '../review/approval-ledger.js';
import { reviewJobStatus } from '../review/job.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

type ApprovalStatus = 'approved' | 'declined' | 'not-required' | 'pending';

function interruptApprovalForTest(boundary: 'after-decision' | 'before-decision'): void {
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.SAFEWORD_APPROVAL_TEST_INTERRUPT === boundary
  ) {
    process.exit(86);
  }
}

interface ApprovalContext {
  readonly cwd: string;
  readonly ticketId: string;
  readonly ticketDirectory: string;
  readonly ticketPath: string;
  readonly planPath: string;
  readonly plan: string;
  readonly ledgerPath: string;
  readonly digest: string;
}

function planDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readContext(cwd: string, ticketId: string): ApprovalContext {
  const ticketDirectory = resolveTicketDirectory(cwd, ticketId);
  if (ticketDirectory === undefined) throw new Error(`Ticket "${ticketId}" does not resolve.`);
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const planPath = nodePath.join(ticketDirectory, 'impl-plan.md');
  if (!existsSync(ticketPath) || !existsSync(planPath)) {
    throw new Error(`Ticket "${ticketId}" needs ticket.md and impl-plan.md.`);
  }
  const plan = readFileSync(planPath, 'utf8');
  return {
    cwd,
    ticketId,
    ticketDirectory,
    ticketPath,
    planPath,
    plan,
    ledgerPath: nodePath.join(resolveNamespaceRoot(cwd), 'skill-invocations.log'),
    digest: planDigest(plan),
  };
}

function designApprovalEnabled(cwd: string): boolean {
  const path = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(path)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('configuration root must be an object');
    }
    const config = parsed as { designApprovalGate?: unknown };
    return config.designApprovalGate === true;
  } catch {
    throw new Error(
      'Could not determine whether human design approval is required because .safeword/config.json is unreadable or invalid. Repair the configuration before approving the plan.',
    );
  }
}

function currentReview(context: ApprovalContext): { ok: true } | { ok: false; reason: string } {
  const gate = evaluateExecutionPlanningEntry(context.ticketDirectory, {
    projectDirectory: context.cwd,
  });
  if (!gate.ok) return gate;
  const scope = reviewScope(
    nodePath.basename(context.ticketDirectory),
    'impl-plan',
    hashArtifact(context.plan),
  );
  const ledger = existsSync(context.ledgerPath) ? readFileSync(context.ledgerPath, 'utf8') : '';
  const review = gatePhaseAdvance(scope, parseReviewStamps(ledger));
  if (review.ok) return review;
  return { ok: false, reason: currentReviewFinding(context) ?? review.reason };
}

function currentReviewFinding(context: ApprovalContext): string | undefined {
  const review = reviewJobStatus(context.cwd);
  const data =
    typeof review.data === 'object' && review.data !== null && !Array.isArray(review.data)
      ? (review.data as Record<string, unknown>)
      : undefined;
  if (data?.review_kind !== 'plan-implementation' || !Array.isArray(data.review_targets)) {
    return undefined;
  }
  const reviewsCurrentPlan = data.review_targets.some(
    target =>
      typeof target === 'string' &&
      nodePath.resolve(context.cwd, target) === nodePath.resolve(context.planPath),
  );
  if (!reviewsCurrentPlan) return undefined;
  const findings = review.findings.map(finding => finding.message).filter(Boolean);
  return findings.length > 0
    ? `Implementation Plan review is blocked: ${findings.join(' ')}`
    : undefined;
}

function appendReceipt(context: ApprovalContext, status: ApprovalStatus): void {
  mkdirSync(nodePath.dirname(context.ledgerPath), { recursive: true });
  appendFileSync(
    context.ledgerPath,
    `${new Date().toISOString()} cli human-approval:${status} ${JSON.stringify({
      ticket: context.ticketId,
      phase: 'plan-implementation',
      planDigest: context.digest,
    })}\n`,
  );
}

function replaceTicketPhase(
  context: ApprovalContext,
  from: 'plan-execution' | 'plan-implementation',
  to: 'plan-execution' | 'plan-implementation',
): boolean {
  const ticket = readFileSync(context.ticketPath, 'utf8');
  const phase = readFrontmatterScalar(ticket, 'phase');
  if (phase === to) return false;
  if (phase !== from) throw new Error(`Ticket is in ${String(phase)}, not ${from}.`);
  const updated =
    from === 'plan-implementation'
      ? ticket.replace(/^phase:[\t ]*plan-implementation[\t ]*$/mu, 'phase: plan-execution')
      : ticket.replace(/^phase:[\t ]*plan-execution[\t ]*$/mu, 'phase: plan-implementation');
  if (updated === ticket) {
    throw new Error(`Ticket phase "${from}" could not be updated safely.`);
  }
  const temporary = `${context.ticketPath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, updated);
  renameSync(temporary, context.ticketPath);
  return true;
}

function advanceToExecutionPlanning(context: ApprovalContext): boolean {
  return replaceTicketPhase(context, 'plan-implementation', 'plan-execution');
}

function reconcilePhaseWithCurrentDecision(
  context: ApprovalContext,
): { readonly decision: 'approved' | 'declined'; readonly ticketChanged: boolean } | undefined {
  let ticketChanged = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decision = currentDesignDecision(context.ledgerPath, context.ticketId, context.digest);
    if (decision === undefined) return undefined;
    ticketChanged =
      (decision === 'approved'
        ? advanceToExecutionPlanning(context)
        : replaceTicketPhase(context, 'plan-execution', 'plan-implementation')) || ticketChanged;
    if (currentDesignDecision(context.ledgerPath, context.ticketId, context.digest) === decision) {
      return { decision, ticketChanged };
    }
  }
  return undefined;
}

function result(
  context: ApprovalContext,
  status: ApprovalStatus,
  changedFiles: readonly string[],
  finding?: string,
  findingSeverity: 'info' | 'warning' = 'warning',
): CliResult {
  let state: CliResult['state'] = changedFiles.length > 0 ? 'changed' : 'healthy';
  if (status === 'pending') state = 'action_required';
  return createResult({
    state,
    changed: changedFiles.length > 0,
    effects: {
      files: changedFiles.map(target => ({ kind: 'update', target, operation: 'write' })),
    },
    findings:
      finding === undefined
        ? []
        : [{ code: 'PLAN_APPROVAL_STATUS', message: finding, severity: findingSeverity }],
    nextActions:
      status === 'pending'
        ? [
            {
              kind: 'human',
              instruction: `Run safeword ticket approve-plan ${context.ticketId} in an interactive terminal.`,
              mutates: false,
              requiresHuman: true,
            },
          ]
        : [],
    data: {
      command: 'ticket approve-plan',
      ticket_id: context.ticketId,
      approval_status: status,
      plan_digest: context.digest,
    },
  });
}

async function askForApproval(plan: string): Promise<boolean> {
  process.stdout.write(`${plan.replace(/\n?$/u, '\n')}\n`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question('Approve this reviewed Implementation Plan? [y/N] ');
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    prompt.close();
  }
}

function settledDecisionChanges(
  context: ApprovalContext,
  ledgerTarget: string,
  appended: 'existing' | 'written',
  ticketChanged: boolean,
): string[] {
  return [
    ...(appended === 'written' ? [ledgerTarget] : []),
    ...(ticketChanged ? [nodePath.relative(context.cwd, context.ticketPath)] : []),
  ];
}

function settleInteractiveDecision(
  context: ApprovalContext,
  accepted: boolean,
  ledgerTarget: string,
  returnedToPlanning = false,
): CliResult {
  const submittedStatus = accepted ? 'approved' : 'declined';
  interruptApprovalForTest('before-decision');
  const appended = appendDesignDecision(context.ledgerPath, {
    authorityRef: 'interactive-cli',
    decision: submittedStatus,
    planDigest: context.digest,
    ticket: context.ticketId,
  });
  if (appended.status === 'pending') {
    return result(
      context,
      'pending',
      returnedToPlanning ? [nodePath.relative(context.cwd, context.ticketPath)] : [],
      'Human design authority could not be recorded safely; approval remains pending.',
    );
  }
  interruptApprovalForTest('after-decision');
  const reconciled = reconcilePhaseWithCurrentDecision(context);
  if (reconciled === undefined) {
    return result(
      context,
      'pending',
      settledDecisionChanges(context, ledgerTarget, appended.status, returnedToPlanning),
      'The current human design decision changed while the ticket phase was being reconciled; approval remains pending.',
    );
  }
  const status = reconciled.decision;
  const planPath = nodePath.relative(context.cwd, context.planPath);
  return result(
    context,
    status,
    settledDecisionChanges(
      context,
      ledgerTarget,
      appended.status,
      reconciled.ticketChanged || returnedToPlanning,
    ),
    status === 'approved'
      ? `Approved approach: ${planPath} at ${context.digest}.`
      : `Declined approach: ${planPath}. It remains in Implementation Planning for repair.`,
    status === 'approved' ? 'info' : 'warning',
  );
}

function currentApprovalResult(
  context: ApprovalContext,
  ticketTarget: string,
): CliResult | undefined {
  if (currentDesignDecision(context.ledgerPath, context.ticketId, context.digest) !== 'approved') {
    return undefined;
  }
  const reconciled = reconcilePhaseWithCurrentDecision(context);
  if (reconciled?.decision !== 'approved') {
    return result(
      context,
      'pending',
      reconciled?.ticketChanged ? [ticketTarget] : [],
      'The current human design decision changed while the ticket phase was being reconciled; approval remains pending.',
    );
  }
  return result(
    context,
    'approved',
    reconciled.ticketChanged ? [ticketTarget] : [],
    `Existing approval remains current for ${nodePath.relative(context.cwd, context.planPath)} at ${context.digest}.`,
    'info',
  );
}

async function approve(context: ApprovalContext, noInput: boolean): Promise<CliResult> {
  const review = currentReview(context);
  if (!review.ok) {
    return result(context, 'pending', [], review.reason);
  }

  const ledgerTarget = nodePath.relative(context.cwd, context.ledgerPath);
  const ticketTarget = nodePath.relative(context.cwd, context.ticketPath);
  if (!designApprovalEnabled(context.cwd)) {
    appendReceipt(context, 'not-required');
    const advanced = advanceToExecutionPlanning(context);
    return result(context, 'not-required', [ledgerTarget, ...(advanced ? [ticketTarget] : [])]);
  }

  const existingApproval = currentApprovalResult(context, ticketTarget);
  if (existingApproval !== undefined) return existingApproval;

  const returnedToPlanning = replaceTicketPhase(context, 'plan-execution', 'plan-implementation');

  if (noInput || !process.stdin.isTTY || !process.stdout.isTTY) {
    appendReceipt(context, 'pending');
    return result(
      context,
      'pending',
      [ledgerTarget, ...(returnedToPlanning ? [ticketTarget] : [])],
      'Human design approval is pending; the ticket remains in Implementation Planning.',
    );
  }

  const accepted = await askForApproval(context.plan);
  return settleInteractiveDecision(context, accepted, ledgerTarget, returnedToPlanning);
}

export async function approvePlanResult(
  cwd: string,
  ticketId: string,
  options: { readonly noInput: boolean },
): Promise<CliResult> {
  try {
    return await approve(readContext(cwd, ticketId), options.noInput);
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PLAN_APPROVAL_FAILED',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      ],
      data: { command: 'ticket approve-plan', ticket_id: ticketId },
    });
  }
}
