import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';

export const DATA_OBLIGATION = 'Data applicability and decisions';
export const MIGRATION_COMMAND_REQUIREMENT =
  'Migration commands are execution mechanics and cannot replace data decisions';
export const DATA_OWNERSHIP_REQUIREMENTS = [
  'persisted entity owner',
  'source-of-truth authority',
  'conflicting data owner',
] as const;
export const DATA_FIELDS = [
  'Purpose',
  'Store and model',
  'Schema and relationships',
  'Source of truth',
  'Ownership and access',
  'Identity and integrity',
  'Cross-system flow',
  'Lifecycle and retention',
  'Migration and backfill',
  'Compliance',
  'Rollback',
] as const;

export function obligationClause(contract: string, obligation: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${obligation}:**`))
    ?.split('\n\n', 1)[0];
}

export function missingDataContractRequirements(clause: string | undefined): string[] {
  if (clause === undefined) return [DATA_OBLIGATION];
  const normalized = clause.slice(clause.indexOf(':**') + ':**'.length).replaceAll(/\s+/gu, ' ');
  const missing = DATA_FIELDS.filter(
    field => !normalized.toLowerCase().includes(field.toLowerCase()),
  );
  if (!normalized.includes('Data applicability:')) missing.push('Data applicability:');
  if (!normalized.includes('skip: <reason>')) missing.push('skip: <reason>');
  return missing;
}

function dataFindings(plan: string): { severity: 'error'; message: string }[] {
  const lines = plan.split('\n');
  const applicabilityPrefix = 'Data applicability:';
  const applicability = lines
    .find(line => line.startsWith(applicabilityPrefix))
    ?.slice(applicabilityPrefix.length)
    .trim();
  if (applicability?.startsWith('skip:') === true && applicability.slice('skip:'.length).trim()) {
    return [];
  }

  return DATA_FIELDS.filter(field => {
    const prefix = `${field}:`;
    const value = lines
      .find(line => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim();
    return value === undefined || value === '';
  }).map(field => ({ severity: 'error' as const, message: `Data decision missing: ${field}.` }));
}

export function reviewDataApplicability(contract: string, plan: string): ReviewerOutput {
  const contractMissing = missingDataContractRequirements(
    obligationClause(contract, DATA_OBLIGATION),
  );
  const findings =
    contractMissing.length > 0
      ? contractMissing.map(requirement => ({
          severity: 'error' as const,
          message: `The packaged plan contract is missing the data-decision requirement for ${requirement}.`,
        }))
      : dataFindings(plan);
  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0 ? 'Data decisions are complete.' : 'Data decisions need changes.',
    findings,
  };
}

export function reviewMigrationCommandSeparation(contract: string, plan: string): ReviewerOutput {
  const clause = obligationClause(contract, DATA_OBLIGATION);
  const findings: { severity: 'error'; message: string }[] = [];
  if (clause?.includes(MIGRATION_COMMAND_REQUIREMENT) !== true) {
    findings.push({
      severity: 'error',
      message:
        'The packaged plan contract is missing the migration-command separation requirement.',
    });
  } else if (/^(?:ALTER|CREATE|DROP|UPDATE|INSERT)\s+/mu.test(plan)) {
    findings.push({
      severity: 'error',
      message:
        'Move exact migration commands to Execution Planning; keep migration decisions here.',
    });
  }
  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Migration content stays at decision depth.'
        : 'Migration execution mechanics need removal.',
    findings,
  };
}

function dataOwnershipFindings(
  contract: string,
  plan: string,
): { severity: 'error'; message: string }[] {
  const normalizedClause = obligationClause(contract, DATA_OBLIGATION)?.replaceAll(/\s+/gu, ' ');
  const missingRequirement = DATA_OWNERSHIP_REQUIREMENTS.find(
    requirement => normalizedClause?.includes(requirement) !== true,
  );
  if (missingRequirement !== undefined) {
    return [
      {
        severity: 'error',
        message: `The packaged plan contract is missing the data-ownership consistency requirement for ${missingRequirement}.`,
      },
    ];
  }

  const sourceAuthority = /^Source of truth: (.+?) is authoritative\.$/mu.exec(plan)?.[1];
  const persistedEntityOwner = /^Ownership and access: (.+?) owns the persisted entity\.$/mu.exec(
    plan,
  )?.[1];
  if (sourceAuthority === undefined || persistedEntityOwner === undefined) return [];
  if (sourceAuthority === persistedEntityOwner) return [];
  return [
    {
      severity: 'error',
      message: `Conflicting data owner: ${persistedEntityOwner} owns the persisted entity, but ${sourceAuthority} is the source-of-truth authority.`,
    },
  ];
}

export function reviewDataOwnershipConsistency(contract: string, plan: string): ReviewerOutput {
  const findings = dataOwnershipFindings(contract, plan);

  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Data ownership agrees with its authority.'
        : 'Data ownership consistency needs changes.',
    findings,
  };
}

export const COMPLETE_DATA_PLAN = `# Implementation Plan

Data applicability: persisted account identity changes
Purpose: associate multiple provider accounts with one user.
Store and model: relational account-link records.
Schema and relationships: one user to many provider accounts.
Source of truth: the account-link store is canonical.
Ownership and access: users read their links; the identity service writes them.
Identity and integrity: provider subject plus issuer is unique.
Cross-system flow: OAuth callback writes before session issuance.
Lifecycle and retention: links persist until unlink or account deletion.
Migration and backfill: existing accounts receive one link without changing identity.
Compliance: tokens remain encrypted and excluded from review artifacts.
Rollback: retain the old lookup until backfill verification completes.
`;

export function withoutDataFields(...fields: readonly string[]): string {
  return COMPLETE_DATA_PLAN.split('\n')
    .filter(line => fields.every(field => !line.startsWith(`${field}:`)))
    .join('\n');
}
