/**
 * Unit tests for the done-gate annotation ledger validator (ticket J7VBGJ,
 * Rules 3 + 4). Pure function over test-definitions.md content + an injected
 * SHA-reachability oracle (so tests don't need real git).
 *
 * Returns { ok, errors[] }. The wiring layer in stop-quality.ts calls the
 * real `git cat-file -e <sha>^{commit}` to provide the oracle.
 */

import { describe, expect, it } from 'vitest';

import { validateLedger } from '../../templates/hooks/lib/ledger-validation.js';

const allReachable = (_sha: string) => true;

function content(scenarios: string, crossScenario = '- [x] cross-scenario abc1234'): string {
  return [
    '# Test definitions',
    '',
    '## Rule: Example',
    '',
    scenarios,
    '',
    '## Feature-level cross-scenario refactor',
    '',
    crossScenario,
    '',
  ].join('\n');
}

describe('validateLedger — Rule 3 (per-scenario SHA validity)', () => {
  it('Scenario T1: three distinct, HEAD-reachable SHAs passes', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('Scenario T-inject: a SHA carrying shell metacharacters is rejected and never reaches the oracle', () => {
    const seen: string[] = [];
    const recordingOracle = (sha: string) => {
      seen.push(sha);
      return true;
    };
    const malicious = 'abc1234"; touch pwned; #';
    const c = content(
      [
        '### Scenario: foo',
        '',
        `- [x] RED ${malicious}`,
        '- [x] GREEN def5678',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
    );
    const result = validateLedger(c, recordingOracle);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/not a valid commit SHA/i);
    // The malformed value is rejected by format before the git oracle sees it —
    // the wiring layer's git call (execFileSync) would also pass it literally.
    expect(seen).not.toContain(malicious);
  });

  it('Scenario T2: RED and GREEN sharing one SHA fails, naming the scenario', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN abc1234',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('foo');
    expect(result.errors.join('\n')).toMatch(/colli[sz]/i);
  });

  it('Scenario T3: SHA unreachable from HEAD fails, naming the SHA', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR deadbeef',
      ].join('\n'),
    );
    const result = validateLedger(c, sha => sha !== 'deadbeef');
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('deadbeef');
    expect(result.errors.join('\n')).toMatch(/reach/i);
  });

  it('Scenario T4: one real SHA and two skip:reason entries passes', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN skip: already covered by another scenario',
        '- [x] REFACTOR skip: no structural improvement needed',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('Scenario T5: three skip: entries fails (no real SHA)', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED skip: rationale 1',
        '- [x] GREEN skip: rationale 2',
        '- [x] REFACTOR skip: rationale 3',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('foo');
    expect(result.errors.join('\n')).toMatch(/no commits|all.*skipped/i);
  });

  it('rejects a skip with empty reason at done', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR skip:',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/empty.*reason|reason.*empty/i);
  });
});

describe('validateLedger — Rule 4 (feature-level cross-scenario refactor row)', () => {
  it('Scenario T6: cross-scenario row with SHA at done passes', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
      '- [x] cross-scenario fff9999',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });

  it('Scenario T7: cross-scenario row with skip:reason at done passes', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
      '- [x] cross-scenario skip: no shared fixtures emerged',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });

  it('Scenario T8: missing cross-scenario row fails done', () => {
    const c = [
      '# Test definitions',
      '',
      '## Rule: Example',
      '',
      '### Scenario: foo',
      '',
      '- [x] RED abc1234',
      '- [x] GREEN def5678',
      '- [x] REFACTOR 9abcdef',
      '',
    ].join('\n');
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/cross-scenario/i);
    expect(result.errors.join('\n')).toMatch(/missing/i);
  });

  it('Scenario T9: cross-scenario row with empty skip reason fails done', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR 9abcdef',
      ].join('\n'),
      '- [x] cross-scenario skip:',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/empty.*reason|reason.*empty/i);
  });
});

