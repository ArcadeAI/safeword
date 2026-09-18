import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseReviewStamps } from '../../templates/hooks/lib/review-ledger.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { admittedExecutionPlanReview } from '../execution-plan/delivery-admission.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../execution-plan/delivery-checklist.js';
import { currentDesignDecision } from '../review/approval-ledger.js';
import type { ReviewKind } from '../review/contract.js';
import { reviewIntegrityKeyExists, reviewJobStatus } from '../review/job.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { findFeatureSourcePath } from '../utils/feature-source.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

type ExecutionPrerequisiteStatus = 'satisfied' | 'not_applicable';

export const EXECUTION_PREREQUISITE_REPAIR_CODES = [
  'missing_accepted_scenarios',
  'missing_accepted_approach',
  'missing_admitted_delivery_checklist',
] as const;

export type ExecutionPrerequisiteRepairCode = (typeof EXECUTION_PREREQUISITE_REPAIR_CODES)[number];

interface MissingPrerequisite {
  readonly code: ExecutionPrerequisiteRepairCode;
  readonly message: string;
  readonly command: string;
}

function successful(status: ExecutionPrerequisiteStatus): CliResult {
  return createResult({
    state: 'healthy',
    data: {
      command: 'ticket execution-prerequisite',
      prerequisite_status: status,
      grants_authority: false,
    },
  });
}

function denied(missing: readonly MissingPrerequisite[]): CliResult {
  return createResult({
    state: 'action_required',
    findings: missing.map(item => ({
      code: item.code,
      message: item.message,
      severity: 'warning' as const,
    })),
    nextActions: missing.map(item => ({
      command: item.command,
      mutates: true,
      requiresHuman: false,
    })),
    data: { command: 'ticket execution-prerequisite', grants_authority: false },
  });
}

function reviewApproved(
  cwd: string,
  ledger: string,
  ticketFolder: string,
  kind: ReviewKind,
  target: string | undefined,
): boolean {
  if (target === undefined || !reviewIntegrityKeyExists()) return false;
  const scope = `${ticketFolder}:phase@${kind}`;
  const stamps = parseReviewStamps(ledger)
    .filter(stamp => stamp.scope === scope && stamp.skipReason === undefined)
    .toReversed();
  return stamps.some(stamp => {
    if (stamp.reviewId === undefined) return false;
    const review = reviewJobStatus(cwd, stamp.reviewId);
    if (review.state !== 'healthy' || typeof review.data !== 'object' || review.data === null) {
      return false;
    }
    const data = review.data as Record<string, unknown>;
    return (
      data.status === 'approved' &&
      data.review_kind === kind &&
      Array.isArray(data.review_targets) &&
      data.review_targets.some(
        candidate => typeof candidate === 'string' && nodePath.resolve(cwd, candidate) === target,
      )
    );
  });
}

function designApprovalRequired(cwd: string): boolean {
  const path = nodePath.join(cwd, '.safeword', 'config.json');
  if (!existsSync(path)) return false;
  try {
    const config: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return (
      typeof config === 'object' &&
      config !== null &&
      !Array.isArray(config) &&
      (config as { designApprovalGate?: unknown }).designApprovalGate === true
    );
  } catch {
    return true;
  }
}

function designDecisionAccepted(input: {
  readonly cwd: string;
  readonly ledgerPath: string;
  readonly ticketId: string;
  readonly implementationPath: string;
}): boolean {
  if (!designApprovalRequired(input.cwd)) return true;
  if (!existsSync(input.implementationPath)) return false;
  const digest = createHash('sha256')
    .update(readFileSync(input.implementationPath, 'utf8'))
    .digest('hex');
  return currentDesignDecision(input.ledgerPath, input.ticketId, digest) === 'approved';
}

function contractedFeature(ticketDirectory: string, phase: string | undefined): boolean {
  if (phase !== 'implement' && phase !== 'verify') return true;
  return (
    existsSync(nodePath.join(ticketDirectory, 'impl-plan.md')) &&
    existsSync(nodePath.join(ticketDirectory, 'execution-plan.md'))
  );
}

interface PrerequisiteContext {
  readonly cwd: string;
  readonly ticketId: string;
  readonly ticketDirectory: string;
  readonly ticketFolder: string;
  readonly featurePath: string | undefined;
  readonly implementationPath: string;
  readonly executionPath: string;
  readonly ledgerPath: string;
  readonly ledger: string;
}

