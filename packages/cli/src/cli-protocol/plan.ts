import { createHash } from 'node:crypto';

import { type CliResult, createResult, type Effect, type Effects, type Finding } from './result.js';

interface Verification {
  readonly description: string;
  readonly command?: string;
}

export interface CliPlan {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly command: string;
  readonly preconditionDigest: string;
  readonly effects: Effects;
  readonly findings: readonly Finding[];
  readonly requiresConfirmation: boolean;
  readonly verification: readonly Verification[];
}

interface PlanInput {
  readonly command: string;
  readonly preconditionDigest: string;
  readonly effects?: Partial<Readonly<Record<keyof Effects, readonly Effect[]>>>;
  readonly findings?: readonly Finding[];
  readonly requiresConfirmation?: boolean;
  readonly verification?: readonly Verification[];
}

const EMPTY_EFFECTS: Effects = {
  files: [],
  packages: [],
  configuration: [],
  network: [],
  destructive: [],
};

const PLAN_IDENTITY_PATTERN = /^[a-f\d]{64}$/u;

export function isPlanIdentity(value: string): boolean {
  return PLAN_IDENTITY_PATTERN.test(value);
}

/**
 * Return the programmatic-boundary error for callers that bypass Commander.
 * Normal CLI invocations reject malformed values earlier as CLI_ARGUMENT_INVALID.
 */
export function malformedPlanIdentity(command: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'PLAN_MALFORMED',
        message: `The ${command} plan identity must be the 64-character hexadecimal id returned by its latest preview.`,
        retryable: false,
      },
    ],
  });
}

function planIdentity(input: Omit<CliPlan, 'id'>): string {
  return createHash('sha256')
    .update(JSON.stringify([input.command, input.preconditionDigest, input.effects]))
    .digest('hex');
}

export function createPlan(input: PlanInput): CliPlan {
  const planWithoutIdentity: Omit<CliPlan, 'id'> = {
    schemaVersion: 1,
    command: input.command,
    preconditionDigest: input.preconditionDigest,
    effects: { ...EMPTY_EFFECTS, ...input.effects },
    findings: input.findings ?? [],
    requiresConfirmation: input.requiresConfirmation ?? false,
    verification: input.verification ?? [],
  };
  return { ...planWithoutIdentity, id: planIdentity(planWithoutIdentity) };
}

export function isPlanCurrent(plan: CliPlan, preconditionDigest: string): boolean {
  return plan.preconditionDigest === preconditionDigest;
}

export function toWirePlan(plan: CliPlan): Record<string, unknown> {
  return {
    schema_version: plan.schemaVersion,
    id: plan.id,
    command: plan.command,
    precondition_digest: plan.preconditionDigest,
    effects: plan.effects,
    findings: plan.findings,
    requires_confirmation: plan.requiresConfirmation,
    verification: plan.verification,
  };
}
