import { describe, expect, it } from 'vitest';

import {
  openCodeV2Cases,
  openCodeV2GuardCases,
} from '../fixtures/host-contract/native-contract-cases.js';

function feature(rows: string): string {
  return `Feature: Native guard component
  Scenario Outline: A denied action has no side effect
    Given an installed "<host>"
    When it uses the capability
    Then the result is visible
    Examples:
      | host | version | runtime |
${rows}
`;
}

describe('OpenCode V2 initial guard component population', () => {
  it('derives guard, allowed contrast and catalogue rows in actual feature order', () => {
    const cases = openCodeV2Cases();
    expect(cases.map(row => row.line)).toEqual(
      cases.map(row => row.line).toSorted((left, right) => left - right),
    );
    expect(
      cases.filter(row => row.id.endsWith('-catalogue-helper')).map(row => row.runtime),
    ).toEqual(['CLI', 'TUI']);
    expect(cases.filter(row => row.id.endsWith('-allowed-write')).map(row => row.runtime)).toEqual([
      'CLI',
      'TUI',
    ]);
  });
  it('keeps the two actual runtime rows separate', () => {
    expect(openCodeV2GuardCases().map(row => row.id)).toEqual([
      'opencode-v2-2.0.32-cli-denied-write',
      'opencode-v2-2.0.32-tui-denied-write',
    ]);
  });
  it('does not substitute V1 or an upgraded V2 for an exact target', () => {
    const rows = [
      '      | OpenCode V1 | 1.18.23 | CLI |',
      '      | OpenCode V2 | 2.1.2 | CLI |',
      '      | OpenCode V2 | 2.0.32 | CLI |',
      '      | OpenCode V2 | 2.0.32 | TUI |',
    ].join('\n');
    expect(openCodeV2GuardCases(feature(rows))).toHaveLength(2);
  });
  it('requires both runtimes and rejects duplicate rows', () => {
    const cli = '      | OpenCode V2 | 2.0.32 | CLI |';
    const tui = '      | OpenCode V2 | 2.0.32 | TUI |';
    expect(() => openCodeV2GuardCases(feature(cli))).toThrow('No contracted OpenCode V2 TUI cases');
    expect(() => openCodeV2GuardCases(feature(`${cli}\n${cli}\n${tui}`))).toThrow(
      'Duplicate OpenCode V2 CLI case identity',
    );
  });
});
