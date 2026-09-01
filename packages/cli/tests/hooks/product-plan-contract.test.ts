import { describe, expect, it } from 'vitest';

import {
  canonicalizeContractValue,
  digestParentContract,
  type ParentContractValues,
} from '../../src/utils/product-plan-contract.js';
import {
  canonicalizeParentContractValue,
  parentContractDigest,
} from '../../templates/hooks/lib/product-plan-contract.ts';

const values: ParentContractValues = {
  parentJob: 'J1',
  milestoneOutcome: '  **First** customer  is live ',
  milestoneNonGoals: '_Automated_ migration',
  projectNonGoals: '`Tracker` synchronization',
  successThreshold: 'Three\ncustomers',
};

describe('Product Plan parent contract parity', () => {
  it('canonicalizes formatting and whitespace identically in the CLI and installed hook', () => {
    for (const value of Object.values(values)) {
      expect(canonicalizeParentContractValue(value)).toBe(canonicalizeContractValue(value));
    }
  });

  it('produces a byte-identical digest in the CLI and installed hook', () => {
    expect(parentContractDigest(values)).toBe(digestParentContract(values));
  });
});
