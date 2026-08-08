import type { SafewordSchema } from '../schema.js';
import { codexFinalizationIsComplete } from './finalization.js';

function withoutFinalizedCodexEntries<T>(
  values: Readonly<Record<string, T>>,
  retiredPaths: ReadonlySet<string>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(values).filter(([path]) => !retiredPaths.has(path)));
}

/** Keep explicit Codex finalization stable across later project reconciliation. */
export function schemaForCodexDelivery(cwd: string, schema: SafewordSchema): SafewordSchema {
  if (!codexFinalizationIsComplete(cwd)) return schema;
  const retiredPaths = new Set(schema.codexMigration.cleanupFiles);
  return {
    ...schema,
    deprecatedFiles: schema.deprecatedFiles.filter(path => !retiredPaths.has(path)),
    ownedFiles: withoutFinalizedCodexEntries(schema.ownedFiles, retiredPaths),
    managedFiles: withoutFinalizedCodexEntries(schema.managedFiles, retiredPaths),
    jsonMerges: withoutFinalizedCodexEntries(schema.jsonMerges, retiredPaths),
    textPatches: withoutFinalizedCodexEntries(schema.textPatches, retiredPaths),
    legacyTextPatches: withoutFinalizedCodexEntries(schema.legacyTextPatches, retiredPaths),
    contracts: withoutFinalizedCodexEntries(schema.contracts, retiredPaths),
  };
}
