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
import { phaseReviewAdmission } from '../review/phase-admission.js';
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

function currentReview(
  context: ApprovalContext,
):
  | { readonly ok: true; readonly independence: 'cross-agent' | 'degraded' }
  | { readonly ok: false; readonly reason: string } {
  const gate = evaluateExecutionPlanningEntry(context.ticketDirectory, {
    projectDirectory: context.cwd,
  });
  if (!gate.ok) return { ok: false, reason: latestReviewRejection(context) ?? gate.reason };
  const ledger = existsSync(context.ledgerPath) ? readFileSync(context.ledgerPath, 'utf8') : '';
  const scope = reviewScope(
    nodePath.basename(context.ticketDirectory),
    'impl-plan',
    hashArtifact(context.plan),
  );
  const artifactReview = gatePhaseAdvance(scope, parseReviewStamps(ledger));
  if (!artifactReview.ok) {
    return { ok: false, reason: latestReviewRejection(context) ?? artifactReview.reason };
  }
  const admission = phaseReviewAdmission({
    cwd: context.cwd,
    ticketDirectory: context.ticketDirectory,
    kind: 'plan-implementation',
    target: nodePath.resolve(context.planPath),
    ledger,
    label: 'Implementation Plan',
  });
  if (admission.kind === 'admitted') {
    return { ok: true, independence: admission.provenance.independence };
  }
  if (admission.kind === 'rejected' || admission.kind === 'unearned_assurance') {
    return { ok: false, reason: admission.message };
  }
  return {
    ok: false,
    reason:
      'The current Implementation Plan has no current authenticated Implementation Plan review receipt.',
  };
}

function reviewsPlan(data: Record<string, unknown>, context: ApprovalContext): boolean {
  return (
    Array.isArray(data.review_targets) &&
    data.review_targets.some(
      target =>
        typeof target === 'string' &&
        nodePath.resolve(context.cwd, target) === nodePath.resolve(context.planPath),
    )
  );
}

type ExecutionDiscovery =
  | { readonly destination: 'plan-execution' | 'plan-implementation' }
  | { readonly destination: 'invalid' };

function reviewTargetsPath(
  data: Record<string, unknown>,
  cwd: string,
  expectedPath: string,
): boolean {
  if (!Array.isArray(data.review_targets)) return false;
  const resolvedExpected = nodePath.resolve(expectedPath);
  return data.review_targets.some(
    target => typeof target === 'string' && nodePath.resolve(cwd, target) === resolvedExpected,
  );
}

function discoveryDestination(output: unknown): ExecutionDiscovery {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) {
    return { destination: 'invalid' };
  }
  const destination = (output as Record<string, unknown>).planning_destination;
  return destination === 'plan-execution' || destination === 'plan-implementation'
    ? { destination }
    : { destination: 'invalid' };
}

function currentExecutionDiscovery(context: ApprovalContext): ExecutionDiscovery | undefined {
  const ticket = readFileSync(context.ticketPath, 'utf8');
  if (readFrontmatterScalar(ticket, 'phase') !== 'plan-execution') return undefined;
  const planPath = nodePath.join(context.ticketDirectory, 'execution-plan.md');
  if (!existsSync(planPath)) return undefined;

  const review = reviewJobStatus(context.cwd);
  if (typeof review.data !== 'object' || review.data === null || Array.isArray(review.data)) {
    return undefined;
  }
  const data = review.data as Record<string, unknown>;
  if (
    data.review_kind !== 'plan-execution' ||
    data.status !== 'changes_requested' ||
    !reviewTargetsPath(data, context.cwd, planPath)
  ) {
    return undefined;
  }
  return discoveryDestination(data.reviewer_output);
}

