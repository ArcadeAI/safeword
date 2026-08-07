/* eslint-disable unicorn/no-null -- null is the versioned absent-file image */

import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliPlan, createPlan, toWirePlan } from '../cli-protocol/plan.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { filterOutSafewordHooks } from '../utils/hooks.js';
import { CLAUDE_MIGRATION_SCHEMA } from './inventory.js';
import { canonicalClaudeProjectRoot } from './profile.js';
import { observeClaudeStatus } from './status.js';

interface CleanupEntry {
  readonly path: string;
  readonly before_sha256: string;
  readonly before_base64: string;
  readonly before_mode: number;
  readonly after_sha256: string | null;
  readonly after_base64: string | null;
  readonly after_mode: number | null;
}

interface CleanupTransaction {
  readonly schema_version: 1;
  readonly transaction_id: string;
  readonly disposition: 'complete-forward' | 'restore-backup';
  readonly entries: CleanupEntry[];
}

function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function containedPath(cwd: string, relative: string): string {
  if (relative === '' || nodePath.isAbsolute(relative) || relative.split(/[\\/]/u).includes('..')) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  const root = nodePath.resolve(cwd);
  const target = nodePath.resolve(root, relative);
  if (!target.startsWith(`${root}${nodePath.sep}`)) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  return target;
}

function assertSafeTarget(cwd: string, relative: string): string {
  const target = containedPath(cwd, relative);
  let cursor = nodePath.resolve(cwd);
  for (const segment of relative.split(/[\\/]/u)) {
    cursor = nodePath.join(cursor, segment);
    if (!existsSync(cursor)) continue;
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink())
      throw new Error(`Unsafe symlinked Claude cleanup target: ${relative}`);
    if (cursor === target ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`Unsafe non-file Claude cleanup target: ${relative}`);
    }
  }
  return target;
}

function statusClassification(result: CliResult): string | undefined {
  return (result.data as { classification?: string } | undefined)?.classification;
}

function recognizedPaths(status: CliResult): string[] {
  return (
    (status.data as { legacy?: { recognized?: string[] } } | undefined)?.legacy?.recognized ?? []
  );
}

function settingsMutation(cwd: string): { path: string; content: string | null } | undefined {
  const relative = '.claude/settings.json';
  const path = nodePath.join(cwd, relative);
  if (!existsSync(path)) return undefined;
  const existing = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const hooks = (existing.hooks as Record<string, unknown[]> | undefined) ?? {};
  const cleaned: Record<string, unknown[]> = {};
  let removed = false;
  for (const [event, entries] of Object.entries(hooks)) {
    const retained = filterOutSafewordHooks(entries);
    if (retained.length !== entries.length) removed = true;
    if (retained.length > 0) cleaned[event] = retained;
  }
  if (!removed) return undefined;
  const output = { ...existing };
  if (Object.keys(cleaned).length === 0) delete output.hooks;
  else output.hooks = cleaned;
  return {
    path: relative,
    content: Object.keys(output).length === 0 ? null : `${JSON.stringify(output, undefined, 2)}\n`,
  };
}

function cleanupMutations(
  cwd: string,
  status: CliResult,
): { path: string; content: string | null }[] {
  const files: { path: string; content: string | null }[] = recognizedPaths(status).map(path => ({
    path,
    content: null,
  }));
  const settings = settingsMutation(cwd);
  if (settings !== undefined) files.push(settings);
  return files;
}

function preconditionDigest(
  cwd: string,
  mutations: readonly { path: string; content: string | null }[],
): string {
  return sha256(
    JSON.stringify(
      mutations.map(mutation => {
        const target = assertSafeTarget(cwd, mutation.path);
        return [mutation.path, sha256(readFileSync(target)), mutation.content];
      }),
    ),
  );
}

function observeClaudeCleanupPlan(cwd: string): { plan: CliPlan; status: CliResult } {
  const projectRoot = canonicalClaudeProjectRoot(cwd);
  const status = observeClaudeStatus(projectRoot);
  const classification = statusClassification(status);
  const mutations = classification === 'cleanup-ready' ? cleanupMutations(projectRoot, status) : [];
  const digest = preconditionDigest(projectRoot, mutations);
  return {
    status,
    plan: createPlan({
      command: 'claude cleanup',
      preconditionDigest: digest,
      effects: {
        files: mutations.map(mutation => ({
          kind: mutation.content === null ? 'delete' : 'update',
          target: mutation.path,
        })),
        destructive: mutations.map(mutation => ({ kind: 'contract', target: mutation.path })),
      },
      requiresConfirmation: mutations.length > 0,
      verification: [
        {
          description: 'Verify exact current Claude plugin proof.',
          command: 'safeword claude status',
        },
      ],
    }),
  };
}

function transactionPath(cwd: string): string {
  return containedPath(cwd, CLAUDE_MIGRATION_SCHEMA.paths.transaction);
}

function writeTransaction(cwd: string, transaction: CleanupTransaction): void {
  const path = transactionPath(cwd);
  mkdirSync(nodePath.dirname(path), { recursive: true, mode: 0o700 });
  writeDurableFile(path, `${JSON.stringify(transaction, undefined, 2)}\n`, { mode: 0o600 });
}

