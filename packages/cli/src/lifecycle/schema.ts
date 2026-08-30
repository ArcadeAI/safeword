import { existsSync } from 'node:fs';
import nodePath from 'node:path';

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
  return path === '.claude' || path.startsWith('.claude/');
}

function withSelectedOwnedPaths(schema: SafewordSchema): SafewordSchema {
  const path = '.safeword/hooks/lib/owned-paths.ts';
  if (schema.ownedFiles[path] === undefined) return schema;
  // Hooks must recognize every Safeword-owned project path, including a
  // previously selected Cursor delivery that the current plan is removing.
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

function installedCursorActive(cwd: string): boolean {
  const cursorSchema = schemaForProjectSurfaces(SAFEWORD_SCHEMA, ['cursor']);
  return [...Object.keys(cursorSchema.ownedFiles), ...Object.keys(cursorSchema.jsonMerges)].some(
    path => path.startsWith('.cursor/') && existsSync(nodePath.join(cwd, path)),
  );
}

export function projectLifecycleSchema(
  cwd: string,
  agents: readonly string[],
  operation: 'check' | 'install' | 'uninstall' = 'check',
): SafewordSchema {
  const claudeDeliverySchema = schemaForClaudeDelivery(cwd);
  const selected = new Set(agents);
  const legacyClaudeInstalled = hasLegacyClaudeDelivery(claudeDeliverySchema);
  const legacyClaudeActive = selected.has('claude') && legacyClaudeInstalled;
  const openCodeSchema = selectedDeliverySchema(claudeDeliverySchema, selected);
  const deliverySchema = schemaForCodexDelivery(cwd, openCodeSchema);
  const surfaceSchema = schemaForProjectSurfaces(deliverySchema, selectedProjectSurfaces(selected));
  // Native Codex, Claude, and OpenCode distributions own their executable
  // workflow assets. Cursor is the only selected host whose declared authority
  // remains project-delivered; an observed legacy Claude install keeps its
  // runtime until the migration proves replacement.
  const remainingHostNeedsRuntime =
    operation === 'uninstall' &&
    ((!selected.has('claude') && legacyClaudeInstalled) ||
      (!selected.has('cursor') && installedCursorActive(cwd)));
  return withSelectedOwnedPaths(
    schemaForSharedAgentRuntime(
      surfaceSchema,
      !remainingHostNeedsRuntime && sharedRuntimeNeeded(selected, legacyClaudeActive),
    ),
  );
}
