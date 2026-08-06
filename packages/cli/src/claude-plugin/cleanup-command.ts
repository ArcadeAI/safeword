import { type CliPlan, createPlan, toWirePlan } from '../cli-protocol/plan.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import {
  claudeCleanupPreconditionDigest,
  claudeLegacyMutations,
  migrateClaudeLegacyAutomatically,
} from './cleanup.js';
import { historicalCatalogueDigest } from './historical-ownership.js';
import { currentClaudePluginHookManifestSha256 } from './hook-manifest.js';
import { canonicalClaudeProjectRoot } from './project-root.js';
import { observeClaudeStatus } from './status.js';

function statusClassification(result: CliResult): string | undefined {
  return (result.data as { classification?: string } | undefined)?.classification;
}

function observeClaudeCleanupPlan(cwd: string): { plan: CliPlan; status: CliResult } {
  const projectRoot = canonicalClaudeProjectRoot(cwd);
  const status = observeClaudeStatus(projectRoot);
  const classification = statusClassification(status);
  const mutations = classification === 'cleanup-ready' ? claudeLegacyMutations(projectRoot) : [];
  return {
    status,
    plan: createPlan({
      command: 'claude cleanup',
      preconditionDigest: claudeCleanupPreconditionDigest(projectRoot, mutations),
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
    const mutations = claudeLegacyMutations(projectRoot);
    const migrated = migrateClaudeLegacyAutomatically(projectRoot, {
      pluginVersion: SAFEWORD_SCHEMA.version,
      hookManifestSha256: currentClaudePluginHookManifestSha256(),
      catalogueSha256: historicalCatalogueDigest(),
      deadline: Number.MAX_SAFE_INTEGER,
    });
    if (migrated.state === 'attention') {
      return createResult({
        state: 'failed',
        errors: [
          {
            code: 'CLAUDE_CLEANUP_FAILED',
            message: migrated.advisory ?? 'Claude cleanup could not finish.',
            retryable: true,
          },
        ],
        nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
        data: { command: 'claude cleanup', classification: 'coexistence' },
      });
    }
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
    return createResult({
      state: 'failed',
      errors: [{ code: 'CLAUDE_CLEANUP_FAILED', message: String(error), retryable: true }],
      nextActions: [{ command: 'safeword claude recover', mutates: true, requiresHuman: true }],
      data: { command: 'claude cleanup', classification: 'coexistence' },
    });
  }
}
