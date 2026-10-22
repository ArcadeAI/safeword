import nodePath from 'node:path';

import { createResult, renderJsonResult } from '../src/cli-protocol/result.js';
import { findCompetingHostContractOwners } from '../src/host-contract/source-ownership.js';

const root = nodePath.resolve(import.meta.dirname, '../../..');
try {
  const findings = findCompetingHostContractOwners(root);
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
