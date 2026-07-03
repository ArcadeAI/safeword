/**
 * Unit tests for the Bash-channel ledger write predicate (ticket W42G34,
 * issue #644 G3). Pure function over a command string — no filesystem.
 *
 * detectLedgerWrite returns a { shape, path } detection when a command names
 * a tickets-namespace test-definitions.md as a write target, and undefined
 * otherwise. The allow-side tests are precision pins: they flip if the
 * predicate ever over-denies (mention ≠ mutation, source ≠ target).
 */

import { describe, expect, it } from 'vitest';

import { detectLedgerWrite } from '../../templates/hooks/lib/bash-ledger-writes.js';

const LEDGER = '.project/tickets/GH628F/test-definitions.md';

describe('detectLedgerWrite', () => {
  describe('Rule: Only write-shaped references to a ledger file are denied', () => {
    it('Scenario: a read-only reference to the ledger is allowed', () => {
      expect(detectLedgerWrite(String.raw`grep '^- \[' ${LEDGER}`)).toBeUndefined();
      expect(detectLedgerWrite(`cat ${LEDGER}`)).toBeUndefined();
      expect(detectLedgerWrite(`git diff ${LEDGER}`)).toBeUndefined();
    });

    it('Scenario: a command with no ledger reference is allowed', () => {
      expect(detectLedgerWrite('npx vitest run tests/integration/foo.test.ts')).toBeUndefined();
      expect(detectLedgerWrite("sed -i 's/a/b/' src/index.ts")).toBeUndefined();
      expect(detectLedgerWrite('echo done > /tmp/log.txt')).toBeUndefined();
    });
  });
});
