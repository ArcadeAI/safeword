import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { diffFileSnapshots } from '../cli-protocol/file-effects.js';
import type { CliPlan } from '../cli-protocol/plan.js';
import { isPlanIdentity, malformedPlanIdentity, toWirePlan } from '../cli-protocol/plan.js';
import {
  applyReconciliation,
  createReconciliationPlan,
  effectsForReconciliation,
} from '../cli-protocol/reconciliation.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReconcileResult } from '../reconcile.js';
import { ReconcileExecutionError } from '../reconcile.js';
import type { SafewordSchema } from '../schema.js';
import type { DependencyInstallResult } from '../utils/install.js';
import { uninstallDependencies } from '../utils/install.js';

export interface RemoveOptions {
  readonly full?: boolean;
  readonly yes?: boolean;
  readonly plan?: string;
  readonly schema?: SafewordSchema;
}

const PACKAGE_MANAGER_FILES = [
  'package.json',
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
] as const;

function snapshotPackageFiles(cwd: string): ReadonlyMap<string, string> {
  const snapshot = new Map<string, string>();
  for (const target of PACKAGE_MANAGER_FILES) {
    const path = nodePath.join(cwd, target);
    if (existsSync(path)) snapshot.set(target, readFileSync(path).toString('base64'));
  }
  return snapshot;
}

function combinedFileEffects(
  ...groups: readonly (readonly { kind: string; target: string }[])[]
): { kind: string; target: string }[] {
  const effects = new Map<string, { kind: string; target: string }>();
  for (const effect of groups.flat()) effects.set(`${effect.kind}\0${effect.target}`, effect);
  return effects.values().toArray();
}

function confirmationRequired(plan: CliPlan, full: boolean): CliResult {
  const fullFlag = full ? ' --full' : '';
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
        command: `safeword remove${fullFlag} --yes --plan ${plan.id}`,
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
  applied: ReconcileResult,
  packageRemoval: DependencyInstallResult,
  mode: 'uninstall' | 'uninstall-full',
  packageFileEffects: readonly { kind: string; target: string }[],
): CliResult {
  const completed = effectsForReconciliation(applied, mode);
  const files = combinedFileEffects(completed.files, packageFileEffects);
  return createResult({
    state: 'failed',
    changed: completed.destructive.length > 0 || files.length > 0,
    effects: {
      ...completed,
      files,
      network: packageRemoval.attempted
        ? [
            {
              kind: 'package-registry',
              target: packageRemoval.command ?? 'Safeword packages',
              operation: 'uninstall-failed',
            },
          ]
        : [],
    },
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
  full: boolean,
  schema?: SafewordSchema,
): Promise<CliResult> {
  const applied = await applyReconciliation(cwd, mode, schema);
  const packageFilesBefore = snapshotPackageFiles(cwd);
  const packageRemoval = full
    ? uninstallDependencies(cwd, applied.packagesToRemove, { report: false })
    : { attempted: false, installed: false };
  const packageFileEffects = diffFileSnapshots(packageFilesBefore, snapshotPackageFiles(cwd));
  if (packageRemoval.attempted && !packageRemoval.installed) {
    return packageUninstallFailure(applied, packageRemoval, mode, packageFileEffects);
  }
  const completed = effectsForReconciliation(applied, mode);
  const packageEffects = packageRemoval.installed
    ? applied.packagesToRemove.map(target => ({ kind: 'remove', target }))
    : [];
  const files = combinedFileEffects(completed.files, packageFileEffects);
  return createResult({
    state:
      completed.destructive.length === 0 && packageEffects.length === 0 && files.length === 0
        ? 'healthy'
        : 'changed',
    effects: {
      ...completed,
      files,
      packages: packageEffects,
      network: packageRemoval.installed
        ? packageEffects.map(effect => ({
            kind: 'package-registry',
            target: effect.target,
            operation: 'uninstall',
          }))
        : [],
    },
    data: { removed: applied.removed },
  });
}

function partialRemovalEffects(
  removeError: unknown,
): (Partial<CliResult['effects']> & Pick<CliResult['effects'], 'destructive'>) | undefined {
  if (!(removeError instanceof ReconcileExecutionError)) return undefined;
  return {
    files: [
      ...removeError.partial.created.map(target => ({ kind: 'create', target })),
      ...removeError.partial.updated.map(target => ({ kind: 'update', target })),
    ],
    packages: [],
    configuration: [],
    network: [],
    destructive: removeError.partial.removed.map(target => ({
      kind: 'remove',
      target,
    })),
  };
}

function hasPartialRemovalEffects(partial: ReturnType<typeof partialRemovalEffects>): boolean {
  return (partial?.destructive.length ?? 0) !== 0 || (partial?.files?.length ?? 0) !== 0;
}

export async function removeProject(cwd: string, options: RemoveOptions): Promise<CliResult> {
  if (options.plan !== undefined && !isPlanIdentity(options.plan)) {
    return malformedPlanIdentity('remove');
  }
  if (!existsSync(nodePath.join(cwd, '.safeword'))) {
    return createResult({
      state: 'healthy',
      findings: [
        {
          code: 'PROJECT_NOT_CONFIGURED',
          message: 'Safeword is not configured; there is nothing to remove.',
          severity: 'info',
        },
      ],
      data: { removed: [] },
    });
  }
  const mode = options.full === true ? 'uninstall-full' : 'uninstall';
  try {
    const { plan } = await createReconciliationPlan(cwd, mode, options.schema);
    if (options.yes !== true || options.plan === undefined) {
      return confirmationRequired(plan, options.full === true);
    }
    if (options.plan !== plan.id) return stalePlan(plan);
    return await applyRemoval(cwd, mode, options.full === true, options.schema);
  } catch (removeError) {
    const partial = partialRemovalEffects(removeError);
    return createResult({
      state: 'failed',
      changed: hasPartialRemovalEffects(partial),
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
