/**
 * Unit Tests: scenario-format (Ticket #121)
 *
 * Tests the GFM checkbox detection used by the stop hook to enforce
 * the test-definitions.md format contract. Pure-function tests — no
 * spawn, no transcript, no hook harness.
 */

import { describe, expect, it } from 'vitest';

import { analyzeScenarioFormat } from '../../../../.safeword/hooks/lib/scenario-format';

describe('analyzeScenarioFormat', () => {
  it('counts both checked and unchecked boxes', () => {
    const result = analyzeScenarioFormat('## Rule\n\n- [x] One\n- [ ] Two\n- [x] Three\n');
    expect(result.checked).toBe(2);
    expect(result.unchecked).toBe(1);
    expect(result.isUnrecognized).toBe(false);
  });

  it('treats - [X] (uppercase) the same as - [x]', () => {
    const result = analyzeScenarioFormat('- [X] One\n- [x] Two\n');
    expect(result.checked).toBe(2);
    expect(result.unchecked).toBe(0);
  });

  it('counts indented (nested) checkboxes', () => {
    const result = analyzeScenarioFormat('- [ ] Parent\n  - [x] Child\n    - [ ] Grandchild\n');
    expect(result.checked).toBe(1);
    expect(result.unchecked).toBe(2);
  });

  it('flags legacy prose (> 50 chars, no checkboxes) as unrecognized', () => {
    const legacy = [
      '# Test Definitions',
      '',
      '## Scenario: Legacy format',
      '',
      'Given some setup',
      'When action happens',
      'Then outcome is observed',
    ].join('\n');
    const result = analyzeScenarioFormat(legacy);
    expect(result.isUnrecognized).toBe(true);
    expect(result.checked).toBe(0);
    expect(result.unchecked).toBe(0);
  });

  it('does NOT flag stub / near-empty content (<= 50 chars) as unrecognized', () => {
    const result = analyzeScenarioFormat('# Test Definitions\n');
    expect(result.isUnrecognized).toBe(false);
  });

  it('does NOT flag content with at least one checkbox, even amidst prose', () => {
    const mixed = [
      '# Definitions',
      '',
      'Some prose describing intent that is clearly long enough to exceed the threshold.',
      '',
      '- [x] Done item',
    ].join('\n');
    const result = analyzeScenarioFormat(mixed);
    expect(result.isUnrecognized).toBe(false);
    expect(result.checked).toBe(1);
  });
});
