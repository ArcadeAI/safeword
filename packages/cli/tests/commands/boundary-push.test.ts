/**
 * Push-tier scenarios for `safeword boundary` (CDRJTW slice 3, re-expressed by
 * HGYGND for artifact-content anchors). Real git history fixtures — a bare
 * remote, squash-merges, amends, shallow clones. Anchor checks read the HEAD
 * tree only; ledger tick SHAs keep their history-backed resolution. Maps to
 * features/artifact-content-phase-anchors.feature (R2/R5) and
 * features/boundary-reconciliation-gate.feature.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const RETRO_SKIPS = [
  'intake: retro',
  'define-behavior: retro',
  'scenario-gate: retro',
  'plan-implementation: retro',
];
import {
  boundaryTicketContent as ticketContent,
  createBoundaryPushFixture,
  git,
  readAudit,
  shapeValidImplPlan,
} from './boundary-helpers';

const TICKET = '.project/tickets/BNP001-fixture';
const IMPL_PLAN = `${TICKET}/impl-plan.md`;
const LEDGER = `${TICKET}/test-definitions.md`;

const MINIMAL_LEDGER = [
  '# Test Definitions',
  '',
  '### Scenario: s1',
  '',
  '- [ ] RED',
  '- [ ] GREEN',
  '- [ ] REFACTOR',
  '',
].join('\n');

function combinedOutput(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}\n${result.stderr}`;
}

function lastAuditEntry(dir: string): string {
  return JSON.stringify(readAudit(dir).at(-1));
}

describe('safeword boundary (push tier: artifact-content anchors)', () => {
  let dir: string;
  let remote: string;

  beforeEach(async () => {
    ({ dir, remote } = await createBoundaryPushFixture(
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'scenario-gate' }),
    ));
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
    removeTemporaryDirectory(remote);
  });

  /** Advance to implement anchored on an impl-plan path that was never written. */
  function commitMissingArtifactAdvance() {
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${IMPL_PLAN}`] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');
  }

  /** Advance to implement anchored on a committed shape-valid impl-plan. */
  function commitAnchoredAdvance() {
    writeTestFile(dir, IMPL_PLAN, shapeValidImplPlan());
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${IMPL_PLAN}`] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');
  }

  it('warns when the anchored artifact is missing from the pushed tree (SM1.R3)', async () => {
    commitMissingArtifactAdvance();

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).toMatch(/missing/i);
  });

  it('warns about a missing artifact but never blocks the push (TB1)', async () => {
    commitMissingArtifactAdvance();

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).toMatch(/phase-anchor/i);
  });

  it('accepts a path anchor whose artifact exists and records a passing verdict (SM1.R2)', async () => {
    commitAnchoredAdvance();

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/phase-anchor/i);
    expect(lastAuditEntry(dir)).toMatch(/phase-anchor.*pass|pass.*phase-anchor/);
  });

  it('demands only the entered phase anchor on a commitless multi-phase advance (SM1.R1)', async () => {
    writeTestFile(dir, LEDGER, MINIMAL_LEDGER);
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'verify',
        anchors: [`verify: ${LEDGER}`],
        skips: ['implement: pair-programmed live'],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m multi-advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/unanchored|missing|phase-anchor/i);
  });

  it('an amended commit does not disturb a recorded anchor (SM1.R2)', async () => {
    commitAnchoredAdvance();
    git(dir, 'commit --amend --quiet -m amended-advance');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/phase-anchor|unreachable|not reachable/i);
  });

  it('a squash-merged history still verifies at the next boundary (SM1.R2/R4)', async () => {
    // Several commits — an earlier phase anchored by a legacy hex SHA — then
    // squashed into one and pushed (the upstream a squash-merge shop has).
    const legacyHex = git(dir, 'rev-parse --short HEAD').trim();
    writeTestFile(dir, 'features/fixture.feature', 'Feature: f\n\n  Scenario: s\n    Then ok\n');
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'scenario-gate',
        anchors: [`define-behavior: ${legacyHex}`, 'scenario-gate: features/fixture.feature'],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m c1 --quiet');
    writeTestFile(dir, IMPL_PLAN, shapeValidImplPlan());
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'implement',
        anchors: [
          `define-behavior: ${legacyHex}`,
          'scenario-gate: features/fixture.feature',
          `implement: ${IMPL_PLAN}`,
        ],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m c2 --quiet');
    git(dir, 'reset --soft @{u}');
    git(dir, 'commit -m squashed --quiet');
    git(dir, 'push origin HEAD --quiet');

    // The further advance — the only outgoing commit at this boundary.
    writeTestFile(dir, LEDGER, MINIMAL_LEDGER);
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'verify',
        anchors: [
          `define-behavior: ${legacyHex}`,
          'scenario-gate: features/fixture.feature',
          `implement: ${IMPL_PLAN}`,
          `verify: ${LEDGER}`,
        ],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m further-advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/phase-anchor|unreachable|not reachable/i);
    expect(lastAuditEntry(dir)).toMatch(/phase-anchor.*pass|pass.*phase-anchor/);
  });

  it('verifies ledger SHAs from history while anchors verify from the tree (SM1.R5)', async () => {
    writeTestFile(dir, IMPL_PLAN, shapeValidImplPlan());
    writeTestFile(
      dir,
      LEDGER,
      [
        '# Test Definitions',
        '',
        '### Scenario: s1',
        '',
        '- [x] RED deadbee',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
        '',
      ].join('\n'),
    );
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${IMPL_PLAN}`] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance-with-forged-ledger --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).toMatch(/deadbee|ledger/i);
    expect(lastAuditEntry(dir)).toMatch(/phase-anchor.*pass|pass.*phase-anchor/);
  });

  it('reconciles a first push from a branch with no upstream (SM1.R3)', async () => {
    git(dir, 'checkout --quiet -b feature/no-upstream');
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).toMatch(/unanchored|phase-anchor/i);
  });
});

describe('safeword boundary (push tier: shallow clone)', () => {
  let dir: string;
  let remote: string;
  let shallow: string;

  beforeEach(async () => {
    ({ dir, remote } = await createBoundaryPushFixture(
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'scenario-gate' }),
    ));
    shallow = createTemporaryDirectory();
    git(shallow, `clone --quiet --depth 1 ${remote} .`);
    git(shallow, 'config user.email fixture@example.com');
    git(shallow, 'config user.name Fixture');
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
    removeTemporaryDirectory(remote);
    removeTemporaryDirectory(shallow);
  });

  it('a shallow clone verifies anchors with no unreachable-history hedging (SM1.R2)', async () => {
    writeTestFile(shallow, IMPL_PLAN, shapeValidImplPlan());
    writeTestFile(
      shallow,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${IMPL_PLAN}`] }),
    );
    git(shallow, 'add -A');
    git(shallow, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: shallow });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/unreachable|not reachable|shallow/i);
    expect(lastAuditEntry(shallow)).toMatch(/phase-anchor.*pass|pass.*phase-anchor/);
  });
});

