import { describe, expect, it } from 'vitest';

import { codexCases } from '../fixtures/host-contract/native-contract-cases.js';

function feature(rows: string, headers = 'host | version | runtime'): string {
  return `Feature: Automatic native coverage
  Scenario Outline: Newly requested capability
    Given an installed "<host>"
    When it uses the capability
    Then the result is visible
    Examples:
      | ${headers} |
${rows}
`;
}

describe('contract-derived Codex case population', () => {
  it('includes a newly requested capability without a separate host checklist', () => {
    const cases = codexCases(feature('      | Codex | 0.160.0 | CLI |'));
    expect(cases[0]?.id).toBe('codex-0.160.0-newly-requested-capability');
    expect(cases).toHaveLength(1);
  });

  it('includes portable host-only rows at the independently pinned reference version', () => {
    const cases = codexCases(feature('      | Codex |', 'host'));
    expect(cases[0]?.version).toBe('0.160.0');
    expect(cases).toHaveLength(1);
  });

  it('does not transfer another host, runtime or version into Codex CLI coverage', () => {
    const source = feature(
      [
        '      | Codex | 0.160.0 | CLI |',
        '      | Codex | 0.163.0 | CLI |',
        '      | Codex | 0.160.0 | IDE |',
        '      | Cursor | 3.24.18 | IDE |',
      ].join('\n'),
    );
    expect(codexCases(source)).toHaveLength(1);
  });

  it('rejects missing and duplicate required populations', () => {
    expect(() => codexCases(feature('      | Cursor | 3.24.18 | IDE |'))).toThrow(
      'No contracted Codex CLI cases',
    );
    const row = '      | Codex | 0.160.0 | CLI |';
    expect(() => codexCases(feature(`${row}\n${row}`))).toThrow(
      'Duplicate Codex CLI case identity',
    );
  });

  it('requires portable, catalogue, both write dispositions and continuation in the actual source', () => {
    expect(codexCases().map(row => row.id)).toEqual([
      'codex-0.160.0-denied-write',
      'codex-0.160.0-allowed-write',
      'codex-0.160.0-bounded-continuation',
      'codex-0.160.0-catalogue-helper',
      'codex-0.160.0-portable-components',
    ]);
  });
});
