import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { schemaForCodexDelivery } from '../codex-plugin/delivery-schema.js';
import { generateOwnedPathsModule, resolvedNamespaceDirectory } from '../owned-paths.js';
import {
  filterSchemaPaths,
  SAFEWORD_SCHEMA,
  type SafewordSchema,
  schemaForProjectSurfaces,
  schemaForSharedAgentRuntime,
} from '../schema.js';

function isLegacyClaudePath(path: string): boolean {
  return path.startsWith('.claude/');
}

function withSelectedOwnedPaths(schema: SafewordSchema): SafewordSchema {
  const path = '.safeword/hooks/lib/owned-paths.ts';
  if (schema.ownedFiles[path] === undefined) return schema;
  const ownershipSchema = schemaForProjectSurfaces(SAFEWORD_SCHEMA, ['core', 'cursor']);
  return {
    ...schema,
    ownedFiles: {
      ...schema.ownedFiles,
      [path]: {
        generator: ctx =>
          generateOwnedPathsModule(ownershipSchema, resolvedNamespaceDirectory(ctx)),
      },
    },
  };
}

function hasLegacyClaudeDelivery(schema: SafewordSchema): boolean {
  return [...Object.keys(schema.ownedFiles), ...Object.keys(schema.jsonMerges)].some(path =>
    isLegacyClaudePath(path),
  );
}

function selectedDeliverySchema(
  schema: SafewordSchema,
  selected: ReadonlySet<string>,
): SafewordSchema {
  return selected.has('claude')
    ? schema
    : filterSchemaPaths(schema, path => !isLegacyClaudePath(path));
}

function selectedProjectSurfaces(selected: ReadonlySet<string>): ('core' | 'cursor')[] {
  return ['core', ...(selected.has('cursor') ? (['cursor'] as const) : [])];
}

function sharedRuntimeNeeded(selected: ReadonlySet<string>, legacyClaudeActive: boolean): boolean {
  return selected.has('cursor') || legacyClaudeActive;
}

export function projectLifecycleSchema(
  cwd: string,
  agents: readonly string[],
  _operation: 'check' | 'install' | 'uninstall' = 'check',
): SafewordSchema {
  const claudeDeliverySchema = schemaForClaudeDelivery(cwd);
  const selected = new Set(agents);
  const legacyClaudeActive =
    selected.has('claude') && hasLegacyClaudeDelivery(claudeDeliverySchema);
  const openCodeSchema = selectedDeliverySchema(claudeDeliverySchema, selected);
  const deliverySchema = schemaForCodexDelivery(cwd, openCodeSchema);
  const surfaceSchema = schemaForProjectSurfaces(deliverySchema, selectedProjectSurfaces(selected));
  // Native Codex, Claude, and OpenCode distributions own their executable
  // workflow assets. Cursor is the only selected host whose declared authority
  // remains project-delivered; an observed legacy Claude install keeps its
  // runtime until the migration proves replacement.
  return withSelectedOwnedPaths(
    schemaForSharedAgentRuntime(surfaceSchema, sharedRuntimeNeeded(selected, legacyClaudeActive)),
  );
}
