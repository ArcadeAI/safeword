import { createHash } from 'node:crypto';

import type { ReviewerOutput } from '../../src/review/contract.js';
import { obligationClause } from './plan-focused-reviewability.js';

export const DECISION_DEPTH_OBLIGATION = 'Significant workflow decision depth';
const DECISION_DEPTH_REQUIREMENTS = [
  /durable state, authorization, concurrent state transitions, lifecycle-scheduled deletion, migration, and compatibility/iu,
  /state.+authority.+atomicity.+retry.+evidence/iu,
  /crash.+cutover.+compatibility/iu,
  /block.+name.+missing.+applicable concern/iu,
] as const;

type Concern =
  | 'durable state'
  | 'authorization'
  | 'concurrent state transition'
  | 'lifecycle-scheduled deletion'
  | 'migration'
  | 'compatibility';

type DecisionField =
  | 'states'
  | 'authority'
  | 'atomicity'
  | 'crash'
  | 'retry'
  | 'evidence'
  | 'permissions'
  | 'schema'
  | 'compatibility'
  | 'cutover'
  | 'interoperability-evidence';

export interface DecisionDepthFixture {
  readonly concern: Concern;
  readonly fields: ReadonlySet<DecisionField>;
}

type Finding = { severity: 'error'; message: string };

const FIELD_PATTERNS: readonly [DecisionField, RegExp][] = [
  ['states', /legal states|transition states|deletion states|supported-version states/iu],
  [
    'authority',
    /transition authority|change authority|authority for every destructive transition/iu,
  ],
  ['atomicity', /atomicity|atomic cutover/iu],
  ['crash', /crash boundary|crash,/iu],
  ['retry', /retry behavior/iu],
  ['evidence', /preserved evidence/iu],
  ['permissions', /permissions/iu],
  ['schema', /target schema/iu],
  ['compatibility', /compatibility policy/iu],
  ['cutover', /cutover boundary/iu],
  ['interoperability-evidence', /preserved interoperability evidence/iu],
];

const CONCERN_REQUIREMENTS: Readonly<
  Record<Concern, readonly { field: DecisionField; label: string }[]>
> = {
  'durable state': [
    { field: 'states', label: 'state model' },
    { field: 'authority', label: 'transition authority' },
    { field: 'atomicity', label: 'atomicity boundary' },
    { field: 'retry', label: 'retry behavior' },
    { field: 'evidence', label: 'evidence model' },
  ],
  authorization: [
    { field: 'permissions', label: 'permissions' },
    { field: 'authority', label: 'authority decision' },
  ],
  'concurrent state transition': [
    { field: 'states', label: 'transition states' },
    { field: 'authority', label: 'transition authority' },
    { field: 'atomicity', label: 'atomicity boundary' },
    { field: 'retry', label: 'retry behavior' },
    { field: 'evidence', label: 'evidence model' },
  ],
  'lifecycle-scheduled deletion': [
    { field: 'states', label: 'deletion states' },
    { field: 'authority', label: 'transition authority' },
    { field: 'atomicity', label: 'atomicity boundary' },
    { field: 'retry', label: 'retry behavior' },
    { field: 'evidence', label: 'lifecycle evidence model' },
  ],
  migration: [
    { field: 'schema', label: 'target schema' },
    { field: 'crash', label: 'crash boundary' },
    { field: 'retry', label: 'retry behavior' },
    { field: 'compatibility', label: 'compatibility policy' },
  ],
  compatibility: [
    { field: 'states', label: 'supported-version states' },
    { field: 'authority', label: 'change authority' },
    { field: 'cutover', label: 'cutover boundary' },
    { field: 'retry', label: 'retry behavior' },
    { field: 'interoperability-evidence', label: 'preserved interoperability evidence' },
  ],
};

export function decisionDepthFixture(
  concern: string,
  decisionDetail: string,
): DecisionDepthFixture {
  if (!Object.hasOwn(CONCERN_REQUIREMENTS, concern)) throw new Error(`unknown concern: ${concern}`);
  const fields = new Set<DecisionField>();
  for (const [field, pattern] of FIELD_PATTERNS) {
    if (pattern.test(decisionDetail)) fields.add(field);
  }
  return { concern: concern as Concern, fields };
}

function contractFindings(contract: string): Finding[] {
  const clause = obligationClause(contract, DECISION_DEPTH_OBLIGATION)?.replaceAll(/\s+/gu, ' ');
  if (clause === undefined) {
    return [
      { severity: 'error', message: `The contract is missing ${DECISION_DEPTH_OBLIGATION}.` },
    ];
  }
  return DECISION_DEPTH_REQUIREMENTS.flatMap((requirement, index) =>
    requirement.test(clause)
      ? []
      : [
          {
            severity: 'error' as const,
            message: `${DECISION_DEPTH_OBLIGATION} is missing requirement ${index + 1}.`,
          },
        ],
  );
}

export function reviewDecisionDepth(
  contract: string,
  fixture: DecisionDepthFixture,
): ReviewerOutput {
  const findings = contractFindings(contract);
  if (findings.length === 0) {
    const missing = CONCERN_REQUIREMENTS[fixture.concern].filter(
      requirement => !fixture.fields.has(requirement.field),
    );
    if (missing.length > 0) {
      findings.push({
        severity: 'error',
        message: `The ${fixture.concern} decision is missing ${missing.map(item => item.label).join(', ')}.`,
      });
    }
  }
  return {
    schema_version: 1,
    dispatch_id: createHash('sha256').update(contract).digest('hex'),
    reviewer_agent: 'claude',
    verdict: findings.length === 0 ? 'approve' : 'request_changes',
    summary:
      findings.length === 0
        ? 'Significant workflow decision depth is complete.'
        : 'Significant workflow decision depth is incomplete.',
    findings,
  };
}
