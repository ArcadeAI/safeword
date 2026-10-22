import nodePath from 'node:path';

import { createResult, renderJsonResult } from '../src/cli-protocol/result.js';
import { findCompetingHostContractOwners } from '../src/host-contract/source-ownership.js';
import { discoverTemplateSources } from '../src/parity.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const root = nodePath.resolve(import.meta.dirname, '../../..');
try {
  const findings = findCompetingHostContractOwners(root);
  const sourceInventory = discoverTemplateSources(
    nodePath.join(root, 'packages/cli/templates'),
    SAFEWORD_SCHEMA,
  ).map(source => ({
    path: `packages/cli/templates/${source.template}`,
    destinations: source.destinations,
  }));
  findings.push(
    ...sourceInventory
      .filter(source => source.destinations.length === 0)
      .map(source => ({
        code: 'UNACCOUNTED_HOST_CONTRACT_SOURCE',
        severity: 'error' as const,
        message: `Canonical source has no schema registration: ${source.path}`,
        metadata: { path: source.path },
      })),
  );
  const incomplete = {
    code: 'HOST_CONTRACT_INVENTORY_INCOMPLETE',
    severity: 'warning' as const,
    message:
      'Retained-owner checks are available; full source/lane inventory and committed owner capture remain incomplete.',
  };
  const result = createResult({
    state: findings.length > 0 ? 'failed' : 'action_required',
    exitCode: findings.length > 0 ? 2 : 3,
    findings: [...findings, incomplete],
    data: {
      command: 'host-contract check',
      scope: 'retained-source-owners',
      source_inventory: sourceInventory,
      inventory_complete: false,
      admission_eligible: false,
    },
  });
  process.stdout.write(`${renderJsonResult(result)}\n`);
  process.exitCode = result.exitCode;
} catch (error) {
  const result = createResult({
    state: 'failed',
    exitCode: 3,
    errors: [
      {
        code: 'HOST_CONTRACT_PROOF_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    ],
  });
  process.stdout.write(`${renderJsonResult(result)}\n`);
  process.exitCode = 3;
}
