import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseFrontmatter } from '../../templates/hooks/lib/hierarchy.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { executionPlanAdmission } from '../execution-plan/delivery-admission.js';
import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../execution-plan/delivery-checklist.js';
import { currentDesignDecision } from '../review/approval-ledger.js';
import { phaseReviewAdmission, type ReviewProvenance } from '../review/phase-admission.js';
import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import { findFeatureSourcePath } from '../utils/feature-source.js';
import { readFrontmatterScalar } from '../utils/frontmatter.js';
import { resolveTicketDirectory } from '../utils/product-plan-contract.js';

type ExecutionPrerequisiteStatus = 'satisfied' | 'not_applicable';

export const EXECUTION_PREREQUISITE_REPAIR_CODES = [
  'missing_accepted_scenarios',
  'missing_accepted_approach',
  'missing_admitted_delivery_checklist',
  'missing_execution_plan_verdict',
  'rejected_execution_plan_review',
  'unearned_execution_plan_assurance',
] as const;

export type ExecutionPrerequisiteRepairCode = (typeof EXECUTION_PREREQUISITE_REPAIR_CODES)[number];

interface MissingPrerequisite {
  readonly code: ExecutionPrerequisiteRepairCode;
  readonly message: string;
  readonly command: string;
}

function successful(
  status: ExecutionPrerequisiteStatus,
  achievedIndependence?: 'cross-agent' | 'degraded',
  inputIdentity?: string,
): CliResult {
  return createResult({
    state: 'healthy',
    data: {
      command: 'ticket execution-prerequisite',
      prerequisite_status: status,
      grants_authority: false,
      ...(achievedIndependence !== undefined && {
        achieved_independence: achievedIndependence,
      }),
      ...(inputIdentity !== undefined && {
        authorization_input_identity: inputIdentity,
      }),
    },
  });
}

