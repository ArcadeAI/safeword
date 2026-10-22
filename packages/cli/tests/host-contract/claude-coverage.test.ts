import { describe, expect, it } from 'vitest';

import { claudeCases } from '../fixtures/host-contract/native-contract-cases.js';

const feature = (rows: string): string => `Feature: Native coverage
  Scenario Outline: A new shared capability
    Given an installed "<host>"
    When it uses the capability
    Then the result is visible
    Examples:
      | host | version | runtime |
${rows}
`;

describe('contract-derived Claude case population', () => {
  it('derives new shared scenarios without a second authored case checklist', () => {
    expect(claudeCases(feature('      | Claude Code | 2.1.170 | CLI |'))).toMatchObject([
      { id: 'claude-2.1.170-a-new-shared-capability', stepCount: 3, runtime: 'CLI' },
    ]);
  });
  it('requires the exact independently pinned host, version and runtime', () => {
    for (const row of [
      '| Claude Code | 2.1.289 | CLI |',
      '| Claude Code | 2.1.170 | IDE |',
      '| Codex | 0.160.0 | CLI |',
    ])
      expect(() => claudeCases(feature(`      ${row}`))).toThrow(
        'No contracted Claude Code CLI cases',
      );
  });
  it('includes all four accepted Claude rows from the real feature', () => {
    expect(claudeCases().map(row => row.id)).toEqual([
      'claude-2.1.170-denied-write',
      'claude-2.1.170-allowed-write',
      'claude-2.1.170-bounded-continuation',
      'claude-2.1.170-catalogue-helper',
    ]);
  });
});
