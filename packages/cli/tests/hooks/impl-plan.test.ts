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
