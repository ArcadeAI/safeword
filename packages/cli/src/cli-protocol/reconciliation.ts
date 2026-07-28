import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { type Action, reconcile, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { type CliPlan, createPlan } from './plan.js';
import type { Effect, Effects } from './result.js';

type PlanMode = 'upgrade' | 'uninstall' | 'uninstall-full';

function actionTargets(action: Action): string[] {
  return action.type === 'chmod' ? action.paths : [action.path];
}

function hashPath(hash: ReturnType<typeof createHash>, absolutePath: string): void {
  try {
    const stat = lstatSync(absolutePath);
    hash.update(
      stat.isSymbolicLink() ? `link:${readlinkSync(absolutePath)}` : stat.mode.toString(),
    );
    if (stat.isDirectory()) {
      const entries = readdirSync(absolutePath).toSorted((left, right) =>
        left.localeCompare(right),
      );
      for (const name of entries) {
        hash.update(name);
        hashPath(hash, nodePath.join(absolutePath, name));
      }
    } else if (stat.isFile()) {
      hash.update(readFileSync(absolutePath));
    }
  } catch {
    hash.update('missing');
  }
}

function preconditionDigest(cwd: string, actions: readonly Action[]): string {
  const hash = createHash('sha256');
  const targets = [...new Set(actions.flatMap(action => actionTargets(action)))].toSorted(
    (left, right) => left.localeCompare(right),
  );
  for (const target of targets) {
    hash.update(target);
    hashPath(hash, nodePath.join(cwd, target));
  }
  return hash.digest('hex');
}

function actionEffect(action: Action): Effect[] {
  return actionTargets(action).map(target => ({
    kind: action.type,
    target,
    operation: action.type,
  }));
}

export function effectsForReconciliation(result: ReconcileResult, mode: PlanMode): Effects {
  if (result.applied) {
    const created = result.created.map(target => ({ kind: 'create', target }));
    const updated = result.updated.map(target => ({ kind: 'update', target }));
    const removed = result.removed.map(target => ({ kind: 'remove', target }));
    return {
      files: mode === 'upgrade' ? [...created, ...updated] : [],
      packages: [],
      configuration: [],
      network: [],
      destructive: mode === 'upgrade' ? [] : removed,
    };
  }

  const fileEffects = result.actions.flatMap(action => actionEffect(action));
  const packageNames = mode === 'upgrade' ? result.packagesToInstall : result.packagesToRemove;
  const packageEffects = packageNames.map(target => ({
    kind: mode === 'upgrade' ? 'install' : 'remove',
    target,
  }));
  return {
    files: mode === 'upgrade' ? fileEffects : [],
    packages: packageEffects,
    configuration: [],
    network:
      mode === 'upgrade'
        ? packageNames.map(target => ({
            kind: 'package-registry',
            target,
            operation: 'install',
          }))
        : [],
    destructive: mode === 'upgrade' ? [] : fileEffects,
  };
}

export interface ReconciliationPlan {
  readonly plan: CliPlan;
  readonly dryRun: ReconcileResult;
}

export async function createReconciliationPlan(
  cwd: string,
  mode: PlanMode,
): Promise<ReconciliationPlan> {
  const context = createProjectContext(cwd);
  const dryRun = await reconcile(SAFEWORD_SCHEMA, mode, context, { dryRun: true });
  const effects = effectsForReconciliation(dryRun, mode);
  return {
    dryRun,
    plan: createPlan({
      command: mode === 'upgrade' ? 'setup' : 'remove',
      preconditionDigest: preconditionDigest(cwd, dryRun.actions),
      effects,
      requiresConfirmation: mode !== 'upgrade',
      verification: [{ description: 'Re-run safeword status' }],
    }),
  };
}

export async function applyReconciliation(
  cwd: string,
  mode: Exclude<PlanMode, 'upgrade'>,
): Promise<ReconcileResult> {
  return reconcile(SAFEWORD_SCHEMA, mode, createProjectContext(cwd));
}