function denied(missing: readonly MissingPrerequisite[], inputIdentity?: string): CliResult {
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
    data: {
      command: 'ticket execution-prerequisite',
      grants_authority: false,
      ...(inputIdentity !== undefined && {
        authorization_input_identity: inputIdentity,
      }),
    },
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
  const planDigest = createHash('sha256')
    .update(readFileSync(input.implementationPath, 'utf8'))
    .digest('hex');
  return currentDesignDecision(input.ledgerPath, input.ticketId, planDigest) === 'approved';
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
  readonly ticket: string;
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
      ticket,
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

function admittedPhaseReview(
  context: PrerequisiteContext,
  kind: 'scenario-gate' | 'plan-implementation',
  target: string | undefined,
  label: string,
): ReviewProvenance | undefined {
  if (target === undefined) return undefined;
  const admission = phaseReviewAdmission({
    cwd: context.cwd,
    ticketDirectory: context.ticketDirectory,
    kind,
    target: nodePath.resolve(target),
    ledger: context.ledger,
    label,
  });
  return admission.kind === 'admitted' ? admission.provenance : undefined;
}

function scenarioPrerequisite(
  context: PrerequisiteContext,
  reviewed: ReviewProvenance | undefined,
): MissingPrerequisite | undefined {
  if (reviewed !== undefined) return undefined;
  return {
    code: 'missing_accepted_scenarios',
    message: 'Accepted scenarios are required before execution.',
    command: `safeword review run scenario-gate --context ${nodePath.relative(context.cwd, nodePath.join(context.ticketDirectory, 'spec.md'))} -- ${relativeFeature(context)}`,
  };
}

function approachPrerequisite(
  context: PrerequisiteContext,
  reviewed: ReviewProvenance | undefined,
): MissingPrerequisite | undefined {
  if (reviewed !== undefined && designDecisionAccepted(context)) return undefined;
  return {
    code: 'missing_accepted_approach',
    message: 'An accepted implementation approach is required before execution.',
    command:
      reviewed !== undefined && designApprovalRequired(context.cwd)
        ? `safeword ticket approve-plan ${context.ticketId}`
        : `safeword review run plan-implementation --context ${relativeFeature(context)} --context ${nodePath.relative(context.cwd, nodePath.join(context.ticketDirectory, 'spec.md'))} -- ${nodePath.relative(context.cwd, context.implementationPath)}`,
  };
}

type ChecklistPrerequisite =
  | {
      readonly admitted: true;
      readonly independence: 'cross-agent' | 'degraded';
      readonly provenance: ReviewProvenance;
    }
  | { readonly admitted: false; readonly missing: MissingPrerequisite };

function checklistPrerequisite(context: PrerequisiteContext): ChecklistPrerequisite {
  const command = `safeword review run plan-execution --context ${nodePath.relative(context.cwd, context.implementationPath)} --context ${relativeFeature(context)} -- ${nodePath.relative(context.cwd, context.executionPath)}`;
  if (existsSync(context.executionPath)) {
    const plan = readFileSync(context.executionPath, 'utf8');
    const parsed = parseDeliveryPlanContract(plan);
    if (parsed.ok) {
      const definition = createExecutionPlanDeliveryDefinition(
        parsed,
        designApprovalRequired(context.cwd),
      );
      const review = executionPlanAdmission({
        cwd: context.cwd,
        ticketDirectory: context.ticketDirectory,
        planPath: context.executionPath,
        ledger: context.ledger,
        definition,
        digest: normalizedExecutionPlanDigest(plan),
      });
      if (review.kind === 'admitted') {
        return {
          admitted: true,
          independence: review.independence,
          provenance: review.provenance,
        };
      }
      if (review.kind === 'missing_verdict') {
        return {
          admitted: false,
          missing: {
            code: 'missing_execution_plan_verdict',
            message: 'The current Execution Plan review has no verdict.',
            command,
          },
        };
      }
      if (review.kind === 'rejected') {
        return {
          admitted: false,
          missing: {
            code: 'rejected_execution_plan_review',
            message: review.message,
            command,
          },
        };
      }
      if (review.kind === 'unearned_assurance') {
        return {
          admitted: false,
          missing: {
            code: 'unearned_execution_plan_assurance',
            message: 'The Execution Plan review has no validated achieved independence.',
            command,
          },
        };
      }
    }
  }
  return {
    admitted: false,
    missing: {
      code: 'missing_admitted_delivery_checklist',
      message: 'An admitted Delivery Checklist is required before execution.',
      command,
    },
  };
}

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileDigest(path: string | undefined): string {
  return path !== undefined && existsSync(path) ? digest(readFileSync(path, 'utf8')) : 'missing';
}

function stableTicketScope(ticket: string): Record<string, string | readonly string[]> {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(ticket)?.[1];
  const parsed = parseFrontmatter(frontmatter ?? '');
  const field = (name: string): string | readonly string[] => parsed[name] ?? 'missing';
  return {
    scope: field('scope'),
    out_of_scope: field('out_of_scope'),
    done_when: field('done_when'),
  };
}

function designDecisionState(context: PrerequisiteContext): string {
  if (!designApprovalRequired(context.cwd)) return 'not_required';
  if (!existsSync(context.implementationPath)) return 'missing_plan';
  const planDigest = digest(readFileSync(context.implementationPath, 'utf8'));
  return currentDesignDecision(context.ledgerPath, context.ticketId, planDigest) ?? 'pending';
}

function applicableIdentityInput(
  context: PrerequisiteContext,
  reviews: {
    readonly scenario?: ReviewProvenance;
    readonly implementation?: ReviewProvenance;
    readonly execution?: ReviewProvenance;
  },
): Record<string, unknown> {
  const executionPlan = existsSync(context.executionPath)
    ? normalizedExecutionPlanDigest(readFileSync(context.executionPath, 'utf8'))
    : 'missing';
  return {
    applicability: 'applicable',
    ticket_scope: stableTicketScope(context.ticket),
    product_plan: fileDigest(nodePath.join(context.ticketDirectory, 'spec.md')),
    accepted_scenarios: fileDigest(context.featurePath),
    implementation_plan: fileDigest(context.implementationPath),
    execution_plan: executionPlan,
    reviews: {
      scenarios: reviews.scenario ?? 'missing',
      implementation: reviews.implementation ?? 'missing',
      execution: reviews.execution ?? 'missing',
    },
    human_design_decision: designDecisionState(context),
  };
}

function authorizationInputIdentity(input: {
  readonly cwd: string;
  readonly ticketId: string;
  readonly context?: PrerequisiteContext;
  readonly scenarioReview?: ReviewProvenance;
  readonly implementationReview?: ReviewProvenance;
  readonly executionReview?: ReviewProvenance;
  readonly status?: ExecutionPrerequisiteStatus;
}): string {
  const configPath = nodePath.join(input.cwd, '.safeword', 'config.json');
  const evaluated =
    input.context === undefined
      ? { applicability: input.status ?? 'not_applicable' }
      : applicableIdentityInput(input.context, {
          scenario: input.scenarioReview,
          implementation: input.implementationReview,
          execution: input.executionReview,
        });
  return digest(
    JSON.stringify({
      version: 1,
      ticket_id: input.ticketId,
      config: fileDigest(configPath),
      ...evaluated,
    }),
  );
}

function maybeAuthorizationIdentity(
  enabled: boolean | undefined,
  input: Parameters<typeof authorizationInputIdentity>[0],
): string | undefined {
  return enabled === true ? authorizationInputIdentity(input) : undefined;
}

/** Evaluate planning admission without granting coding or merge authority. */
export function evaluateExecutionPrerequisite(
  cwd: string,
  ticketId: string,
  options: {
    readonly legacyExemption?: boolean;
    readonly includeAssurance?: boolean;
    readonly includeAuthorizationIdentity?: boolean;
  } = {},
): CliResult {
  const loaded = prerequisiteContext(cwd, ticketId, options.legacyExemption ?? true);
  if (!loaded.applicable) {
    const identity = maybeAuthorizationIdentity(options.includeAuthorizationIdentity, {
      cwd,
      ticketId,
      status: loaded.status,
    });
    return successful(loaded.status, undefined, identity);
  }
  const scenarioReview = admittedPhaseReview(
    loaded.context,
    'scenario-gate',
    loaded.context.featurePath,
    'Scenario',
  );
  const implementationReview = admittedPhaseReview(
    loaded.context,
    'plan-implementation',
    loaded.context.implementationPath,
    'Implementation Plan',
  );
  const checklist = checklistPrerequisite(loaded.context);
  const missing = [
    scenarioPrerequisite(loaded.context, scenarioReview),
    approachPrerequisite(loaded.context, implementationReview),
    checklist.admitted ? undefined : checklist.missing,
  ].filter((item): item is MissingPrerequisite => item !== undefined);
  const identity = maybeAuthorizationIdentity(options.includeAuthorizationIdentity, {
    cwd,
    ticketId,
    context: loaded.context,
    scenarioReview,
    implementationReview,
    executionReview: checklist.admitted ? checklist.provenance : undefined,
  });
  if (missing.length > 0) return denied(missing, identity);
  const independence =
    options.includeAssurance === true && checklist.admitted ? checklist.independence : undefined;
  return successful('satisfied', independence, identity);
}