function prerequisiteContext(
  cwd: string,
  ticketId: string,
  legacyExemption: boolean,
):
  | { readonly applicable: false; readonly status: ExecutionPrerequisiteStatus }
  | { readonly applicable: true; readonly context: PrerequisiteContext } {
  const ticketDirectory = resolveTicketDirectory(cwd, ticketId);
  if (ticketDirectory === undefined) return { applicable: false, status: 'not_applicable' };
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const ticket = existsSync(ticketPath) ? readFileSync(ticketPath, 'utf8') : '';
  if (readFrontmatterScalar(ticket, 'type') !== 'feature') {
    return { applicable: false, status: 'not_applicable' };
  }
  if (
    legacyExemption &&
    !contractedFeature(ticketDirectory, readFrontmatterScalar(ticket, 'phase'))
  ) {
    return { applicable: false, status: 'not_applicable' };
  }
  const ledgerPath = nodePath.join(resolveNamespaceRoot(cwd), 'skill-invocations.log');
  const ticketFolder = nodePath.basename(ticketDirectory);
  return {
    applicable: true,
    context: {
      cwd,
      ticketId,
      ticketDirectory,
      ticketFolder,
      featurePath: findFeatureSourcePath(cwd, ticketFolder),
      implementationPath: nodePath.join(ticketDirectory, 'impl-plan.md'),
      executionPath: nodePath.join(ticketDirectory, 'execution-plan.md'),
      ledgerPath,
      ledger: existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '',
    },
  };
}

function relativeFeature(context: PrerequisiteContext): string {
  return context.featurePath === undefined
    ? 'features/<ticket>.feature'
    : nodePath.relative(context.cwd, context.featurePath);
}

function scenarioPrerequisite(context: PrerequisiteContext): MissingPrerequisite | undefined {
  if (
    reviewApproved(
      context.cwd,
      context.ledger,
      context.ticketFolder,
      'scenario-gate',
      context.featurePath,
    )
  ) {
    return undefined;
  }
  return {
    code: 'missing_accepted_scenarios',
    message: 'Accepted scenarios are required before execution.',
    command: `safeword review run scenario-gate --context ${nodePath.relative(context.cwd, nodePath.join(context.ticketDirectory, 'spec.md'))} -- ${relativeFeature(context)}`,
  };
}

function approachPrerequisite(context: PrerequisiteContext): MissingPrerequisite | undefined {
  const reviewed = reviewApproved(
    context.cwd,
    context.ledger,
    context.ticketFolder,
    'plan-implementation',
    context.implementationPath,
  );
  if (reviewed && designDecisionAccepted(context)) return undefined;
  return {
    code: 'missing_accepted_approach',
    message: 'An accepted implementation approach is required before execution.',
    command:
      reviewed && designApprovalRequired(context.cwd)
        ? `safeword ticket approve-plan ${context.ticketId}`
        : `safeword review run plan-implementation --context ${relativeFeature(context)} --context ${nodePath.relative(context.cwd, nodePath.join(context.ticketDirectory, 'spec.md'))} -- ${nodePath.relative(context.cwd, context.implementationPath)}`,
  };
}

function checklistPrerequisite(context: PrerequisiteContext): MissingPrerequisite | undefined {
  if (existsSync(context.executionPath)) {
    const plan = readFileSync(context.executionPath, 'utf8');
    const parsed = parseDeliveryPlanContract(plan);
    if (parsed.ok) {
      const definition = createExecutionPlanDeliveryDefinition(
        parsed,
        designApprovalRequired(context.cwd),
      );
      const review = admittedExecutionPlanReview({
        cwd: context.cwd,
        ticketDirectory: context.ticketDirectory,
        planPath: context.executionPath,
        ledger: context.ledger,
        definition,
        digest: normalizedExecutionPlanDigest(plan),
      });
      if (review !== undefined) return undefined;
    }
  }
  return {
    code: 'missing_admitted_delivery_checklist',
    message: 'An admitted Delivery Checklist is required before execution.',
    command: `safeword review run plan-execution --context ${nodePath.relative(context.cwd, context.implementationPath)} --context ${relativeFeature(context)} -- ${nodePath.relative(context.cwd, context.executionPath)}`,
  };
}

/** Evaluate planning admission without granting coding or merge authority. */
export function evaluateExecutionPrerequisite(
  cwd: string,
  ticketId: string,
  options: { readonly legacyExemption?: boolean } = {},
): CliResult {
  const loaded = prerequisiteContext(cwd, ticketId, options.legacyExemption ?? true);
  if (!loaded.applicable) return successful(loaded.status);
  const missing = [
    scenarioPrerequisite(loaded.context),
    approachPrerequisite(loaded.context),
    checklistPrerequisite(loaded.context),
  ].filter((item): item is MissingPrerequisite => item !== undefined);
  return missing.length === 0 ? successful('satisfied') : denied(missing);
}
