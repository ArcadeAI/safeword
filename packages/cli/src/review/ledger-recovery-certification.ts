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

export const LEDGER_RECOVERY_REVIEW_RUBRIC = `Review only the installed 5F5ZZA recovery profile ${ledgerRecoveryProfileIdentity()}.
Targets must include the same recovery manifest, recomputed evidence summary and installed recovery contract. Context is a bounded slice of the observation's resolved execution inputs. Inspect the actual cases using this slice, and identify those exact active case digests in recovery_certification.cases. Do not claim cases you have not assessed or treat file coverage as behavior coverage.
Confirm all six obligations only when supported: actor_boundary_fidelity (actual contributor/host boundaries), real_rejection_controls (actual rejection assertions retain their causes), source_fidelity (frozen product and resolved execution inputs match the observed candidate), no_historical_red_claim (current passing proof never claims historical RED), sole_exact_erratum (only REFACTOR 15a7c84aa under “A declared change invalidates exactly its dependent reviews” receives the reviewed virtual correction), exact_unverified_deferrals (exactly 33 named cases remain deferred and unverified).
An ordinary quality review, passing summary, same-agent receipt or stale provenance cannot grant certification. Do not invent findings to populate confirmations: findings report actual issues only. Return request_changes for unsupported certification, with its actual reason. This contract excludes OpenCode and cloud recovery and grants no merge, promotion or release authority.`;
