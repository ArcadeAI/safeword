import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type {
  PlanningAuthorCopyIdentity,
  PlanningPhase,
} from '../../src/planning/phase-contract.js';
import { PLANNING_CONTRACT_TEMPLATE_PATHS } from '../../src/schema.js';

/** Hash the actual producer's complete assets, after any host-specific formatting. */
export function planningAuthorCopies(
  root: string,
  layout: 'templates' | 'claude' | 'codex',
): Readonly<Record<PlanningPhase, PlanningAuthorCopyIdentity>> {
  const paths = {
    'product-plan': PLANNING_CONTRACT_TEMPLATE_PATHS.product,
    'plan-implementation': PLANNING_CONTRACT_TEMPLATE_PATHS.implementation,
    'plan-execution': PLANNING_CONTRACT_TEMPLATE_PATHS.execution,
  } as const;
  return Object.fromEntries(
    Object.entries(paths).map(([phase, template]) => {
      const relativePath = {
        templates: nodePath.join('templates', template),
        claude: template,
        codex: nodePath.join(nodePath.dirname(template), 'references', nodePath.basename(template)),
      }[layout];
      return [
        phase,
        {
          relativePath,
          sha256: createHash('sha256')
            .update(readFileSync(nodePath.join(root, relativePath)))
            .digest('hex'),
        },
      ];
    }),
  ) as Record<PlanningPhase, PlanningAuthorCopyIdentity>;
}
