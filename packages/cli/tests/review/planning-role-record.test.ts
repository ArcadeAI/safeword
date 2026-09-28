import { describe, expect, it } from 'vitest';

import { PLANNING_CONTEXT_ROLES } from '../../src/review/planning-context-error.js';
import { isPlanningReviewIdentity } from '../../src/review/planning-role-context.js';

const digest = 'a'.repeat(64);
const requiredRoles = new Set([
  'ticket',
  'project',
  'rules',
  'scenarios',
  'principles',
  'personas',
  'surfaces',
]);
function identity() {
  return {
    schema_version: 1,
    ticket_id: 'OWN123',
    ticket_path: '.project/tickets/OWN123-owned/ticket.md',
    review_kind: 'plan-implementation',
    targets: [{ path: '.project/tickets/OWN123-owned/impl-plan.md', digest }],
    canonical_contract_digest: digest,
    dependencies: [...requiredRoles].map(role => ({
      role,
      path: `.project/tickets/OWN123-owned/${role}.md`,
      semantic_digest: digest,
    })),
    absences: PLANNING_CONTEXT_ROLES.filter(role => !requiredRoles.has(role)).map(role => ({
      role,
      reason: 'Not applicable to this reviewed artifact.',
      authority: '.project/tickets/OWN123-owned/impl-plan.md',
    })),
  };
}

describe('stored planning identity admission', () => {
  it('accepts a complete known record and multiple distinct records for one role', () => {
    const value = identity();
    expect(isPlanningReviewIdentity(value)).toBe(true);
    value.dependencies.push({
      role: 'ticket',
      path: '.project/tickets/OWN123-owned/other.md',
      semantic_digest: digest,
    });
    expect(isPlanningReviewIdentity(value)).toBe(true);
  });

  it('accepts Product identity only with phase-inapplicable roles absent', () => {
    const value = identity();
    const scenarios = value.dependencies.find(row => row.role === 'scenarios');
    if (scenarios === undefined) throw new Error('Fixture needs a scenario dependency.');
    const [target] = value.targets;
    if (target === undefined) throw new Error('Fixture needs a target.');
    const product = {
      ...value,
      review_kind: 'quality-review',
      dependencies: value.dependencies.filter(row => row.role !== 'scenarios'),
      absences: [
        ...value.absences,
        {
          role: 'scenarios',
          reason: 'Product review precedes scenario gate.',
          authority: target.path,
        },
      ],
    };
    expect(isPlanningReviewIdentity(product)).toBe(true);
    expect(
      isPlanningReviewIdentity({
        ...product,
        dependencies: [...product.dependencies, scenarios],
        absences: product.absences.filter(row => row.role !== 'scenarios'),
      }),
    ).toBe(false);
  });

  it.each([
    ['unknown version', (value: ReturnType<typeof identity>) => ({ ...value, schema_version: 2 })],
    [
      'unknown field',
      (value: ReturnType<typeof identity>) => ({ ...value, caller_complete: true }),
    ],
    [
      'missing role',
      (value: ReturnType<typeof identity>) => ({ ...value, absences: value.absences.slice(1) }),
    ],
    [
      'unknown role',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        absences: [
          ...value.absences,
          { role: 'caller-context', reason: 'supplied', authority: 'caller' },
        ],
      }),
    ],
    [
      'duplicate absence',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        absences: [...value.absences, value.absences[0]],
      }),
    ],
    [
      'duplicate dependency',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        dependencies: [...value.dependencies, value.dependencies[0]],
      }),
    ],
    [
      'conflicting role',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        absences: [...value.absences, { role: 'ticket', reason: 'absent', authority: 'caller' }],
      }),
    ],
    [
      'blank absence authority',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        absences: value.absences.map(row => ({ ...row, authority: ' ' })),
      }),
    ],
    [
      'malformed dependency digest',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        dependencies: value.dependencies.map(row => ({ ...row, semantic_digest: 'unknown' })),
      }),
    ],
    ['missing exact target', (value: ReturnType<typeof identity>) => ({ ...value, targets: [] })],
    [
      'malformed target digest',
      (value: ReturnType<typeof identity>) => ({
        ...value,
        targets: [{ ...value.targets[0], digest: 'unknown' }],
      }),
    ],
    [
      'malformed canonical contract digest',
      (value: ReturnType<typeof identity>) => ({ ...value, canonical_contract_digest: 'unknown' }),
    ],
  ])('refuses %s before the record can supply approval authority', (_name, change) => {
    const candidate = change(identity());
    expect(isPlanningReviewIdentity(candidate)).toBe(false);
  });
});
