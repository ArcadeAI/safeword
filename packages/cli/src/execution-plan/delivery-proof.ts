import { executeNoShellCommand } from '../review/red-execution.js';
import type {
  DeliveryCommandInvocation,
  DeliveryProofSpecification,
} from './delivery-checklist.js';

const DELIVERY_PROOF_TIMEOUT_MS = 120_000;

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

export async function executeDeliveryCommandProof(input: {
  readonly projectRoot: string;
  readonly specification: DeliveryCommandProofSpecification;
}): Promise<DeliveryProofExecutionResult> {
  return executeNoShellCommand({
    projectRoot: input.projectRoot,
    argv: input.specification.invocation.argv,
    cwd: input.specification.invocation.cwd,
    timeoutMs: DELIVERY_PROOF_TIMEOUT_MS,
  });
}
