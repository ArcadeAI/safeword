import nodePath from 'node:path';

import { hostContractFeature } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');

export default {
  paths: [hostContractFeature],
  tags: '@consistent-host-contract.TBU2.R2',
  import: [
    nodePath.join(repoRoot, 'steps/world.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-lifecycle.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-cleanup.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-mixed-upgrade.steps.ts'),
  ],
};