function applyExecutionDiscovery(
  context: ApprovalContext,
  discovery: ExecutionDiscovery,
): CliResult {
  if (discovery.destination === 'plan-implementation') {
    const changed = replaceTicketPhase(context, 'plan-execution', 'plan-implementation');
    const target = nodePath.relative(context.cwd, context.ticketPath);
    return createResult({
      state: 'action_required',
      changed,
      effects: {
        files: changed ? [{ kind: 'update', target, operation: 'write' }] : [],
      },
      findings: [
        {
          code: 'EXECUTION_DISCOVERY_APPLIED',
          message:
            'The reviewed discovery changes an accepted decision or proof boundary. The ticket returned to Implementation Planning for repair and fresh review.',
          severity: 'warning',
        },
      ],
      data: {
        command: 'ticket approve-plan',
        ticket_id: context.ticketId,
        planning_destination: discovery.destination,
      },
    });
  }

  const invalid = discovery.destination === 'invalid';
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: invalid ? 'EXECUTION_DISCOVERY_INVALID' : 'EXECUTION_DISCOVERY_APPLIED',
        message: invalid
          ? 'The current Execution Plan review did not provide a valid planning destination. Run the review again before changing phase.'
          : 'The reviewed discovery changes only execution mechanics. Repair and re-review the Execution Plan; the ticket remains in Execution Planning.',
        severity: 'warning',
      },
    ],
    data: {
      command: 'ticket approve-plan',
      ticket_id: context.ticketId,
      planning_destination: discovery.destination,
    },
  });
}

function latestReviewRejection(context: ApprovalContext): string | undefined {
  const review = reviewJobStatus(context.cwd);
  if (typeof review.data !== 'object' || review.data === null || Array.isArray(review.data)) {
    return undefined;
  }
  const data = review.data as Record<string, unknown>;
  if (data.review_kind !== 'plan-implementation' || !reviewsPlan(data, context)) {
    return undefined;
  }
  const messages = review.findings.map(finding => finding.message).filter(Boolean);
  return messages.length > 0
    ? `Implementation Plan review is blocked: ${messages.join(' ')}`
    : 'The Implementation Plan review requested changes.';
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

function scaffoldExecutionPlan(context: ApprovalContext): string | undefined {
  const planPath = nodePath.join(context.ticketDirectory, 'execution-plan.md');
  if (existsSync(planPath)) return undefined;

  const templatePath = nodePath.join(
    context.cwd,
    '.safeword',
    'templates',
    'execution-plan-template.md',
  );
  if (!existsSync(templatePath)) {
    throw new Error(
      'The installed Execution Plan template is missing. Repair the Safeword installation before approving the plan.',
    );
  }
  writeFileSync(planPath, readFileSync(templatePath, 'utf8'), { flag: 'wx' });
  return nodePath.relative(context.cwd, planPath);
}

function advanceToExecutionPlanning(context: ApprovalContext): string[] {
  const planTarget = scaffoldExecutionPlan(context);
  const ticketChanged = replaceTicketPhase(context, 'plan-implementation', 'plan-execution');
  return [
    ...(planTarget === undefined ? [] : [planTarget]),
    ...(ticketChanged ? [nodePath.relative(context.cwd, context.ticketPath)] : []),
  ];
}

function reconcilePhaseWithCurrentDecision(
  context: ApprovalContext,
):
  | { readonly decision: 'approved' | 'declined'; readonly changedFiles: readonly string[] }
  | undefined {
  const changedFiles = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decision = currentDesignDecision(context.ledgerPath, context.ticketId, context.digest);
    if (decision === undefined) return undefined;
    if (decision === 'approved') {
      for (const target of advanceToExecutionPlanning(context)) changedFiles.add(target);
    } else if (replaceTicketPhase(context, 'plan-execution', 'plan-implementation')) {
      changedFiles.add(nodePath.relative(context.cwd, context.ticketPath));
    }
    if (currentDesignDecision(context.ledgerPath, context.ticketId, context.digest) === decision) {
      return { decision, changedFiles: [...changedFiles] };
    }
  }
  return undefined;
}

function result(
  context: ApprovalContext,
  status: ApprovalStatus,
  changedFiles: readonly string[],
  finding?: string,
  options: {
    readonly severity?: 'info' | 'warning';
    readonly achievedIndependence?: 'cross-agent' | 'degraded';
  } = {},
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
        : [
            {
              code: 'PLAN_APPROVAL_STATUS',
              message: finding,
              severity: options.severity ?? 'warning',
            },
          ],
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
      ...(options.achievedIndependence !== undefined && {
        achieved_independence: options.achievedIndependence,
      }),
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
  ledgerTarget: string,
  appended: 'existing' | 'written',
  changedFiles: readonly string[],
): string[] {
  return [...new Set([...(appended === 'written' ? [ledgerTarget] : []), ...changedFiles])];
}

