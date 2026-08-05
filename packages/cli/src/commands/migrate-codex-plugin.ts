/**
 * Compatibility facade for callers that import the historical command module.
 * Shared setup and bootstrap flows use the Codex operations module directly so
 * command entry points never depend on one another.
 */
export {
  automaticallyMigrateLegacyCodex,
  installCodexPlugin,
  migrateCodexPlugin,
  observeCodexFinalizationEffects,
  observeCodexFinalizationPlan,
  observeCodexMigration,
  observeCodexMigrationResult,
  type ObservedCodexFinalizationPlan,
  recoverCodexMigration,
  removeLegacyCodexHooks,
} from '../codex-plugin/operations.js';
