import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';

const DATA_OBLIGATION = 'Data applicability and decisions';
const MIGRATION_COMMAND_REQUIREMENT =
  'Migration commands are execution mechanics and cannot replace data decisions';
const DATA_FIELDS = [
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

function obligationClause(contract: string, obligation: string): string | undefined {
  return contract
    .split(/\n(?=- \*\*)/u)
    .find(candidate => candidate.startsWith(`- **${obligation}:**`))
    ?.split('\n\n', 1)[0];
}

function missingDataContractRequirements(clause: string | undefined): string[] {
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

function reviewDataApplicability(contract: string, plan: string): ReviewerOutput {
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

function reviewMigrationCommandSeparation(contract: string, plan: string): ReviewerOutput {
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

const COMPLETE_DATA_PLAN = `# Implementation Plan

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

function withoutFields(...fields: readonly string[]): string {
  return COMPLETE_DATA_PLAN.split('\n')
    .filter(line => fields.every(field => !line.startsWith(`${field}:`)))
    .join('\n');
}

const DATA_CLAUSE_FIXTURE = `- **Data applicability and decisions:** Require \`Data applicability:\` to state
  either \`skip: <reason>\` when there is no data-contract, ownership, or lifecycle
  impact, or decision-depth coverage of Purpose, Store and model, Schema and
  relationships, Source of truth, Ownership and access, Identity and integrity,
  Cross-system flow, Lifecycle and retention, Migration and backfill, Compliance,
  and Rollback.`;

function contractWithDataFixture(): string {
  const existing = obligationClause(PLAN_REVIEW_RUBRIC, DATA_OBLIGATION);
  if (existing !== undefined && missingDataContractRequirements(existing).length === 0) {
    return PLAN_REVIEW_RUBRIC;
  }
  if (existing === undefined) return `${PLAN_REVIEW_RUBRIC}\n${DATA_CLAUSE_FIXTURE}`;
  const clauseStart = PLAN_REVIEW_RUBRIC.indexOf(existing);
  return `${PLAN_REVIEW_RUBRIC.slice(0, clauseStart)}${DATA_CLAUSE_FIXTURE}${PLAN_REVIEW_RUBRIC.slice(clauseStart + existing.length)}`;
}

describe('Implementation Plan data applicability contract', () => {
  it.each([
    {
      name: 'rejects missing ownership and migration decisions',
      plan: withoutFields('Ownership and access', 'Migration and backfill'),
      verdict: 'request_changes',
      findings: ['Ownership and access', 'Migration and backfill'],
    },
    {
      name: 'rejects missing retention and rollback decisions',
      plan: withoutFields('Lifecycle and retention', 'Rollback'),
      verdict: 'request_changes',
      findings: ['Lifecycle and retention', 'Rollback'],
    },
    {
      name: 'rejects missing identity and integrity decisions',
      plan: withoutFields('Identity and integrity'),
      verdict: 'request_changes',
      findings: ['Identity and integrity'],
    },
    {
      name: 'accepts complete decision-depth coverage',
      plan: COMPLETE_DATA_PLAN,
      verdict: 'approve',
      findings: [],
    },
    {
      name: 'rejects a cross-system flow without source of truth or access decisions',
      plan: withoutFields('Source of truth', 'Ownership and access'),
      verdict: 'request_changes',
      findings: ['Source of truth', 'Ownership and access'],
    },
    {
      name: 'rejects a regulated backfill without a compliance decision',
      plan: withoutFields('Compliance'),
      verdict: 'request_changes',
      findings: ['Compliance'],
    },
    {
      name: 'accepts a justified no-data-impact declaration',
      plan: '# Implementation Plan\n\nData applicability: skip: no data-contract, ownership, or lifecycle impact\n',
      verdict: 'approve',
      findings: [],
    },
  ])('$name', ({ findings, plan, verdict }) => {
    const result = reviewDataApplicability(PLAN_REVIEW_RUBRIC, plan);
    const contractFailures = result.findings.filter(candidate =>
      candidate.message.startsWith('The packaged plan contract is missing'),
    );
    expect(
      contractFailures,
      'The packaged contract is missing the data-decision requirements.',
    ).toEqual([]);
    expect(result.verdict).toBe(verdict);
    for (const finding of findings) {
      expect(result.findings.some(candidate => candidate.message.includes(finding))).toBe(true);
    }
  });

  it.each([...DATA_FIELDS, 'Data applicability:', 'skip: <reason>'])(
    'fails closed when the contract drops %s',
    requirement => {
      const contract = contractWithDataFixture();
      const clause = obligationClause(contract, DATA_OBLIGATION) ?? '';
      expect(missingDataContractRequirements(clause)).toEqual([]);
      const mutated = clause.replaceAll(/\s+/gu, ' ').replace(requirement, '');

      const result = reviewDataApplicability(mutated, COMPLETE_DATA_PLAN);

      expect(result.verdict).toBe('request_changes');
      expect(result.findings.some(candidate => candidate.message.includes(requirement))).toBe(true);
    },
  );
});

describe('Implementation Plan migration-command separation', () => {
  it('rejects exact migration commands even when every data decision is present', () => {
    const plan = `${COMPLETE_DATA_PLAN}\nMigration commands:\nALTER TABLE account_links ADD COLUMN issuer TEXT;\n`;

    const result = reviewMigrationCommandSeparation(PLAN_REVIEW_RUBRIC, plan);

    expect(
      result.findings.filter(candidate =>
        candidate.message.startsWith('The packaged plan contract'),
      ),
      'The packaged contract is missing the migration-command separation requirement.',
    ).toEqual([]);
    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining('Execution Planning') }),
    ]);
  });

  it('fails closed when the migration-command separation sentence is removed', () => {
    const contract = `${DATA_CLAUSE_FIXTURE} ${MIGRATION_COMMAND_REQUIREMENT}.`;
    expect(obligationClause(contract, DATA_OBLIGATION)).toContain(MIGRATION_COMMAND_REQUIREMENT);
    const mutated = contract.replace(MIGRATION_COMMAND_REQUIREMENT, '');

    const result = reviewMigrationCommandSeparation(mutated, COMPLETE_DATA_PLAN);

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining('separation requirement') }),
    ]);
  });
});
