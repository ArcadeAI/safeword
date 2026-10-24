import nodePath from 'node:path';

import type { CommandInvocation } from './handler.js';
import { type CliResult, createResult } from './result.js';

export function boundedProofArgumentFailure(message: string): CliResult {
  const command = 'safeword proof observe-bounded-delivery';
  return createResult({
    state: 'failed',
    data: {
      authority: 'execution-only',
      purpose: 'bounded-delivery-observation:v1',
      status: 'refused',
      current: false,
    },
    errors: [{ code: 'CLI_ARGUMENT_INVALID', message, retryable: false }],
    nextActions: [{ command, mutates: true, requiresHuman: false }],
    presentation: {
      kind: 'raw',
      body: `Execution-only request refused. Use the fixed request: ${command}.`,
    },
  });
}

export async function boundedObservationHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeBoundedDelivery } = await import('../bounded-observation/index.js');
  try {
    const data = await observeBoundedDelivery(invocation.cwd);
    const observed = data.status === 'observed';
    const nextCommand = observed
      ? `safeword proof verify-bounded-delivery ${data.attempt_id}`
      : 'safeword proof observe-bounded-delivery';
    const explanation = observed
      ? 'All required results passed. No historical RED, certification or completion authority.'
      : 'Preserve this attempt. Correct the named problem before retrying.';
    const evidence = observed ? data.report_path : nodePath.dirname(data.report_path);
    return createResult({
      state: observed ? 'healthy' : 'action_required',
      data,
      errors: observed
        ? []
        : [
            {
              code: 'BOUNDED_OBSERVATION_REFUSED',
              message: data.problem ?? 'Incomplete execution-only observation',
              retryable: true,
            },
          ],
      presentation: {
        kind: 'raw',
        body: `Execution-only ${data.status}: ${data.attempt_id}\n${explanation}\nEvidence: ${evidence}\nNext: ${nextCommand}`,
      },
      nextActions: [
        {
          command: nextCommand,
          mutates: !observed,
          requiresHuman: false,
        },
      ],
    });
  } catch (error) {
    return observationFailure(error);
  }
}

export async function boundedVerificationHandler(
  invocation: CommandInvocation,
): Promise<CliResult> {
  const { verifyBoundedDelivery } = await import('../bounded-observation/index.js');
  try {
    const id = invocation.operands[0];
    if (typeof id !== 'string') throw new Error('Supply the retained attempt UUID');
    const data = verifyBoundedDelivery(invocation.cwd, id);
    return createResult({
      state: 'healthy',
      data,
      presentation: {
        kind: 'raw',
        body: `Current execution-only observation ${id}. No new observation is needed for bookkeeping alone. Historical RED, certification and completion authority remain unchanged.`,
      },
    });
  } catch (error) {
    return observationFailure(error);
  }
}

function observationFailure(error: unknown): CliResult {
  const problem = error instanceof Error ? error.message : String(error);
  return createResult({
    state: 'action_required',
    data: {
      authority: 'execution-only',
      purpose: 'bounded-delivery-observation:v1',
      status: 'refused',
      current: false,
    },
    errors: [{ code: 'BOUNDED_OBSERVATION_REFUSED', message: problem, retryable: true }],
    nextActions: [
      { command: 'safeword proof observe-bounded-delivery', mutates: true, requiresHuman: false },
    ],
    presentation: {
      kind: 'raw',
      body: `Execution-only evidence refused: ${problem}\nPreserve existing attempts. Correct the named problem and run safeword proof observe-bounded-delivery.`,
    },
  });
}
