import { describe, expect, it } from 'vitest';

import { PLAN_REVIEW_RUBRIC } from '../../src/review/plan-rubric.generated.js';
import {
  COMPLETE_DATA_PLAN,
  DATA_FIELDS,
  DATA_OBLIGATION,
  MIGRATION_COMMAND_REQUIREMENT,
  missingDataContractRequirements,
  obligationClause,
  reviewDataApplicability,
  reviewMigrationCommandSeparation,
  withoutDataFields,
} from '../fixtures/plan-data-applicability.js';

describe('Implementation Plan data applicability contract', () => {
  it.each([
    {
      name: 'rejects missing ownership and migration decisions',
      plan: withoutDataFields('Ownership and access', 'Migration and backfill'),
      verdict: 'request_changes',
      findings: ['Ownership and access', 'Migration and backfill'],
    },
    {
      name: 'rejects missing purpose, store, and schema decisions',
      plan: withoutDataFields('Purpose', 'Store and model', 'Schema and relationships'),
      verdict: 'request_changes',
      findings: ['Purpose', 'Store and model', 'Schema and relationships'],
    },
    {
      name: 'rejects missing retention and rollback decisions',
      plan: withoutDataFields('Lifecycle and retention', 'Rollback'),
      verdict: 'request_changes',
      findings: ['Lifecycle and retention', 'Rollback'],
    },
    {
      name: 'rejects missing identity and integrity decisions',
      plan: withoutDataFields('Identity and integrity'),
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
      plan: withoutDataFields('Source of truth', 'Ownership and access'),
      verdict: 'request_changes',
      findings: ['Source of truth', 'Ownership and access'],
    },
    {
      name: 'rejects a regulated backfill without a compliance decision',
      plan: withoutDataFields('Compliance'),
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
      const clause = obligationClause(PLAN_REVIEW_RUBRIC, DATA_OBLIGATION) ?? '';
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
    const contract = obligationClause(PLAN_REVIEW_RUBRIC, DATA_OBLIGATION) ?? '';
    expect(obligationClause(contract, DATA_OBLIGATION)).toContain(MIGRATION_COMMAND_REQUIREMENT);
    const mutated = contract.replace(MIGRATION_COMMAND_REQUIREMENT, '');

    const result = reviewMigrationCommandSeparation(mutated, COMPLETE_DATA_PLAN);

    expect(result.verdict).toBe('request_changes');
    expect(result.findings).toEqual([
      expect.objectContaining({ message: expect.stringContaining('separation requirement') }),
    ]);
  });
});