describe('validateLedger — multiple scenarios', () => {
  it('reports errors for every failing scenario', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN abc1234',
        '- [x] REFACTOR 9abcdef',
        '',
        '### Scenario: bar',
        '',
        '- [x] RED skip: r1',
        '- [x] GREEN skip: r2',
        '- [x] REFACTOR skip: r3',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('foo');
    expect(result.errors.join('\n')).toContain('bar');
  });

  it('allows mixed scenarios where each individually passes', () => {
    const c = content(
      [
        '### Scenario: foo',
        '',
        '- [x] RED abc1234',
        '- [x] GREEN def5678',
        '- [x] REFACTOR skip: trivial',
        '',
        '### Scenario: bar',
        '',
        '- [x] RED 111aaaa',
        '- [x] GREEN 222bbbb',
        '- [x] REFACTOR 333cccc',
      ].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });
});

describe('validateLedger — W610WW loop-count gating', () => {
  // Build content with an explicit list of scenario blocks and an optional
  // cross-scenario row, so the loop count (scenarios.length) is exact.
  function withScenarios(scenarios: string[], crossScenario?: string): string {
    return [
      '# Test definitions',
      '',
      '## Rule: Example',
      '',
      scenarios.join('\n\n'),
      '',
      '## Feature-level cross-scenario refactor',
      '',
      ...(crossScenario === undefined ? [] : [crossScenario, '']),
    ].join('\n');
  }

  const annotatedLoop = (name: string) =>
    [
      `### Scenario: ${name}`,
      '',
      '- [x] RED abc1234',
      '- [x] GREEN def5678',
      '- [x] REFACTOR skip: trivial',
    ].join('\n');

  it('a single annotated loop is exempt despite the annotation (no row required)', () => {
    const c = withScenarios([annotatedLoop('only')]); // 1 loop, no cross-scenario row
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('a ticket with zero parsed scenarios needs no row', () => {
    const c = withScenarios([]); // 0 loops, no row
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });

  it('exactly two annotated loops with no row fails (row required at the boundary)', () => {
    const c = withScenarios([annotatedLoop('one'), annotatedLoop('two')]);
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/cross-scenario/i);
    expect(result.errors.join('\n')).toMatch(/missing/i);
  });

  it('exactly two annotated loops with a reachable SHA row passes', () => {
    const c = withScenarios(
      [annotatedLoop('one'), annotatedLoop('two')],
      '- [x] cross-scenario fff9999',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });

  it('a multi-scenario ticket with no annotations stays exempt (no row)', () => {
    const legacy = (name: string) =>
      [`### Scenario: ${name}`, '', '- [x] RED', '- [x] GREEN', '- [x] REFACTOR'].join('\n');
    const c = withScenarios([legacy('a'), legacy('b'), legacy('c')]); // 3 loops, unannotated, no row
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });

  it('a single-loop ticket with a present empty-skip row is still blocked', () => {
    const c = withScenarios([annotatedLoop('only')], '- [x] cross-scenario skip:');
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/empty.*reason|reason.*empty/i);
  });

  it('a two-loop ticket with an empty skip row is blocked', () => {
    const c = withScenarios(
      [annotatedLoop('one'), annotatedLoop('two')],
      '- [x] cross-scenario skip:',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/empty.*reason|reason.*empty/i);
  });

  it('a two-loop ticket with a real skip reason passes', () => {
    const c = withScenarios(
      [annotatedLoop('one'), annotatedLoop('two')],
      '- [x] cross-scenario skip: no shared duplication emerged',
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });
});

describe('validateLedger — legacy compatibility', () => {
  it('silently allows pre-existing bare [x] checkboxes (no annotation)', () => {
    // Legacy ticket from before this feature shipped.
    const c = content(
      ['### Scenario: legacy', '', '- [x] RED', '- [x] GREEN', '- [x] REFACTOR'].join('\n'),
    );
    const result = validateLedger(c, allReachable);
    expect(result.ok).toBe(true);
  });
});
