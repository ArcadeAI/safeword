import { schemaForClaudeDelivery } from '../claude-plugin/delivery-schema.js';
import { schemaForCodexDelivery } from '../codex-plugin/delivery-schema.js';
import { type SafewordSchema, schemaForProjectSurfaces } from '../schema.js';

export function projectLifecycleSchema(cwd: string, agents: readonly string[]): SafewordSchema {
  const deliverySchema = schemaForCodexDelivery(cwd, schemaForClaudeDelivery(cwd));
  return schemaForProjectSurfaces(deliverySchema, [
    'core',
    ...(agents.includes('cursor') ? (['cursor'] as const) : []),
  ]);
}
