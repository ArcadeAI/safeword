import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { type Action, reconcile, type ReconcileResult } from '../reconcile.js';
import { SAFEWORD_SCHEMA, type SafewordSchema } from '../schema.js';
import { createProjectContext } from '../utils/context.js';
import { type CliPlan, createPlan } from './plan.js';
import type { Effects } from './result.js';

type PlanMode = 'upgrade' | 'uninstall' | 'uninstall-full';
type ReadFileForDigest = (path: string) => Buffer;

const readFileForDigest: ReadFileForDigest = path => readFileSync(path);

function actionTargets(action: Action): string[] {
  return action.type === 'chmod' ? action.paths : [action.path];
}

function filesystemFailureToken(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : `error:${code ?? 'unknown'}`;
}

function hashPath(
  hash: ReturnType<typeof createHash>,
  absolutePath: string,
  readFile: ReadFileForDigest,
): void {
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
        hashPath(hash, nodePath.join(absolutePath, name), readFile);
      }
    } else if (stat.isFile()) {
      // Exact bytes intentionally bind plan consent more strongly than
      // size/mtime metadata, which can be preserved across content changes.
      hash.update(readFile(absolutePath));
    }
  } catch (error) {
    hash.update(filesystemFailureToken(error));
  }
}

export function preconditionDigest(
  cwd: string,
  actions: readonly Action[],
  readFile: ReadFileForDigest = readFileForDigest,
): string {
  const hash = createHash('sha256');
  const targets = [...new Set(actions.flatMap(action => actionTargets(action)))].toSorted(
    (left, right) => left.localeCompare(right),
  );
  for (const target of targets) {
    hash.update(target);
    hashPath(hash, nodePath.join(cwd, target), readFile);
  }
  return hash.digest('hex');
}

export function effectsForReconciliation(result: ReconcileResult, mode: PlanMode): Effects {
  const created = result.created.map(target => ({ kind: 'create', target }));
  const updated = result.updated.map(target => ({ kind: 'update', target }));
  const removed = result.removed.map(target => ({ kind: 'remove', target }));
  const packageNames = mode === 'upgrade' ? result.packagesToInstall : result.packagesToRemove;
  const plannedPackageNames = result.applied ? [] : packageNames;
  const packageEffects = plannedPackageNames.map(target => ({
    kind: mode === 'upgrade' ? 'install' : 'remove',
    target,
  }));
  return {
    files: [...created, ...updated],
    packages: packageEffects,
    configuration: [],
    network:
      mode === 'upgrade'
        ? plannedPackageNames.map(target => ({
            kind: 'package-registry',
            target,
            operation: 'install',
          }))
        : [],
    destructive: removed,
  };
}

export interface ReconciliationPlan {
  readonly plan: CliPlan;
  readonly dryRun: ReconcileResult;
}

export async function createReconciliationPlan(
  cwd: string,
  mode: PlanMode,
  schema: SafewordSchema = SAFEWORD_SCHEMA,
): Promise<ReconciliationPlan> {
  const context = createProjectContext(cwd);
  const dryRun = await reconcile(schema, mode, context, { dryRun: true });
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
