/**
 * Unit Tests: parseTddStep (Ticket #125)
 *
 * Tests the checkbox parser that detects RED/GREEN/REFACTOR TDD step
 * from test-definitions.md content. Covers heading level tolerance,
 * case insensitivity, and multi-scenario boundary detection.
 */

import { describe, expect, it } from 'vitest';

import { parseTddStep } from '../../../../.safeword/hooks/lib/active-ticket';

describe('parseTddStep', () => {
  describe('heading level tolerance', () => {
    it('detects active scenario under ## (h2) headings', () => {
      const content = `## Scenario: Login

- [x] RED
- [ ] GREEN
- [ ] REFACTOR`;
      expect(parseTddStep(content)).toBe('red');
    });

    it('detects active scenario under ### (h3) headings', () => {
      const content = `### Scenario: Login

- [x] RED
- [ ] GREEN
- [ ] REFACTOR`;
      expect(parseTddStep(content)).toBe('red');
    });

    it('handles mixed heading levels across scenarios', () => {
      const content = `## Scenario: Login

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Logout

- [x] RED
- [ ] GREEN
- [ ] REFACTOR`;
      expect(parseTddStep(content)).toBe('red');
    });
  });

  describe('multi-scenario boundary detection', () => {
    it('skips completed h2 scenario and finds active second scenario', () => {
      const content = `## Scenario: Login

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Scenario: Logout

- [x] RED
- [ ] GREEN
- [ ] REFACTOR`;
      expect(parseTddStep(content)).toBe('red');
    });

    it('skips completed h3 scenario and finds active second scenario', () => {
      const content = `### Scenario: Login

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Logout

- [x] RED
- [x] GREEN
- [ ] REFACTOR`;
      expect(parseTddStep(content)).toBe('green');
    });
  });

  describe('case insensitivity', () => {
    it('accepts lowercase step names', () => {
      const content = `## Scenario: Login

- [x] red
- [ ] green
- [ ] refactor`;
      expect(parseTddStep(content)).toBe('red');
    });

    it('accepts mixed case step names', () => {
      const content = `## Scenario: Login

- [x] Red
- [x] Green
- [ ] Refactor`;
      expect(parseTddStep(content)).toBe('green');
    });
  });

  describe('edge cases', () => {
    it('returns null for no checkboxes', () => {
      const content = `## Scenario: Login

Some description without checkboxes`;
      expect(parseTddStep(content)).toBeNull();
    });

    it('returns refactor when all three checked (last scenario)', () => {
      const content = `## Scenario: Login

- [x] RED
- [x] GREEN
- [x] REFACTOR`;
      expect(parseTddStep(content)).toBe('refactor');
    });

    it('returns null for flat content with no headings and no checkboxes', () => {
      expect(parseTddStep('')).toBeNull();
    });
  });
});
