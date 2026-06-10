/**
 * Unit tests for the impl-plan parser + section validation (ticket XDNSZA).
 * Covers test-definitions.md Rules 1-2. Pure functions — no filesystem.
 */

import { describe, expect, it } from 'vitest';

import { parseImplPlan } from '../../templates/hooks/lib/impl-plan.js';

const FIVE_SECTIONS = `## Approach

Build the thing in one slice.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Storage  | File   | DB                      | Overkill         |

## Arch alignment

Honors the sibling-artifact pattern.

## Known deviations

None.

## Assessment triggers

Revisit past 10x load.
`;

function plan(status: string, body: string = FIVE_SECTIONS): string {
  return `# Impl Plan: x\n\n**Status:** ${status}\n\n${body}`;
}

describe('parseImplPlan status lifecycle (Rule 1)', () => {
  it('reports status planned', () => {
    const result = parseImplPlan(plan('planned'));
    expect(result.status).toBe('planned');
  });

  it('reports status implemented', () => {
    const result = parseImplPlan(plan('implemented'));
    expect(result.status).toBe('implemented');
  });

  it('reports a validation error when the status line is missing', () => {
    const result = parseImplPlan(`# Impl Plan: x\n\n${FIVE_SECTIONS}`);
    expect(result.status).toBeNull();
    expect(result.errors.some(error => error.includes('**Status:**'))).toBe(true);
  });

  it('reports a validation error listing allowed values for an unknown status', () => {
    const result = parseImplPlan(plan('shipped'));
    expect(result.status).toBeNull();
    expect(
      result.errors.some(error => error.includes('planned') && error.includes('implemented')),
    ).toBe(true);
  });
});

const SECTION_BODIES: Record<string, string> = {
  Approach: 'Build the thing in one slice.',
  Decisions:
    '| Decision | Choice | Alternatives considered | Rejected because |\n| - | - | - | - |\n| Storage | File | DB | Overkill |',
  'Arch alignment': 'Honors the sibling-artifact pattern.',
  'Known deviations': 'None.',
  'Assessment triggers': 'Revisit past 10x load.',
};

/** The five sections with selected bodies overridden (empty string = blank section). */
function sectionsWith(overrides: Record<string, string> = {}): string {
  return Object.entries({ ...SECTION_BODIES, ...overrides })
    .map(([name, body]) => (body === '' ? `## ${name}\n` : `## ${name}\n\n${body}\n`))
    .join('\n');
}

describe('parseImplPlan section validation (Rule 2)', () => {
  it('reports a populated section as satisfied', () => {
    const result = parseImplPlan(plan('planned'));
    expect(result.sections.Decisions?.satisfied).toBe(true);
    expect(result.sections.Decisions?.skip).toBeNull();
  });

  it('reports a skip-annotated section as satisfied with its reason preserved', () => {
    const result = parseImplPlan(
      plan('planned', sectionsWith({ 'Arch alignment': 'skip: no ADRs in this project yet' })),
    );
    expect(result.sections['Arch alignment']?.satisfied).toBe(true);
    expect(result.sections['Arch alignment']?.skip).toBe('no ADRs in this project yet');
    expect(result.errors).toEqual([]);
  });
});
