import type { CommandInvocation } from './handler.js';
import { type CliResult, createResult } from './result.js';

export async function boundedObservationHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeBoundedDelivery } = await import('../bounded-observation/index.js');
  try {
    const data = await observeBoundedDelivery(invocation.cwd);
    const observed = data.status === 'observed';
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
        body: `Execution-only ${data.status}: ${data.attempt_id}\n${data.problem ?? 'All required results passed. No historical RED, certification or completion authority.'}\nEvidence: ${data.report_path}\nVerify: safeword proof verify-bounded-delivery ${data.attempt_id}`,
      },
      nextActions: [
        {
          command: observed
            ? `safeword proof verify-bounded-delivery ${data.attempt_id}`
            : 'safeword proof observe-bounded-delivery',
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
