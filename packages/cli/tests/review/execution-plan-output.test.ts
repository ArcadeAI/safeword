import { describe, expect, it } from 'vitest';

import type { ExecutionPlanRecord, UnverifiedReviewerOutput } from '../../src/review/contract.js';
import { validateExecutionPlanOutput } from '../../src/review/execution-plan-output.js';
import {
  parseReviewerOutput,
  reviewerArguments,
  reviewOutputSchema,
} from '../../src/review/runtime.js';

const legacyKinds = [
  'quality-review',
  'scenario-gate',
  'plan-implementation',
  'executable-red',
] as const;

const baseOutput = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  reviewer_agent: 'claude',
  verdict: 'approve',
  summary: 'reviewed',
  findings: [],
} as const;
const nullRecord = JSON.parse('null') as null;

function validRecord(): ExecutionPlanRecord {
  return {
    slicing_decision: 'multiple_pull_requests',
    rationale: 'Contract and activation have independent proof and safe merge boundaries.',
    slices: [
      {
        name: 'Contract',
        purpose: 'Package the shared contract.',
        boundary: 'Contract assets only.',
        prerequisites: [],
        proof: 'Generation and package tests.',
        completion_signal: 'The contract ships inertly.',
        relies_on_unmerged_successor: false,
      },
      {
        name: 'Activation',
        purpose: 'Expose the reviewed command.',
        boundary: 'Public dispatch only.',
        prerequisites: ['Contract'],
        proof: 'CLI integration tests.',
        completion_signal: 'The command retains an auditable approval.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [
      { obligation: 'Shared contract', slices: ['Contract'] },
      { obligation: 'Auditable activation', slices: ['Activation'] },
    ],
    decision_statuses: [{ decision: 'Use one shared coordinator', status: 'unchanged' }],
  };
}

function approval(record: unknown = validRecord()): UnverifiedReviewerOutput {
  return { ...baseOutput, execution_plan_record: record };
}

function validSingleRecord(): ExecutionPlanRecord {
  const record = validRecord();
  const [slice] = record.slices;
  if (slice === undefined) throw new Error('Missing single-slice fixture');
  return {
    ...record,
    slicing_decision: 'one_pull_request',
    slices: [slice],
    obligation_owners: [{ obligation: 'Shared contract', slices: ['Contract'] }],
  };
}

function mutateRecord(mutate: (record: Record<string, unknown>) => void): unknown {
  const record = structuredClone(validRecord()) as unknown as Record<string, unknown>;
  mutate(record);
  return record;
}

function recordEntry(
  record: Record<string, unknown>,
  collection: 'slices' | 'obligation_owners' | 'decision_statuses',
  index: number,
): Record<string, unknown> {
  const entries = record[collection];
  const entry = Array.isArray(entries) ? entries[index] : undefined;
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`Missing ${collection} fixture entry ${index}`);
  }
  return entry as Record<string, unknown>;
}

