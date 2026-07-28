import { createHash } from 'node:crypto';

import type { Effect, Effects, Finding } from './result.js';

export interface Verification {
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
