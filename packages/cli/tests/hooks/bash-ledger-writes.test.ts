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

    it('Scenario: mentioning the ledger path without a write shape is allowed', () => {
      expect(detectLedgerWrite(`git add ${LEDGER}`)).toBeUndefined();
      expect(detectLedgerWrite(`git commit ${LEDGER} -m 'tick RED'`)).toBeUndefined();
      expect(detectLedgerWrite(`echo ${LEDGER}`)).toBeUndefined();
    });

    it.each([
      ['sed in-place editing', String.raw`sed -i 's/^- \[ \] /- [x] /' ${LEDGER}`],
      ['perl in-place editing', String.raw`perl -i -pe 's/\[ \]/[x]/' ${LEDGER}`],
      ['output redirection', `echo '- [x] RED' > ${LEDGER}`],
      ['append redirection', String.raw`printf -- '- [x] GREEN\n' >> ${LEDGER}`],
      ['tee', `echo '- [x] RED' | tee ${LEDGER}`],
      ['mv destination', `mv /tmp/forged.md ${LEDGER}`],
      ['cp destination', `cp /tmp/forged.md ${LEDGER}`],
      ['truncate', `truncate -s 0 ${LEDGER}`],
      ['inline interpreter invocation', `bun -e 'require("fs").appendFileSync("${LEDGER}", "x")'`],
    ])('Scenario outline: %s targeting the ledger is denied', (_shape, command) => {
      expect(detectLedgerWrite(command)).toBeDefined();
    });

    it('Scenario: a write-shaped segment inside a compound command is denied', () => {
      expect(
        detectLedgerWrite(`git status && echo '- [x] RED' >> ${LEDGER}; echo done`),
      ).toBeDefined();
      expect(detectLedgerWrite(`echo '- [x] RED' | tee ${LEDGER} | head -1`)).toBeDefined();
    });
  });
});
