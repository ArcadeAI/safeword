import { describe, expect, it } from 'vitest';

import { cursorCliCases } from '../fixtures/host-contract/native-contract-cases.js';

function feature(rows: string, columns = 'host | version | runtime'): string {
  return `Feature: Automatic CLI coverage
  Scenario Outline: Newly requested capability
    Given an installed "<host>"
    When it uses the capability
    Then the result is visible
    Examples:
      | ${columns} |
${rows}
`;
}

describe('contract-derived Cursor CLI case population', () => {
  it('discovers an unfamiliar scenario without a second host checklist', () => {
    const cases = cursorCliCases(feature('      | Cursor | 2026.09.28-64d2043 | CLI |'));
    expect(cases).toHaveLength(1);
    expect(cases[0]?.scenario).toBe('Newly requested capability');
    expect(cases[0]?.id).toBe('cursor-cli-2026.09.28-64d2043-newly-requested-capability');
  });

  it('keeps other runtimes and versions separate', () => {
    const cases = cursorCliCases(
      feature(
        [
          '      | Cursor | 2026.09.28-64d2043 | CLI |',
          '      | Cursor | 3.24.18 | IDE |',
          '      | Codex | 0.160.0 | CLI |',
          '      | Cursor | 2026.10.19-6bbf2c4 | CLI |',
        ].join('\n'),
      ),
    );
    expect(cases).toHaveLength(1);
    expect(cases[0]?.version).toBe('2026.09.28-64d2043');
  });

  it('preserves separately contracted example dimensions', () => {
    const cases = cursorCliCases(
      feature(
        [
          '      | Cursor | 2026.09.28-64d2043 | CLI | one |',
          '      | Cursor | 2026.09.28-64d2043 | CLI | two |',
        ].join('\n'),
        'host | version | runtime | variant',
      ),
    );
    expect(cases.map(row => row.id)).toEqual([
      'cursor-cli-2026.09.28-64d2043-newly-requested-capability-variant-one',
      'cursor-cli-2026.09.28-64d2043-newly-requested-capability-variant-two',
    ]);
  });

  it('rejects duplicate coverage identities', () => {
    const row = '      | Cursor | 2026.09.28-64d2043 | CLI |';
    expect(() => cursorCliCases(feature(`${row}\n${row}`))).toThrow(
      'Duplicate Cursor CLI case identity',
    );
  });

  it('rejects an empty applicable population', () => {
    expect(() => cursorCliCases(feature('      | Cursor | 3.24.18 | IDE |'))).toThrow(
      'No contracted Cursor CLI cases',
    );
  });
});
