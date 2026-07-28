import type { CliPlan } from '../cli-protocol/plan.js';
import { toWirePlan } from '../cli-protocol/plan.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReconcileResult } from '../reconcile.js';
import { ReconcileExecutionError } from '../reconcile.js';
import type { DependencyInstallResult } from '../utils/install.js';
import { uninstallDependencies } from '../utils/install.js';
import { applyReconciliation, createReconciliationPlan } from './reconciliation-plan.js';

export interface RemoveOptions {
  readonly full?: boolean;
  readonly yes?: boolean;
  readonly plan?: string;
}

function confirmationRequired(plan: CliPlan): CliResult {
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
    data: { plan: toWirePlan(plan) },
  });
}

function stalePlan(plan: CliPlan): CliResult {
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
    data: { plan: toWirePlan(plan) },
  });
}

function packageUninstallFailure(
  plan: CliPlan,
  applied: ReconcileResult,
  packageRemoval: DependencyInstallResult,
): CliResult {
  return createResult({
    state: 'failed',
    changed: applied.actions.length > 0,
    effects: { destructive: plan.effects.destructive },
    errors: [
      {
        code: 'PACKAGE_UNINSTALL_FAILED',
        message: packageRemoval.error ?? 'Safeword package removal failed.',
        retryable: true,
      },
    ],
    recovery: [
      {
        command: packageRemoval.command ?? 'safeword remove --full',
        description: 'Complete the package removal, then re-run Safeword status.',
        requiresHuman: true,
      },
    ],
  });
}

async function applyRemoval(
  cwd: string,
  mode: 'uninstall' | 'uninstall-full',
  plan: CliPlan,
  full: boolean,
): Promise<CliResult> {
  const applied = await applyReconciliation(cwd, mode);
  const packageRemoval = full
    ? uninstallDependencies(cwd, applied.packagesToRemove, { report: false })
    : { attempted: false, installed: false };
  if (packageRemoval.attempted && !packageRemoval.installed) {
    return packageUninstallFailure(plan, applied, packageRemoval);
  }
  return createResult({
    state: applied.actions.length === 0 ? 'healthy' : 'changed',
    changed: applied.actions.length > 0,
    effects: plan.effects,
    data: { removed: applied.removed },
  });
}

export async function removeProject(cwd: string, options: RemoveOptions): Promise<CliResult> {
  const mode = options.full === true ? 'uninstall-full' : 'uninstall';
  try {
    const { plan } = await createReconciliationPlan(cwd, mode);
    if (options.yes !== true || options.plan === undefined) {
      return confirmationRequired(plan);
    }
    if (options.plan !== plan.id) return stalePlan(plan);
    return await applyRemoval(cwd, mode, plan, options.full === true);
  } catch (removeError) {
    const partial =
      removeError instanceof ReconcileExecutionError
        ? {
            files: [],
            packages: [],
            configuration: [],
            network: [],
            destructive: removeError.partial.removed.map(target => ({
              kind: 'remove',
              target,
            })),
          }
        : undefined;
    return createResult({
      state: 'failed',
      changed: partial?.destructive.length !== 0,
      effects: partial,
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