describe('Execution Plan output schema', () => {
  it('keeps every existing review-kind schema byte-for-byte unchanged', () => {
    const baseline = reviewOutputSchema('quality-review');

    for (const kind of legacyKinds) expect(reviewOutputSchema(kind)).toBe(baseline);
    const shape = JSON.parse(baseline) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(shape.properties).not.toHaveProperty('execution_plan_record');
    expect(shape.required).toEqual([
      'schema_version',
      'dispatch_id',
      'reviewer_agent',
      'verdict',
      'summary',
      'findings',
    ]);
  });

  it('selects a strict required-but-nullable record only for plan-execution', () => {
    const shape = JSON.parse(reviewOutputSchema('plan-execution')) as {
      properties: Record<string, { anyOf?: unknown[] }>;
      required: string[];
    };

    expect(shape.required).toContain('execution_plan_record');
    expect(shape.properties.execution_plan_record?.anyOf).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'null' })]),
    );
    expect(reviewOutputSchema('plan-execution')).not.toBe(reviewOutputSchema('quality-review'));
  });

  it('gives Claude the selected strict schema without changing legacy arguments', () => {
    const legacy = reviewerArguments('claude', undefined, undefined, {}, 'quality-review');
    const execution = reviewerArguments('claude', undefined, undefined, {}, 'plan-execution');
    const schemaIndex = execution.indexOf('--json-schema') + 1;

    expect(execution[schemaIndex]).toBe(reviewOutputSchema('plan-execution'));
    expect(legacy[schemaIndex]).toBe(reviewOutputSchema('quality-review'));
    expect(execution.filter((_argument, index) => index !== schemaIndex)).toEqual(
      legacy.filter((_argument, index) => index !== schemaIndex),
    );
  });

  it('parses the record only under the internal plan-execution kind', () => {
    const encoded = JSON.stringify(approval());
    const denialWithoutRecord = {
      ...baseOutput,
      verdict: 'request_changes' as const,
      findings: [{ severity: 'error' as const, message: 'Rollback ownership is missing.' }],
    };

    expect(parseReviewerOutput('claude', encoded, 'plan-execution')).toEqual(approval());
    expect(
      parseReviewerOutput('claude', JSON.stringify(denialWithoutRecord), 'plan-execution'),
    ).toEqual(denialWithoutRecord);
    expect(() => parseReviewerOutput('claude', encoded, 'quality-review')).toThrow(
      'invalid reviewer output',
    );
    expect(() =>
      parseReviewerOutput('claude', JSON.stringify(baseOutput), 'plan-execution'),
    ).toThrow('invalid reviewer output');
  });
});

