export type PlanningPhase = 'product-plan' | 'plan-implementation' | 'plan-execution';

export interface PlanningAuthorCopyIdentity {
  readonly relativePath: string;
  readonly sha256: string;
}

export type UpstreamImplementationInvalidation = 'both_plan_reviews' | 'implementation_review_only';

const fieldLabels = {
  purpose: 'Purpose',
  entryCriteria: 'Entry criteria',
  requiredContent: 'Required content',
  prohibitedContent: 'Prohibited content',
  reviewQuestion: 'Review question',
  approvalMeaning: 'Approval meaning',
  invalidation: 'Invalidation',
  returnPath: 'Return path',
} as const;

type DecisionFields = Readonly<Record<keyof typeof fieldLabels, string>>;

export type PlanningContract = DecisionFields &
  (
    | { readonly phase: 'product-plan' | 'plan-implementation' }
    | {
        readonly phase: 'plan-execution';
        readonly upstreamImplementationInvalidation: UpstreamImplementationInvalidation;
      }
  );

export class InvalidInvalidationContractError extends Error {
  readonly code = 'invalid_invalidation_contract';
  readonly phase = 'plan-execution';

  constructor() {
    super('Execution Planning must declare exactly one supported upstream invalidation direction.');
    this.name = 'InvalidInvalidationContractError';
  }
}

function decisionField(source: string, label: string): string {
  const declarations: string[][] = [];
  let current: string[] | undefined;
  for (const line of source.replaceAll(/<!--[\s\S]*?-->/gu, '').split('\n')) {
    const declaration = /^- \*\*([^:]+):\*\*(.*)$/u.exec(line);
    if (declaration?.[1] === label) {
      current = [declaration[2] ?? ''];
      declarations.push(current);
    } else if (current !== undefined && /^[ \t]/u.test(line)) {
      current.push(line.trim());
    } else {
      current = undefined;
    }
  }
  const [parts = []] = declarations;
  const value = parts.join(' ').replaceAll(/\s+/gu, ' ').trim();
  if (declarations.length !== 1 || value === '') {
    throw new Error(`Planning contract must declare exactly one nonempty ${label} field.`);
  }
  return value;
}

function executionInvalidationField(source: string): string {
  try {
    return decisionField(source, 'Invalidation');
  } catch {
    throw new InvalidInvalidationContractError();
  }
}

/** Read the closed eight-field grammar inside a phase owner's reviewer-safe block. */
export function parsePlanningContract(phase: PlanningPhase, source: string): PlanningContract {
  const fields = Object.fromEntries(
    Object.entries(fieldLabels).map(([field, label]) => [
      field,
      phase === 'plan-execution' && field === 'invalidation'
        ? executionInvalidationField(source)
        : decisionField(source, label),
    ]),
  ) as DecisionFields;
  if (phase !== 'plan-execution') return { phase, ...fields };
  const declarations = fields.invalidation
    .matchAll(/upstreamImplementationInvalidation:\s*([^\s`]*)/gu)
    .toArray();
  const mode = declarations[0]?.[1];
  if (
    declarations.length !== 1 ||
    (mode !== 'both_plan_reviews' && mode !== 'implementation_review_only')
  ) {
    throw new InvalidInvalidationContractError();
  }
  return { phase, ...fields, upstreamImplementationInvalidation: mode };
}
