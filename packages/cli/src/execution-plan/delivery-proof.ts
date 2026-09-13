import type {
  DeliveryCommandInvocation,
  DeliveryProofSpecification,
} from './delivery-checklist.js';

interface DeliveryCommandProofSpecification extends DeliveryProofSpecification {
  readonly method: 'command';
  readonly invocation: DeliveryCommandInvocation;
}

export interface DeliveryProofExecutionResult {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly termination: {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly timedOut: boolean;
  };
  readonly stdout: { readonly bytes: number; readonly sha256: string };
  readonly stderr: { readonly bytes: number; readonly sha256: string };
}

export function executeDeliveryCommandProof(_input: {
  readonly projectRoot: string;
  readonly specification: DeliveryCommandProofSpecification;
}): Promise<DeliveryProofExecutionResult> {
  return Promise.reject(new Error('Delivery proof execution is not implemented.'));
}