describe('Execution Plan output validation', () => {
  it('accepts a complete positive record without changing it', () => {
    const output = approval();
    expect(validateExecutionPlanOutput(output)).toEqual({ kind: 'approved', output });
  });

  it('accepts exactly one independently safe slice for one pull request', () => {
    const output = approval(validSingleRecord());
    expect(validateExecutionPlanOutput(output)).toEqual({ kind: 'approved', output });
  });

  it('normalizes every legible denial to a null record', () => {
    const output: UnverifiedReviewerOutput = {
      ...baseOutput,
      verdict: 'request_changes',
      findings: [{ severity: 'error', message: 'The plan omits rollback ownership.' }],
      execution_plan_record: { malformed: true },
    };

    expect(validateExecutionPlanOutput(output)).toEqual({
      kind: 'denied',
      output: { ...output, execution_plan_record: nullRecord },
    });

    const denialWithoutRecord = { ...output };
    delete denialWithoutRecord.execution_plan_record;
    expect(validateExecutionPlanOutput(denialWithoutRecord)).toEqual({
      kind: 'denied',
      output: { ...denialWithoutRecord, execution_plan_record: nullRecord },
    });
  });

  it.each([
    ['missing record', { ...baseOutput }],
    ['null positive record', approval(nullRecord)],
    ['blank rationale', approval(mutateRecord(record => (record.rationale = '  ')))],
    [
      'unknown slicing decision',
      approval(mutateRecord(record => (record.slicing_decision = 'two'))),
    ],
    [
      'one decision with multiple slices',
      approval(mutateRecord(record => (record.slicing_decision = 'one_pull_request'))),
    ],
    [
      'multiple decision with one slice',
      approval(
        mutateRecord(record => {
          record.slices = (record.slices as unknown[]).slice(0, 1);
          record.obligation_owners = [{ obligation: 'Shared contract', slices: ['Contract'] }];
        }),
      ),
    ],
    [
      'duplicate slice name',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 1).name = 'Contract';
        }),
      ),
    ],
    [
      'blank slice field',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 0).proof = ' ';
        }),
      ),
    ],
    [
      'blank slice name',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 0).name = ' ';
        }),
      ),
    ],
    [
      'extra slice field',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 0).implementation = 'not allowed';
        }),
      ),
    ],
    [
      'missing prerequisite list',
      approval(
        mutateRecord(record => {
          delete recordEntry(record, 'slices', 0).prerequisites;
        }),
      ),
    ],
    [
      'forward prerequisite',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 0).prerequisites = ['Activation'];
        }),
      ),
    ],
    [
      'duplicate prerequisite',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 1).prerequisites = ['Contract', 'Contract'];
        }),
      ),
    ],
    ['missing obligations', approval(mutateRecord(record => (record.obligation_owners = [])))],
    [
      'non-array obligations',
      approval(mutateRecord(record => (record.obligation_owners = 'invalid'))),
    ],
    [
      'blank obligation',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'obligation_owners', 0).obligation = '';
        }),
      ),
    ],
    [
      'obligation without owning slices',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'obligation_owners', 0).slices = [];
        }),
      ),
    ],
    [
      'duplicate obligation',
      approval(
        mutateRecord(record => {
          record.obligation_owners = [
            { obligation: 'Shared contract', slices: ['Contract'] },
            { obligation: 'Shared contract', slices: ['Activation'] },
          ];
        }),
      ),
    ],
    [
      'unknown owning slice',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'obligation_owners', 0).slices = ['Missing'];
        }),
      ),
    ],
    [
      'duplicate owning slice',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'obligation_owners', 0).slices = ['Contract', 'Contract'];
        }),
      ),
    ],
    [
      'unowned slice',
      approval(
        mutateRecord(record => {
          record.obligation_owners = [{ obligation: 'Shared contract', slices: ['Contract'] }];
        }),
      ),
    ],
    ['missing decisions', approval(mutateRecord(record => (record.decision_statuses = [])))],
    [
      'non-array decisions',
      approval(mutateRecord(record => (record.decision_statuses = nullRecord))),
    ],
    [
      'blank decision',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'decision_statuses', 0).decision = ' ';
        }),
      ),
    ],
    [
      'missing decision status',
      approval(
        mutateRecord(record => {
          delete recordEntry(record, 'decision_statuses', 0).status;
        }),
      ),
    ],
    [
      'duplicate decision',
      approval(
        mutateRecord(record => {
          record.decision_statuses = [
            { decision: 'Use one shared coordinator', status: 'unchanged' },
            { decision: 'Use one shared coordinator', status: 'unchanged' },
          ];
        }),
      ),
    ],
    [
      'unreadable successor tripwire',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'slices', 0).relies_on_unmerged_successor = 'no';
        }),
      ),
    ],
    [
      'unreadable decision tripwire',
      approval(
        mutateRecord(record => {
          recordEntry(record, 'decision_statuses', 0).status = 1;
        }),
      ),
    ],
  ])('classifies %s as retryable invalid output', (_name, output) => {
    expect(validateExecutionPlanOutput(output)).toEqual({
      kind: 'invalid_output',
    });
  });

  it('converts a readable successor dependency to a final named denial', () => {
    const output = approval(
      mutateRecord(record => {
        recordEntry(record, 'slices', 1).relies_on_unmerged_successor = true;
        delete recordEntry(record, 'slices', 1).proof;
      }),
    );
    const result = validateExecutionPlanOutput(output);

    expect(result.kind).toBe('denied');
    if (result.kind !== 'denied') return;
    expect(result.output.execution_plan_record).toBeNull();
    expect(result.output.findings.at(-1)?.message).toContain('Activation');
  });

  it('converts a readable changed decision to a final named denial', () => {
    const output = approval(
      mutateRecord(record => {
        recordEntry(record, 'decision_statuses', 0).status = 'changed';
        record.rationale = '';
      }),
    );
    const result = validateExecutionPlanOutput(output);

    expect(result.kind).toBe('denied');
    if (result.kind !== 'denied') return;
    expect(result.output.execution_plan_record).toBeNull();
    expect(result.output.findings.at(-1)?.message).toContain('Use one shared coordinator');
  });
});
