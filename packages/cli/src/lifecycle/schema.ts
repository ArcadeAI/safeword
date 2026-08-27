import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { schemaForCodexDelivery } from '../codex-plugin/delivery-schema.js';
import { generateOwnedPathsModule, resolvedNamespaceDirectory } from '../owned-paths.js';
import {
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

export function projectLifecycleSchema(cwd: string, agents: readonly string[]): SafewordSchema {
  const claudeDeliverySchema = schemaForClaudeDelivery(cwd);
  const legacyClaudeActive =
    Object.keys(claudeDeliverySchema.ownedFiles).some(path => isLegacyClaudePath(path)) ||
    Object.keys(claudeDeliverySchema.jsonMerges).some(path => isLegacyClaudePath(path));
  const deliverySchema = schemaForCodexDelivery(
    cwd,
    agents.includes('opencode')
      ? withOpenCodeSkillDelivery(claudeDeliverySchema)
      : claudeDeliverySchema,
  );
  const surfaceSchema = schemaForProjectSurfaces(deliverySchema, [
    'core',
    ...(agents.includes('cursor') ? (['cursor'] as const) : []),
    ...(agents.includes('opencode') ? (['opencode'] as const) : []),
  ]);
  // OpenCode commands load the canonical skills delivered through `.claude/skills`,
  // whose bodies reference the shared `.safeword` runtime. Legacy Claude delivery
  // needs the same runtime independently of OpenCode's injected skill catalogue.
  // No agent selected at all (`--agents none`) carries no evidence that the
  // shared runtime is unused — only a project selecting Claude, and nothing
  // else, that's also confirmed native knows for certain nothing reads it.
  return withSelectedOwnedPaths(
    schemaForSharedAgentRuntime(
      surfaceSchema,
      agents.length === 0 ||
        agents.includes('codex') ||
        agents.includes('cursor') ||
        agents.includes('opencode') ||
        legacyClaudeActive,
    ),
    agents.includes('opencode'),
  );
}
