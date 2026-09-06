import { SAFEWORD_SCHEMA, type SafewordSchema } from '../schema.js';
import { legacyObservationIsEmpty, observeClaudeLegacy } from './legacy-classifier.js';
import { hasLegacyClaudePluginMode, readClaudePluginMode } from './migration-state.js';

function withoutLegacyClaude<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) => !path.startsWith('.claude/')),
  );
}

/** Select the project schema for native versus retained legacy Claude delivery. */
export function schemaForClaudeDelivery(cwd: string): SafewordSchema {
  const legacyPluginMode = hasLegacyClaudePluginMode(cwd);
  const nativePluginMode = readClaudePluginMode(cwd) !== undefined;
  if (
    !legacyPluginMode &&
    !nativePluginMode &&
    !legacyObservationIsEmpty(observeClaudeLegacy(cwd))
  ) {
    return SAFEWORD_SCHEMA;
  }
  return {
    ...SAFEWORD_SCHEMA,
    ownedDirs: SAFEWORD_SCHEMA.ownedDirs.filter(path => !path.startsWith('.claude')),
    sharedDirs: SAFEWORD_SCHEMA.sharedDirs.filter(path => !path.startsWith('.claude')),
    deprecatedFiles: SAFEWORD_SCHEMA.deprecatedFiles.filter(path => !path.startsWith('.claude/')),
    deprecatedDirs: SAFEWORD_SCHEMA.deprecatedDirs.filter(path => !path.startsWith('.claude')),
    ownedFiles: withoutLegacyClaude(SAFEWORD_SCHEMA.ownedFiles),
    managedFiles: withoutLegacyClaude(SAFEWORD_SCHEMA.managedFiles),
    jsonMerges: withoutLegacyClaude(SAFEWORD_SCHEMA.jsonMerges),
  };
}
