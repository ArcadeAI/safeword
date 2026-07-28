interface PlanInput {
  command: string;
  preconditionDigest: string;
  effects?: {
    destructive?: readonly { kind: string; target: string }[];
  };
  requiresConfirmation?: boolean;
}

export function createPlan(_input: PlanInput): never {
  throw new Error('Not implemented');
}

export function isPlanCurrent(_plan: unknown, _preconditionDigest: string): never {
  throw new Error('Not implemented');
}