function settleInteractiveDecision(
  context: ApprovalContext,
  accepted: boolean,
  ledgerTarget: string,
  achievedIndependence: 'cross-agent' | 'degraded',
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
      { achievedIndependence },
    );
  }
  interruptApprovalForTest('after-decision');
  const reconciled = reconcilePhaseWithCurrentDecision(context);
  if (reconciled === undefined) {
    return result(
      context,
      'pending',
      settledDecisionChanges(
        ledgerTarget,
        appended.status,
        returnedToPlanning ? [nodePath.relative(context.cwd, context.ticketPath)] : [],
      ),
      'The current human design decision changed while the ticket phase was being reconciled; approval remains pending.',
      { achievedIndependence },
    );
  }
  const status = reconciled.decision;
  const planPath = nodePath.relative(context.cwd, context.planPath);
  return result(
    context,
    status,
    settledDecisionChanges(ledgerTarget, appended.status, [
      ...reconciled.changedFiles,
      ...(returnedToPlanning ? [nodePath.relative(context.cwd, context.ticketPath)] : []),
    ]),
    status === 'approved'
      ? `Approved approach: ${planPath} at ${context.digest}.`
      : `Declined approach: ${planPath}. It remains in Implementation Planning for repair.`,
    { severity: status === 'approved' ? 'info' : 'warning', achievedIndependence },
  );
}

function currentApprovalResult(
  context: ApprovalContext,
  achievedIndependence: 'cross-agent' | 'degraded',
): CliResult | undefined {
  if (currentDesignDecision(context.ledgerPath, context.ticketId, context.digest) !== 'approved') {
    return undefined;
  }
  const reconciled = reconcilePhaseWithCurrentDecision(context);
  if (reconciled?.decision !== 'approved') {
    return result(
      context,
      'pending',
      reconciled?.changedFiles ?? [],
      'The current human design decision changed while the ticket phase was being reconciled; approval remains pending.',
      { achievedIndependence },
    );
  }
  return result(
    context,
    'approved',
    reconciled.changedFiles,
    `Existing approval remains current for ${nodePath.relative(context.cwd, context.planPath)} at ${context.digest}.`,
    { severity: 'info', achievedIndependence },
  );
}

async function approve(context: ApprovalContext, noInput: boolean): Promise<CliResult> {
  const executionDiscovery = currentExecutionDiscovery(context);
  if (executionDiscovery !== undefined) {
    return applyExecutionDiscovery(context, executionDiscovery);
  }
  const review = currentReview(context);
  if (!review.ok) {
    return result(context, 'pending', [], review.reason);
  }

  const ledgerTarget = nodePath.relative(context.cwd, context.ledgerPath);
  const ticketTarget = nodePath.relative(context.cwd, context.ticketPath);
  if (!designApprovalEnabled(context.cwd)) {
    appendReceipt(context, 'not-required');
    const advanced = advanceToExecutionPlanning(context);
    return result(context, 'not-required', [ledgerTarget, ...advanced], undefined, {
      achievedIndependence: review.independence,
    });
  }

  const existingApproval = currentApprovalResult(context, review.independence);
  if (existingApproval !== undefined) return existingApproval;

  const returnedToPlanning = replaceTicketPhase(context, 'plan-execution', 'plan-implementation');

  if (noInput || !process.stdin.isTTY || !process.stdout.isTTY) {
    appendReceipt(context, 'pending');
    return result(
      context,
      'pending',
      [ledgerTarget, ...(returnedToPlanning ? [ticketTarget] : [])],
      'Human design approval is pending; the ticket remains in Implementation Planning.',
      { achievedIndependence: review.independence },
    );
  }

  const accepted = await askForApproval(context.plan);
  return settleInteractiveDecision(
    context,
    accepted,
    ledgerTarget,
    review.independence,
    returnedToPlanning,
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
