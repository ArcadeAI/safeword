import { SAFEWORD_SCHEMA, type SafewordSchema } from '../schema.js';
import { legacyObservationIsEmpty, observeClaudeLegacy } from './legacy-classifier.js';
import { hasLegacyClaudePluginMode, readClaudePluginMode } from './migration-state.js';

function withoutLegacyClaude<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) => !path.startsWith('.claude/')),
  );
}

function without<T>(values: Record<string, T>, paths: ReadonlySet<string>): Record<string, T> {
  if (paths.size === 0) return values;
  return Object.fromEntries(Object.entries(values).filter(([path]) => !paths.has(path)));
}

/**
 * Paths the cleanup preserved as project-owned and told the user it preserved.
 *
 * Cleanup identifies content it does not recognize, leaves it alone, and
 * surfaces an advisory naming it. Install then rewrote those same files with
 * safeword's version — no prompt, no diff, no record (#3790). Recoverable only
 * because the file happened to be committed. A path cannot be both "preserved,
 * do not touch" and "owned, overwrite"; the preservation wins, because it is the
 * promise already made to the user.
 */
function preservedPaths(cwd: string): ReadonlySet<string> {
  return new Set(readClaudePluginMode(cwd)?.unresolved_paths);
}

/** Select the project schema for native versus retained legacy Claude delivery. */
export function schemaForClaudeDelivery(cwd: string): SafewordSchema {
  const legacyPluginMode = hasLegacyClaudePluginMode(cwd);
  const nativePluginMode = readClaudePluginMode(cwd) !== undefined;
  const preserved = preservedPaths(cwd);
  if (
    !legacyPluginMode &&
    !nativePluginMode &&
    !legacyObservationIsEmpty(observeClaudeLegacy(cwd))
  ) {
    return {
      ...SAFEWORD_SCHEMA,
      ownedFiles: without(SAFEWORD_SCHEMA.ownedFiles, preserved),
      managedFiles: without(SAFEWORD_SCHEMA.managedFiles, preserved),
      jsonMerges: without(SAFEWORD_SCHEMA.jsonMerges, preserved),
    };
  }
  return {
    ...SAFEWORD_SCHEMA,
    ownedDirs: SAFEWORD_SCHEMA.ownedDirs.filter(path => !path.startsWith('.claude')),
    sharedDirs: SAFEWORD_SCHEMA.sharedDirs.filter(path => !path.startsWith('.claude')),
    deprecatedFiles: SAFEWORD_SCHEMA.deprecatedFiles.filter(path => !path.startsWith('.claude/')),
    deprecatedDirs: SAFEWORD_SCHEMA.deprecatedDirs.filter(path => !path.startsWith('.claude')),
    ownedFiles: without(withoutLegacyClaude(SAFEWORD_SCHEMA.ownedFiles), preserved),
    managedFiles: without(withoutLegacyClaude(SAFEWORD_SCHEMA.managedFiles), preserved),
    jsonMerges: without(withoutLegacyClaude(SAFEWORD_SCHEMA.jsonMerges), preserved),
  };
}