function entryFor(cwd: string, mutation: { path: string; content: string | null }): CleanupEntry {
  const path = assertSafeTarget(cwd, mutation.path);
  const before = readFileSync(path);
  const after = mutation.content === null ? null : Buffer.from(mutation.content);
  return {
    path: mutation.path,
    before_sha256: sha256(before),
    before_base64: before.toString('base64'),
    before_mode: lstatSync(path).mode & 0o777,
    after_sha256: after === null ? null : sha256(after),
    after_base64: after === null ? null : after.toString('base64'),
    after_mode: after === null ? null : lstatSync(path).mode & 0o777,
  };
}

function observedSha(path: string): string | null {
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

function writeImage(path: string, content: string | null, mode: number | null): void {
  if (content === null) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeDurableFile(path, Buffer.from(content, 'base64'), { mode: mode ?? 0o644 });
  chmodSync(path, mode ?? 0o644);
}

function applyEntries(cwd: string, entries: readonly CleanupEntry[]): void {
  for (const entry of entries) {
    const path = assertSafeTarget(cwd, entry.path);
    if (observedSha(path) !== entry.before_sha256) {
      throw new Error(`Claude cleanup target changed after planning: ${entry.path}`);
    }
    writeImage(path, entry.after_base64, entry.after_mode);
  }
}

function cleanupFailure(error: unknown, classification = 'coexistence'): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
    nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
    data: { command: 'claude cleanup', classification },
  });
}

export function cleanupClaudeLegacy(
  cwd: string,
  options: { assumeYes: boolean; plan?: string },
): CliResult {
  try {
    const projectRoot = canonicalClaudeProjectRoot(cwd);
    const observed = observeClaudeCleanupPlan(projectRoot);
    const classification = statusClassification(observed.status);
    if (classification !== 'cleanup-ready') return observed.status;
    if (!options.assumeYes || options.plan !== observed.plan.id) {
      return createResult({
        state: 'action_required',
        findings: [
          {
            code: 'CLAUDE_CLEANUP_CONFIRMATION_REQUIRED',
            message: 'Review and confirm the exact Claude cleanup plan.',
            severity: 'warning',
          },
        ],
        nextActions: [
          {
            command: `safeword claude cleanup --yes --plan ${observed.plan.id}`,
            mutates: true,
            requiresHuman: true,
          },
        ],
        data: { command: 'claude cleanup', classification, plan: toWirePlan(observed.plan) },
      });
    }
    const mutations = cleanupMutations(projectRoot, observed.status);
    const transaction: CleanupTransaction = {
      schema_version: 1,
      transaction_id: randomUUID(),
      disposition: 'complete-forward',
      entries: mutations.map(mutation => entryFor(projectRoot, mutation)),
    };
    writeTransaction(projectRoot, transaction);
    applyEntries(projectRoot, transaction.entries);
    const marker = containedPath(projectRoot, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker);
    mkdirSync(nodePath.dirname(marker), { recursive: true });
    writeDurableFile(
      marker,
      `${JSON.stringify({ schema_version: 1, mode: 'plugin', transaction_id: transaction.transaction_id })}\n`,
      { mode: 0o600 },
    );
    rmSync(transactionPath(projectRoot), { force: true });
    return createResult({
      state: 'changed',
      effects: {
        files: mutations.map(mutation => ({
          kind: mutation.content === null ? 'delete' : 'update',
          target: mutation.path,
        })),
      },
      data: { command: 'claude cleanup', classification: 'plugin-mode' },
    });
  } catch (error) {
    return cleanupFailure(error);
  }
}

function parseTransaction(cwd: string): CleanupTransaction {
  const value = JSON.parse(readFileSync(transactionPath(cwd), 'utf8')) as CleanupTransaction;
  if (value.schema_version !== 1 || !Array.isArray(value.entries))
    throw new Error('Claude cleanup transaction is malformed.');
  return value;
}

export function recoverClaudeCleanup(cwd: string): CliResult {
  let projectRoot: string;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return cleanupFailure(error, 'recovery-required');
  }
  if (!existsSync(transactionPath(projectRoot))) {
    return createResult({
      state: 'healthy',
      data: { command: 'claude recover', classification: 'plugin-mode' },
    });
  }
  try {
    const transaction = parseTransaction(projectRoot);
    for (const entry of transaction.entries) {
      const path = assertSafeTarget(projectRoot, entry.path);
      const current = observedSha(path);
      const expectedCurrent =
        transaction.disposition === 'complete-forward' ? entry.before_sha256 : entry.after_sha256;
      if (current !== expectedCurrent) throw new Error(`Claude recovery conflict at ${entry.path}`);
    }
    for (const entry of transaction.entries) {
      const path = containedPath(projectRoot, entry.path);
      if (transaction.disposition === 'complete-forward')
        writeImage(path, entry.after_base64, entry.after_mode);
      else writeImage(path, entry.before_base64, entry.before_mode);
    }
    rmSync(transactionPath(projectRoot), { force: true });
    return createResult({
      state: 'changed',
      data: {
        command: 'claude recover',
        classification:
          transaction.disposition === 'complete-forward' ? 'plugin-mode' : 'cleanup-ready',
      },
    });
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [{ code: 'CLAUDE_RECOVERY_CONFLICT', message: String(error), retryable: true }],
      nextActions: [
        { command: 'resolve the reported recovery conflict', mutates: false, requiresHuman: true },
      ],
      data: { command: 'claude recover', classification: 'recovery-required' },
    });
  }
}
