/**
 * Unit tests for the Bash-channel ledger write predicate (ticket W42G34,
 * issue #644 G3). Pure function over a command string — no filesystem.
 *
 * detectLedgerWrite returns a { shape, path } detection when a command names
 * a tickets-namespace test-definitions.md as a write target, and undefined
 * otherwise. The allow-side tests are precision pins: they flip if the
 * predicate ever over-denies (mention ≠ mutation, source ≠ target).
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { requiresFailClosedShellGate } from '../../templates/hooks/cursor/gate-adapter.js';
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
      ['combined redirection (&>)', `echo '- [x] RED' &> ${LEDGER}`],
      ['clobbering redirection (>|)', `echo '- [x] RED' >| ${LEDGER}`],
      [
        'cp -t into the ticket directory',
        'cp -t .project/tickets/GH628F/ /tmp/test-definitions.md',
      ],
      [
        'cp -t=<dir> fused form into the ticket directory',
        'cp --target-directory=.project/tickets/GH628F/ /tmp/test-definitions.md',
      ],
      [
        'cp positional directory destination',
        `cp /tmp/test-definitions.md .project/tickets/GH628F/`,
      ],
      ['install destination', `install -m 644 /tmp/forged.md ${LEDGER}`],
      ['fd-prefixed append redirection', `echo '- [x] RED' 2>> ${LEDGER}`],
      ['fd-prefixed output redirection', `echo '- [x] RED' 1> ${LEDGER}`],
      ['subshell in-place edit', String.raw`( sed -i 's/^- \[ \] /- [x] /' ${LEDGER} )`],
      [
        'inline interpreter that only reads (over-approximate deny)',
        `python3 -c 'print(open("${LEDGER}").read())'`,
      ],
    ])('Scenario outline: %s targeting the ledger is denied', (_shape, command) => {
      expect(detectLedgerWrite(command)).toBeDefined();
    });

    it('Scenario: the detected shape and path are reported correctly', () => {
      // Pin the fields, not just "defined" — append vs output, and the exact path.
      expect(detectLedgerWrite(`printf x >> ${LEDGER}`)).toMatchObject({
        shape: 'append redirection',
        path: LEDGER,
      });
      expect(detectLedgerWrite(`echo x > ${LEDGER}`)).toMatchObject({
        shape: 'output redirection',
        path: LEDGER,
      });
      expect(detectLedgerWrite(`sed -i 's/a/b/' ${LEDGER}`)).toMatchObject({
        shape: 'sed in-place edit',
        path: LEDGER,
      });
    });

    it('Scenario: a write-shaped segment inside a compound command is denied', () => {
      expect(
        detectLedgerWrite(`git status && echo '- [x] RED' >> ${LEDGER}; echo done`),
      ).toBeDefined();
      expect(detectLedgerWrite(`echo '- [x] RED' | tee ${LEDGER} | head -1`)).toBeDefined();
    });

    it('Scenario: redirecting ledger contents to another file is allowed', () => {
      // The ledger is the read SOURCE; the write target is elsewhere. A naive
      // "path present AND redirection present" predicate over-denies exactly this.
      expect(
        detectLedgerWrite(String.raw`grep '\[x\]' ${LEDGER} > /tmp/summary.txt`),
      ).toBeUndefined();
      expect(detectLedgerWrite(`cat ${LEDGER} >> /tmp/backup.md`)).toBeUndefined();
    });

    it('Scenario: copying the ledger OUT via -t (ledger is the source) is allowed', () => {
      // With -t, the destination is the flag's directory and the ledger is a
      // SOURCE being relocated/backed up — not a checkbox mutation.
      expect(detectLedgerWrite(`mv -t /backup/ ${LEDGER}`)).toBeUndefined();
      expect(detectLedgerWrite(`cp --target-directory=/tmp ${LEDGER}`)).toBeUndefined();
    });
  });

  describe('Rule: The gate scopes to the tickets namespace', () => {
    it('Scenario: writing a test-definitions.md outside the tickets namespace is allowed', () => {
      expect(
        detectLedgerWrite('echo scaffold > /tmp/fixtures/test-definitions.md'),
      ).toBeUndefined();
      expect(
        detectLedgerWrite("sed -i 's/a/b/' docs/examples/test-definitions.md"),
      ).toBeUndefined();
    });

    it('Scenario: a suffix-colliding basename in the tickets namespace is not a ledger', () => {
      expect(
        detectLedgerWrite('echo x > .project/tickets/GH628F/my-test-definitions.md'),
      ).toBeUndefined();
    });

    it('Scenario: a ledger under the legacy .safeword-project namespace is detected', () => {
      expect(
        detectLedgerWrite('echo x > .safeword-project/tickets/GH628F/test-definitions.md'),
      ).toBeDefined();
    });
  });

  describe('Rule: Detection is conservative and its limits are documented', () => {
    it('Scenario: an obfuscated write the predicate cannot see is allowed by design', () => {
      // A variable-carried path is a documented detection limit, not a bug.
      // The done-gate's distinct-SHA validation is the backstop.
      expect(
        detectLedgerWrite(String.raw`f=${LEDGER}; sed -i 's/^- \[ \] /- [x] /' "$f"`),
      ).toBeUndefined();
      expect(detectLedgerWrite('bash tick-all-boxes.sh')).toBeUndefined();
    });

    it('Scenario: an inline interpreter that names the ledger is denied even if its code only reads', () => {
      // Deliberate over-approximation: read-vs-write inside interpreter code
      // would require simulation, which this design rejects (dimensions.md).
      expect(detectLedgerWrite(`python3 -c 'print(open("${LEDGER}").read())'`)).toBeDefined();
    });

    it('Scenario: the predicate module documents what it cannot catch', () => {
      const moduleSource = readFileSync(
        nodePath.join(import.meta.dirname, '../../templates/hooks/lib/bash-ledger-writes.ts'),
        'utf8',
      );
      // The limits block must name the undetectable forms and the backstop —
      // silence pretending completeness is the failure mode (spec SM2.AC1).
      expect(moduleSource).toMatch(/Detection limits/);
      expect(moduleSource).toMatch(/shell variables/i);
      expect(moduleSource).toMatch(/eval/);
      expect(moduleSource).toMatch(/script files/i);
      expect(moduleSource).toMatch(/done-gate/i);
      expect(moduleSource).toMatch(/backstop/i);
    });
  });

  describe('Rule: One predicate reaches all three harnesses (Cursor pre-filter)', () => {
    it("Scenario: Cursor's shell pre-filter consults the gate for ledger writes", () => {
      expect(requiresFailClosedShellGate({ command: `echo '- [x] RED' >> ${LEDGER}` })).toBe(true);
    });

    it("Scenario: Cursor's shell pre-filter does not demand the gate for a read-only command", () => {
      expect(requiresFailClosedShellGate({ command: String.raw`grep '^- \[' ${LEDGER}` })).toBe(
        false,
      );
    });
  });
});
