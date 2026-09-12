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
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

type ApprovalStatus = 'approved' | 'declined' | 'not-required' | 'pending';

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
  return gatePhaseAdvance(scope, parseReviewStamps(ledger));
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

function appendDecision(context: ApprovalContext, decision: 'approved' | 'declined'): void {
  appendFileSync(
    context.ledgerPath,
    `${new Date().toISOString()} cli design-decision:${JSON.stringify({
      kind: 'design-decision',
      ticket: context.ticketId,
      phase: 'plan-implementation',
      planDigest: context.digest,
      decision,
      authorityRef: 'interactive-cli',
    })}\n`,
  );
}

function advanceToExecutionPlanning(context: ApprovalContext): void {
  const phase = readFrontmatterScalar(context.ticket, 'phase');
  if (phase !== 'plan-implementation') {
    throw new Error(`Ticket is in ${String(phase)}, not plan-implementation.`);
  }
  const updated = context.ticket.replace(
    /^phase:\s*plan-implementation\s*$/mu,
    'phase: plan-execution',
  );
  const temporary = `${context.ticketPath}.tmp`;
  writeFileSync(temporary, updated);
  renameSync(temporary, context.ticketPath);
}

function result(
  context: ApprovalContext,
  status: ApprovalStatus,
  changedFiles: readonly string[],
  finding?: string,
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
        : [{ code: 'PLAN_APPROVAL_STATUS', message: finding, severity: 'warning' }],
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

async function approve(context: ApprovalContext, noInput: boolean): Promise<CliResult> {
  const review = currentReview(context);
  if (!review.ok) {
    return result(context, 'pending', [], review.reason);
  }

  const ledgerTarget = nodePath.relative(context.cwd, context.ledgerPath);
  if (!designApprovalEnabled(context.cwd)) {
    appendReceipt(context, 'not-required');
    advanceToExecutionPlanning(context);
    return result(context, 'not-required', [
      ledgerTarget,
      nodePath.relative(context.cwd, context.ticketPath),
    ]);
  }

  if (noInput || !process.stdin.isTTY || !process.stdout.isTTY) {
    appendReceipt(context, 'pending');
    return result(
      context,
      'pending',
      [ledgerTarget],
      'Human design approval is pending; the ticket remains in Implementation Planning.',
    );
  }

  const accepted = await askForApproval(context.plan);
  const status = accepted ? 'approved' : 'declined';
  appendDecision(context, status);
  appendReceipt(context, status);
  if (accepted) advanceToExecutionPlanning(context);
  return result(
    context,
    status,
    [ledgerTarget, ...(accepted ? [nodePath.relative(context.cwd, context.ticketPath)] : [])],
    accepted
      ? undefined
      : 'The reviewed approach was declined and remains in Implementation Planning for repair.',
  );
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
