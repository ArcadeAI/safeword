import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { schemaForCodexDelivery } from '../codex-plugin/delivery-schema.js';
import {
  type SafewordSchema,
  schemaForProjectSurfaces,
  schemaForSharedAgentRuntime,
} from '../schema.js';

export function projectLifecycleSchema(cwd: string, agents: readonly string[]): SafewordSchema {
  const deliverySchema = schemaForCodexDelivery(cwd, schemaForClaudeDelivery(cwd));
  const surfaceSchema = schemaForProjectSurfaces(deliverySchema, [
    'core',
    ...(agents.includes('cursor') ? (['cursor'] as const) : []),
  ]);
  // schemaForClaudeDelivery only strips `.claude/*` once Claude is confirmed
  // native or absent — a still-present `.claude/*` entry here means legacy
  // Claude delivery is active and its templates still reference
  // .safeword/skills|hooks directly, so this project needs them too.
  const legacyClaudeActive = Object.keys(deliverySchema.ownedFiles).some(path =>
    path.startsWith('.claude/'),
  );
  // No agent selected at all (`--agents none`) carries no evidence that the
  // shared runtime is unused — only a project selecting Claude, and nothing
  // else, that's also confirmed native knows for certain nothing reads it.
  return schemaForSharedAgentRuntime(
    surfaceSchema,
    agents.length === 0 ||
      agents.includes('codex') ||
      agents.includes('cursor') ||
      legacyClaudeActive,
  );
}
