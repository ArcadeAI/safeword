import { createHash } from 'node:crypto';
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
  readonly ticket: string;
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
    ticket: readFileSync(ticketPath, 'utf8'),
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
    const config = JSON.parse(readFileSync(path, 'utf8')) as { designApprovalGate?: unknown };
    return config.designApprovalGate === true;
  } catch {
    return false;
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
  const phase = readFrontmatterScalar(context.ticket, 'phase');
  if (phase === to) return false;
  if (phase !== from) throw new Error(`Ticket is in ${String(phase)}, not ${from}.`);
  const updated =
    from === 'plan-implementation'
      ? context.ticket.replace(/^phase:\s*plan-implementation\s*$/mu, 'phase: plan-execution')
      : context.ticket.replace(/^phase:\s*plan-execution\s*$/mu, 'phase: plan-implementation');
  const temporary = `${context.ticketPath}.tmp`;
  writeFileSync(temporary, updated);
  renameSync(temporary, context.ticketPath);
  return true;
}

function advanceToExecutionPlanning(context: ApprovalContext): void {
  replaceTicketPhase(context, 'plan-implementation', 'plan-execution');
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

function settleInteractiveDecision(
  context: ApprovalContext,
  accepted: boolean,
  ledgerTarget: string,
  returnedToPlanning = false,
): CliResult {
  const status = accepted ? 'approved' : 'declined';
  interruptApprovalForTest('before-decision');
  const appended = appendDesignDecision(context.ledgerPath, {
    authorityRef: 'interactive-cli',
    decision: status,
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
  if (accepted) advanceToExecutionPlanning(context);
  const planPath = nodePath.relative(context.cwd, context.planPath);
  return result(
    context,
    status,
    [
      ledgerTarget,
      ...(accepted || returnedToPlanning
        ? [nodePath.relative(context.cwd, context.ticketPath)]
        : []),
    ],
    accepted
      ? `Approved approach: ${planPath} at ${context.digest}.`
      : `Declined approach: ${planPath}. It remains in Implementation Planning for repair.`,
    accepted ? 'info' : 'warning',
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
    advanceToExecutionPlanning(context);
    return result(context, 'not-required', [
      ledgerTarget,
      nodePath.relative(context.cwd, context.ticketPath),
    ]);
  }

  if (currentDesignDecision(context.ledgerPath, context.ticketId, context.digest) === 'approved') {
    const advanced = replaceTicketPhase(context, 'plan-implementation', 'plan-execution');
    return result(
      context,
      'approved',
      advanced ? [ticketTarget] : [],
      `Existing approval remains current for ${nodePath.relative(context.cwd, context.planPath)} at ${context.digest}.`,
      'info',
    );
  }

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
