import { createHash } from 'node:crypto';

import cases from './ledger-recovery-cases.json' with { type: 'json' };

/** Reviewed 5F5ZZA history, after its ordinary cross-scenario prerequisite. */
export const LEDGER_RECOVERY_PROFILE = {
  ticket: '5F5ZZA',
  baseline: 'b722f9a27a1815abcfb08e6f6ca09dc7317efa46',
  ledger: '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md',
  ledgerSha256: '975589886672e20bbc74d3a472aefc896741f9e20d6817434cc98b7a339f069e',
  feature: 'features/keep-plan-reviews-current-and-trustworthy.feature',
  featureSha256: '9c2d14f1442c8acf483cf6e7e08533812826258ec24faf4f1516dfa1309f86ac',
  authoritySha256: '9eb05409f76bc20632f7aba249c2d6c3a41072b8bb877f18b4eac64039ebab28',
} as const;

export const LEDGER_RECOVERY_AUTHORITY_FIELDS = [
  'id',
  'parent',
  'parent_job',
  'milestone',
  'scope',
  'out_of_scope',
  'done_when',
] as const;

export function ledgerRecoveryProfileIdentity(): string {
  return createHash('sha256')
    .update(JSON.stringify({ profile: LEDGER_RECOVERY_PROFILE, cases }))
    .digest('hex');
}
