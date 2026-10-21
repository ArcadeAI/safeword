import { describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  DELIVERY_CHECKLIST_CATEGORIES,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
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
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: 'a'.repeat(64),
    delivery_definition: {
      schema_version: 1,
      design_approval_gate: false,
      proof_specifications: [
        {
          proof_id: 'contract-tests',
          method: 'command',
          scope: 'integration',
          boundary_exercised: 'review output contract',
          qualifies_as: 'real_boundary',
          currency: 'current_required',
          invocation: {
            type: 'command',
            cwd: 'packages/cli',
            argv: ['bun', 'run', 'test'],
          },
        },
      ],
      checklist_items: DELIVERY_CHECKLIST_CATEGORIES.map((category, index) => ({
        id: `item-${index + 1}`,
        category,
        obligation: `Complete ${category}.`,
        owner: 'contributor',
        required_proof: 'contract-tests',
        reviewed_disposition: nullRecord,
        reviewed_detail: nullRecord,
      })),
    },
  };
}

function approval(record: unknown = validRecord()): UnverifiedReviewerOutput {
  return { ...baseOutput, planning_destination: 'plan-execution', execution_plan_record: record };
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
  it('admits a reviewed contributor not-applicable item without a proof claim', () => {
    const record = structuredClone(validRecord());
    const item = record.delivery_definition.checklist_items[0];
    if (item === undefined) throw new Error('Missing checklist fixture item');
    const updated: ExecutionPlanRecord = {
      ...record,
      delivery_definition: {
        ...record.delivery_definition,
        checklist_items: [
          {
            ...item,
            required_proof: '',
            reviewed_disposition: 'not_applicable',
            reviewed_detail: 'No applicable runtime boundary.',
          },
          ...record.delivery_definition.checklist_items.slice(1),
        ],
      },
    };

    expect(validateExecutionPlanOutput(approval(updated))).toMatchObject({ kind: 'approved' });
  });

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
    expect(shape.required).toContain('planning_destination');
    expect(shape.properties.planning_destination).toMatchObject({
      enum: ['plan-execution', 'plan-implementation'],
    });
    expect(shape.properties.execution_plan_record?.anyOf).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'null' })]),
    );
    const record = shape.properties.execution_plan_record?.anyOf?.find(
      branch => (branch as { type?: string }).type === 'object',
    ) as { required?: string[] };
    expect(record.required).toEqual(
      expect.arrayContaining([
        'accepted_scenarios_covered',
        'accepted_approach_preserved',
        'normalized_plan_digest',
        'delivery_definition',
      ]),
    );
    expect(reviewOutputSchema('plan-execution')).not.toBe(reviewOutputSchema('quality-review'));
  });

  it('changes only the schema and stream format for Claude planning review', () => {
    const legacy = reviewerArguments('claude', undefined, undefined, {}, 'quality-review');
    const execution = reviewerArguments('claude', undefined, undefined, {}, 'plan-execution');
    const schemaIndex = execution.indexOf('--json-schema') + 1;

    expect(execution[schemaIndex]).toBe(reviewOutputSchema('plan-execution'));
    expect(legacy[schemaIndex]).toBe(reviewOutputSchema('quality-review'));
    const expected = [...legacy];
    expected[schemaIndex] = reviewOutputSchema('plan-execution');
    expected[expected.indexOf('--output-format') + 1] = 'stream-json';
    expected.push('--verbose');
    expect(execution).toEqual(expected);
  });

  it('parses the record only under the internal plan-execution kind', () => {
    const encoded = JSON.stringify(approval());
    const denialWithoutRecord = {
      ...baseOutput,
      planning_destination: 'plan-execution' as const,
      verdict: 'request_changes' as const,
      findings: [{ severity: 'error' as const, message: 'Rollback ownership is missing.' }],
    };
    const denial = { ...denialWithoutRecord, execution_plan_record: nullRecord };

    expect(parseReviewerOutput('claude', encoded, 'plan-execution')).toEqual(approval());
    expect(parseReviewerOutput('claude', JSON.stringify(denial), 'plan-execution')).toEqual(denial);
    expect(() => parseReviewerOutput('claude', encoded, 'quality-review')).toThrow(
      'invalid reviewer output',
    );
    expect(() =>
      parseReviewerOutput('claude', JSON.stringify(baseOutput), 'plan-execution'),
    ).toThrow('invalid reviewer output');
    expect(() =>
      parseReviewerOutput('claude', JSON.stringify(denialWithoutRecord), 'plan-execution'),
    ).toThrow('invalid reviewer output');
  });
});

