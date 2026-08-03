import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA, type SafewordSchema } from '../schema.js';

function withoutLegacyClaude<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([path]) => !path.startsWith('.claude/')),
  );
}

/** Select the project schema for native versus retained legacy Claude delivery. */
export function schemaForClaudeDelivery(cwd: string): SafewordSchema {
  const pluginMarker = nodePath.join(cwd, '.safeword/claude-plugin/plugin-mode-v1.json');
  const legacySettings = nodePath.join(cwd, '.claude/settings.json');
  const hasLegacySettings =
    existsSync(legacySettings) && readFileSync(legacySettings, 'utf8').includes('.safeword/hooks/');
  const hasLegacyAsset = [
    ...Object.keys(SAFEWORD_SCHEMA.ownedFiles),
    ...Object.keys(SAFEWORD_SCHEMA.managedFiles),
  ].some(
    path =>
      path.startsWith('.claude/') &&
      path !== '.claude/settings.json' &&
      existsSync(nodePath.join(cwd, path)),
  );
  if (!existsSync(pluginMarker) && (hasLegacySettings || hasLegacyAsset)) return SAFEWORD_SCHEMA;
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
