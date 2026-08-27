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

function withOpenCodeSkillDelivery(schema: SafewordSchema): SafewordSchema {
  const skills = Object.fromEntries(
    Object.entries(SAFEWORD_SCHEMA.ownedFiles).filter(([path]) =>
      path.startsWith('.claude/skills/'),
    ),
  );
  return {
    ...schema,
    sharedDirs: [...new Set([...schema.sharedDirs, '.claude', '.claude/skills'])],
    ownedFiles: { ...schema.ownedFiles, ...skills },
  };
}

function withSelectedOwnedPaths(schema: SafewordSchema, includeOpenCode: boolean): SafewordSchema {
  const path = '.safeword/hooks/lib/owned-paths.ts';
  if (schema.ownedFiles[path] === undefined) return schema;
  const ownershipSchema = includeOpenCode
    ? SAFEWORD_SCHEMA
    : schemaForProjectSurfaces(SAFEWORD_SCHEMA, ['core', 'cursor']);
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
  preserveLegacySkills: boolean,
): SafewordSchema {
  const openCodeWithoutClaude = selected.has('opencode') && !selected.has('claude');
  const claude = openCodeWithoutClaude
    ? filterSchemaPaths(schema, path => !isLegacyClaudePath(path))
    : schema;
  return selected.has('opencode') && !preserveLegacySkills
    ? withOpenCodeSkillDelivery(claude)
    : claude;
}

function selectedProjectSurfaces(
  selected: ReadonlySet<string>,
): ('core' | 'cursor' | 'opencode')[] {
  return [
    'core',
    ...(selected.has('cursor') ? (['cursor'] as const) : []),
    ...(selected.has('opencode') ? (['opencode'] as const) : []),
  ];
}

function sharedRuntimeNeeded(selected: ReadonlySet<string>, legacyClaudeActive: boolean): boolean {
  return (
    selected.size === 0 ||
    ['codex', 'cursor', 'opencode'].some(agent => selected.has(agent)) ||
    legacyClaudeActive
  );
}

export function projectLifecycleSchema(
  cwd: string,
  agents: readonly string[],
  operation: 'check' | 'install' | 'uninstall' = 'check',
): SafewordSchema {
  const claudeDeliverySchema = schemaForClaudeDelivery(cwd);
  const selected = new Set(agents);
  const legacyClaudeActive = hasLegacyClaudeDelivery(claudeDeliverySchema);
  const preserveLegacySkills = operation === 'uninstall' && legacyClaudeActive;
  const openCodeSchema = selectedDeliverySchema(
    claudeDeliverySchema,
    selected,
    preserveLegacySkills,
  );
  const deliverySchema = schemaForCodexDelivery(cwd, openCodeSchema);
  const surfaceSchema = schemaForProjectSurfaces(deliverySchema, selectedProjectSurfaces(selected));
  // OpenCode commands load the canonical skills delivered through `.claude/skills`,
  // whose bodies reference the shared `.safeword` runtime. Legacy Claude delivery
  // needs the same runtime independently of OpenCode's injected skill catalogue.
  // No agent selected at all (`--agents none`) carries no evidence that the
  // shared runtime is unused — only a project selecting Claude, and nothing
  // else, that's also confirmed native knows for certain nothing reads it.
  return withSelectedOwnedPaths(
    schemaForSharedAgentRuntime(surfaceSchema, sharedRuntimeNeeded(selected, legacyClaudeActive)),
    selected.has('opencode'),
  );
}
