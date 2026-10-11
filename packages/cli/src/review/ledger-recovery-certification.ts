import cases from './ledger-recovery-cases.json' with { type: 'json' };
import { ledgerRecoveryProfileIdentity } from './ledger-recovery-profile.js';

export const RECOVERY_CONFIRMATIONS = [
  'actor_boundary_fidelity',
  'real_rejection_controls',
  'source_fidelity',
  'no_historical_red_claim',
  'sole_exact_erratum',
  'exact_unverified_deferrals',
] as const;

export interface LedgerRecoveryCertification {
  readonly profile: string;
  readonly cases: readonly string[];
  readonly confirmations: Readonly<Record<(typeof RECOVERY_CONFIRMATIONS)[number], boolean>>;
}

const activeCases = cases.filter(item => !item.deferred).map(item => item.digest);

export const RECOVERY_CERTIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    profile: { type: 'string', enum: [ledgerRecoveryProfileIdentity()] },
    cases: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', enum: activeCases },
    },
    confirmations: {
      type: 'object',
      properties: Object.fromEntries(
        RECOVERY_CONFIRMATIONS.map(name => [name, { type: 'boolean' }]),
      ),
      required: RECOVERY_CONFIRMATIONS,
      additionalProperties: false,
    },
  },
  required: ['profile', 'cases', 'confirmations'],
  additionalProperties: false,
} as const;

export function validRecoveryCertification(
  value: unknown,
  approval: boolean,
): value is LedgerRecoveryCertification {
  if (
    !record(value) ||
    Object.keys(value).length !== 3 ||
    value.profile !== ledgerRecoveryProfileIdentity()
  )
    return false;
  if (
    !Array.isArray(value.cases) ||
    value.cases.length === 0 ||
    new Set(value.cases).size !== value.cases.length
  )
    return false;
  if (value.cases.some(digest => !(typeof digest === 'string' && activeCases.includes(digest))))
    return false;
  const confirmations = value.confirmations;
  return (
    record(confirmations) &&
    Object.keys(confirmations).length === RECOVERY_CONFIRMATIONS.length &&
    RECOVERY_CONFIRMATIONS.every(
      name => typeof confirmations[name] === 'boolean' && (!approval || confirmations[name]),
    )
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
