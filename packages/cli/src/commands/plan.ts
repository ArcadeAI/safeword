import { toWirePlan } from '../cli-protocol/plan.js';
import { createReconciliationPlan } from '../cli-protocol/reconciliation.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';

export async function observePlan(cwd: string): Promise<CliResult> {
  try {
    const { plan } = await createReconciliationPlan(cwd, 'upgrade');
    const hasEffects = Object.values(plan.effects).some(effects => effects.length > 0);
    return createResult({
      state: hasEffects ? 'action_required' : 'healthy',
      findings: hasEffects
        ? [
            {
              code: 'RECONCILIATION_AVAILABLE',
              message: 'Safeword can reconcile this project.',
              severity: 'warning',
            },
          ]
        : [],
      nextActions: hasEffects
        ? [{ command: 'safeword install', mutates: true, requiresHuman: false }]
        : [],
      data: { plan: toWirePlan(plan) },
    });
  } catch (planError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PLAN_FAILED',
          message: planError instanceof Error ? planError.message : String(planError),
          retryable: false,
        },
      ],
    });
  }
}
