import { toWirePlan } from '../cli-protocol/plan.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  applyReconciliation,
  createReconciliationPlan,
  effectsForReconciliation,
} from './reconciliation-plan.js';

export interface RemoveOptions {
  readonly full?: boolean;
  readonly yes?: boolean;
  readonly plan?: string;
}

export async function removeProject(cwd: string, options: RemoveOptions): Promise<CliResult> {
  const mode = options.full === true ? 'uninstall-full' : 'uninstall';
  try {
    const { plan } = await createReconciliationPlan(cwd, mode);
    const data = { plan: toWirePlan(plan) };
    if (options.yes !== true || options.plan === undefined) {
      return createResult({
        state: 'action_required',
        findings: [
          {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Review and confirm the exact removal plan.',
            severity: 'warning',
          },
        ],
        nextActions: [
          {
            command: `safeword remove --yes --plan ${plan.id}`,
            mutates: true,
            requiresHuman: true,
          },
        ],
        data,
      });
    }
    if (options.plan !== plan.id) {
      return createResult({
        state: 'action_required',
        findings: [
          {
            code: 'PLAN_STALE',
            message: 'The project changed after this removal plan was created.',
            severity: 'warning',
          },
        ],
        nextActions: [{ command: 'safeword remove', mutates: false, requiresHuman: true }],
        data,
      });
    }

    const applied = await applyReconciliation(cwd, mode);
    return createResult({
      state: applied.actions.length === 0 ? 'healthy' : 'changed',
      changed: applied.actions.length > 0,
      effects: effectsForReconciliation(applied, mode),
      data: {
        removed: applied.removed,
      },
    });
  } catch (removeError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REMOVE_FAILED',
          message: removeError instanceof Error ? removeError.message : String(removeError),
          retryable: true,
        },
      ],
      recovery: [
        {
          command: 'safeword status --verbose',
          description: 'Inspect the effects that completed before retrying.',
          requiresHuman: true,
        },
      ],
    });
  }
}