describe('safeword boundary (N76NQ0: per-commit legality at push)', () => {
  let dir: string;
  let remote: string;

  beforeEach(async () => {
    ({ dir, remote } = await createBoundaryPushFixture(
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'implement',
        skips: RETRO_SKIPS,
      }),
    ));
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
    removeTemporaryDirectory(remote);
  });

  it('does not warn legality when intermediate commits traversed phases one step at a time', async () => {
    // Commit 1: implement -> verify. Commit 2: verify -> done. Endpoints read
    // implement -> done (a skip), but every commit was legal — the CDRJTW
    // false positive, caught live on this feature's own closing push.
    writeTestFile(dir, LEDGER, MINIMAL_LEDGER);
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'verify',
        anchors: [`verify: ${LEDGER}`],
        skips: RETRO_SKIPS,
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m to-verify --quiet');
    writeTestFile(dir, `${TICKET}/verify.md`, '# Verify\n\n**PR Scope:** ✅ in scope\n');
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'done',
        anchors: [`verify: ${LEDGER}`, `done: ${TICKET}/verify.md`],
        skips: RETRO_SKIPS,
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m to-done --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).not.toMatch(/one canonical step|skips work/i);
  });

  it('still warns when a single commit in the range actually jumps phases', async () => {
    writeTestFile(dir, `${TICKET}/verify.md`, '# Verify\n\n**PR Scope:** ✅ in scope\n');
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'done',
        anchors: [`done: ${TICKET}/verify.md`],
        skips: RETRO_SKIPS,
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m jump --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(combinedOutput(result)).toMatch(/one canonical step|skips work/i);
  });
});
