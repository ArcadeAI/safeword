import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { CliPlan } from '../cli-protocol/plan.js';
import { toWirePlan } from '../cli-protocol/plan.js';
import {
  applyReconciliation,
  createReconciliationPlan,
  effectsForReconciliation,
} from '../cli-protocol/reconciliation.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReconcileResult } from '../reconcile.js';
import { ReconcileExecutionError } from '../reconcile.js';
import type { DependencyInstallResult } from '../utils/install.js';
import { uninstallDependencies } from '../utils/install.js';

export interface RemoveOptions {
  readonly full?: boolean;
  readonly yes?: boolean;
  readonly plan?: string;
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

function observedPackageFileEffects(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): { kind: string; target: string }[] {
  const effects: { kind: string; target: string }[] = [];
  for (const [target, content] of after) {
    const previous = before.get(target);
    if (previous === undefined) effects.push({ kind: 'create', target });
    else if (previous !== content) effects.push({ kind: 'update', target });
  }
  for (const target of before.keys()) {
    if (!after.has(target)) effects.push({ kind: 'delete', target });
  }
  return effects;
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
  return createResult({
    state: 'failed',
    changed: completed.destructive.length > 0 || packageFileEffects.length > 0,
    effects: {
      ...completed,
      files: packageFileEffects,
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
): Promise<CliResult> {
  const applied = await applyReconciliation(cwd, mode);
  const packageFilesBefore = snapshotPackageFiles(cwd);
  const packageRemoval = full
    ? uninstallDependencies(cwd, applied.packagesToRemove, { report: false })
    : { attempted: false, installed: false };
  const packageFileEffects = observedPackageFileEffects(
    packageFilesBefore,
    snapshotPackageFiles(cwd),
  );
  if (packageRemoval.attempted && !packageRemoval.installed) {
    return packageUninstallFailure(applied, packageRemoval, mode, packageFileEffects);
  }
  const completed = effectsForReconciliation(applied, mode);
  const packageEffects = packageRemoval.installed
    ? applied.packagesToRemove.map(target => ({ kind: 'remove', target }))
    : [];
  return createResult({
    state:
      completed.destructive.length === 0 &&
      packageEffects.length === 0 &&
      packageFileEffects.length === 0
        ? 'healthy'
        : 'changed',
    effects: {
      ...completed,
      files: packageFileEffects,
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
    files: [],
    packages: [],
    configuration: [],
    network: [],
    destructive: removeError.partial.removed.map(target => ({
      kind: 'remove',
      target,
    })),
  };
}

export async function removeProject(cwd: string, options: RemoveOptions): Promise<CliResult> {
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
    const { plan } = await createReconciliationPlan(cwd, mode);
    if (options.yes !== true || options.plan === undefined) {
      return confirmationRequired(plan, options.full === true);
    }
    if (options.plan !== plan.id) return stalePlan(plan);
    return await applyRemoval(cwd, mode, options.full === true);
  } catch (removeError) {
    const partial = partialRemovalEffects(removeError);
    return createResult({
      state: 'failed',
      changed: (partial?.destructive.length ?? 0) !== 0,
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