describe('Execution Plan output validation', () => {
  it.each([
    ['repeated flags', ['cargo', 'test', '--test', 'one', '--test', 'two']],
    ['empty operands', ['node', '-e', '', ' ', '']],
    ['JSON escapes', ['node', '-e', String.raw`console.log(/\d|b/, "C:\\tmp")`]],
  ])('preserves %s from Markdown through the trusted review boundary', (_name, argv) => {
    const invocation = { type: 'command', cwd: 'packages/cli', argv };
    const encodedInvocation = JSON.stringify(invocation).replaceAll('|', String.raw`\|`);
    const markdown = [
      '## Proof specifications',
      '',
      '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| command | command | integration | proof command | real_boundary | current_required | ${encodedInvocation} |`,
      '',
      '## Delivery checklist',
      '',
      '<!-- safeword:delivery-checklist:v1 -->',
      '',
      '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...DELIVERY_CHECKLIST_CATEGORIES.map(
        (category, index) =>
          `| item-${index} | ${category} | Deliver ${category} | contributor | command | open | missing | | |`,
      ),
      '',
    ].join('\n');
    const parsed = parseDeliveryPlanContract(markdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.message);
    const definition = createExecutionPlanDeliveryDefinition(parsed, false);
    const expectedDefinition = structuredClone(definition);
    const record = { ...validRecord(), delivery_definition: definition };
    const output = approval(record);
    const expectedOutput = structuredClone(output);

    expect(definition.proof_specifications[0]?.invocation).toEqual(invocation);
    expect(
      validateExecutionPlanOutput(output, expectedDefinition, record.normalized_plan_digest),
    ).toEqual({ kind: 'approved', output: expectedOutput });
    expect(output).toEqual(expectedOutput);
    expect(definition).toEqual(expectedDefinition);
  });

  it.each([
    ['repeated flags', ['cargo', 'test', '--test', 'local_route', '--test', 'request_audit']],
    ['empty operands', ['node', '-e', '', ' ', '']],
  ])('accepts %s without changing the trusted definition', (_name, argv) => {
    const record = validRecord();
    const proof = record.delivery_definition.proof_specifications[0];
    if (proof?.invocation.type !== 'command') throw new Error('Missing command proof');
    Object.assign(proof.invocation, { argv });
    const output = approval(record);
    const expectedOutput = structuredClone(output);
    expect(
      validateExecutionPlanOutput(
        output,
        structuredClone(record.delivery_definition),
        record.normalized_plan_digest,
      ),
    ).toEqual({ kind: 'approved', output: expectedOutput });
    expect(output).toEqual(expectedOutput);
  });

  it.each([
    ['empty argv', { argv: [] }, 'invocation.argv'],
    ['blank executable', { argv: [' ', 'test'] }, 'invocation.argv'],
    ['empty executable', { argv: ['', 'test'] }, 'invocation.argv'],
    ['non-string operand', { argv: ['node', 1] }, 'invocation.argv'],
    ['non-array argv', { argv: 'node' }, 'invocation.argv'],
    ['outside cwd', { cwd: '../outside' }, 'invocation.cwd'],
    ['absolute cwd', { cwd: '/outside' }, 'invocation.cwd'],
    ['mismatched type', { type: 'review_receipt' }, 'invocation.type'],
    ['extra invocation key', { extra: true }, 'must contain exactly type, cwd, and argv'],
  ])('rejects %s with a field-specific reason', (_name, changes, field) => {
    const record = validRecord();
    const proof = record.delivery_definition.proof_specifications[0];
    if (!proof) throw new Error('Missing proof fixture');
    Object.assign(proof.invocation, changes);
    expect(validateExecutionPlanOutput(approval(record))).toEqual({
      kind: 'invalid_output',
      reason: expect.stringContaining(field),
    });
  });

  it('keeps receipt targets unique and names the rejected field', () => {
    const record = validRecord();
    const proof = record.delivery_definition.proof_specifications[0];
    if (!proof) throw new Error('Missing proof fixture');
    Object.assign(proof, {
      method: 'review_receipt',
      invocation: {
        type: 'review_receipt',
        kind: 'scenario-gate',
        targets: ['a.feature', 'a.feature'],
      },
    });
    expect(validateExecutionPlanOutput(approval(record))).toEqual({
      kind: 'invalid_output',
      reason: expect.stringContaining('invocation.targets'),
    });
  });

  it.each([
    // eslint-disable-next-line unicorn/no-null -- JSON null is a distinct malformed boundary input.
    ['null', null],
    ['array', []],
    ['string', 'invalid'],
    ['missing', undefined],
  ])('names a non-object delivery definition: %s', (_name, value) => {
    const record = validRecord();
    Object.assign(record, { delivery_definition: value });
    expect(validateExecutionPlanOutput(approval(record))).toEqual({
      kind: 'invalid_output',
      reason: 'execution_plan_record.delivery_definition must be an object',
    });
  });

  it('accepts a complete positive record without changing it', () => {
    const output = approval();
    expect(validateExecutionPlanOutput(output)).toEqual({ kind: 'approved', output });
  });

  it('accepts exactly one independently safe slice for one pull request', () => {
    const output = approval(validSingleRecord());
    expect(validateExecutionPlanOutput(output)).toEqual({ kind: 'approved', output });
  });

  it('refuses a reviewer definition that differs from the trusted packet definition', () => {
    const expected = validRecord().delivery_definition;
    const output = approval(
      mutateRecord(record => {
        const definition = record.delivery_definition as {
          proof_specifications: Record<string, unknown>[];
        };
        const proof = definition.proof_specifications[0];
        if (proof === undefined) throw new Error('Missing proof fixture');
        proof.boundary_exercised = 'a different boundary';
      }),
    );

    expect(validateExecutionPlanOutput(output, expected)).toEqual({
      kind: 'invalid_output',
      reason: expect.any(String),
    });
  });

  it('refuses a reviewer digest that differs from the trusted normalized plan identity', () => {
    const output = approval();
    const expected = validRecord().delivery_definition;

    expect(validateExecutionPlanOutput(output, expected, 'b'.repeat(64))).toEqual({
      kind: 'invalid_output',
      reason: expect.any(String),
    });
  });

  it('normalizes every legible denial to a null record', () => {
    const output: UnverifiedReviewerOutput = {
      ...baseOutput,
      planning_destination: 'plan-implementation',
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

  it('fails closed when the planning destination is absent, unknown, or contradicts approval', () => {
    const withoutDestination = { ...approval() } as Record<string, unknown>;
    delete withoutDestination.planning_destination;

    expect(
      validateExecutionPlanOutput(withoutDestination as unknown as UnverifiedReviewerOutput),
    ).toEqual({ kind: 'invalid_output', reason: expect.any(String) });
    expect(
      validateExecutionPlanOutput({
        ...approval(),
        planning_destination: 'somewhere-else',
      }),
    ).toEqual({ kind: 'invalid_output', reason: expect.any(String) });
    expect(
      validateExecutionPlanOutput({
        ...approval(),
        planning_destination: 'plan-implementation',
      }),
    ).toEqual({ kind: 'invalid_output', reason: expect.any(String) });
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
      reason: expect.any(String),
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
