/**
 * Slice 2: commit-tier finding scenarios for `safeword boundary` (CDRJTW).
 * Same real-git harness as boundary.test.ts. Each test maps to a scenario in
 * features/boundary-reconciliation-gate.feature under SM1.AC1 / TB1.AC2.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removeTemporaryDirectory, runCli, writeTestFile } from '../helpers';
import {
  boundaryTicketContent as ticketContent,
  createBoundaryProject,
  git,
  readAudit,
} from './boundary-helpers';

describe('safeword boundary (slice 2: commit-tier findings)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createBoundaryProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  const TICKET = '.project/tickets/BNF001-fixture';

  it('warns and records a staged forward advance with no anchor (SM1.AC1)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/phase-anchor|unanchored/i);
    const entries = readAudit(dir);
    expect(JSON.stringify(entries.at(-1))).toMatch(/warn/);
  });

  it('warns when a ticket at rest was born past intake and its folder is touched (SM1.AC1 / #675)', async () => {
    // Ticket committed already sitting at implement, never traversed: no anchors, no skips.
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    // Touch a sibling artifact only — ticket.md itself is NOT in the change.
    writeTestFile(dir, `${TICKET}/spec.md`, '# Spec\n');
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/born past intake|birth/i);
  });

  it('does not flag born-past-intake when phase_skips justify the birth (negative)', async () => {
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'implement',
        skips: [
          'intake: retro-scoped in PR review',
          'define-behavior: scenarios exist as tests',
          'scenario-gate: reviewed on the PR thread',
          'plan-implementation: plan captured in PR description',
        ],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(dir, `${TICKET}/spec.md`, '# Spec\n');
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/born past intake|birth/i);
  });

  it('warns on unparseable frontmatter without crashing (SM1.AC1)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'intake' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(dir, `${TICKET}/ticket.md`, '---\n{ not yaml [\n%%%\n---\n\n# Fixture\n');
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/classif|frontmatter/i);
  });

  it('warns when a feature at plan-implementation has no ledger (TXRHMD)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'scenario-gate' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'plan-implementation', anchors: ['plan-implementation: a1b2c3d'] }),
    );
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /ledger.*missing|missing.*ledger|no test-definitions/i,
    );
  });

  it('warns when a feature past define-behavior has no ledger at all (SM1.AC1)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'implement',
        anchors: ['implement: .project/tickets/BNF001-fixture/impl-plan.md'],
      }),
    );
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /ledger.*missing|missing.*ledger|no test-definitions/i,
    );
  });

  it.each(['verify.md', 'impl-plan.md'])(
    'warns naming %s when its shape check fails (SM1.AC1 outline)',
    async artifact => {
      writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'intake' }));
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      writeTestFile(dir, `${TICKET}/${artifact}`, '# Not a valid artifact\n\njust prose\n');
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(artifact);
    },
  );

  it('warns about a malformed ledger annotation (SM1.AC1)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'intake' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(
      dir,
      `${TICKET}/test-definitions.md`,
      [
        '# Test Definitions',
        '',
        '### Scenario: s1',
        '',
        '- [x] RED not-a-sha!',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
        '',
      ].join('\n'),
    );
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/ledger|annotation|SHA/i);
  });

  it('groups verdicts per ticket and warns only about the finding ticket (SM1.AC1)', async () => {
    writeTestFile(
      dir,
      '.project/tickets/BNF002-clean/ticket.md',
      ticketContent({ phase: 'intake' }),
    );
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(dir, '.project/tickets/BNF002-clean/spec.md', '# Spec\n');
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/BNF001/);
    // The clean ticket appears in the audit verdicts but not in warnings.
    const warningLines = combined.split('\n').filter(line => /warn|⚠/i.test(line));
    expect(warningLines.join('\n')).not.toMatch(/BNF002/);
    const lastEntry = JSON.stringify(readAudit(dir).at(-1));
    expect(lastEntry).toMatch(/BNF001/);
    expect(lastEntry).toMatch(/BNF002/);
  });

  it('reconciles a mixed commit of source files and a ticket artifact — silence loses (SM1.AC1)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    writeTestFile(dir, 'src/widget.ts', 'export const widget = 1;\n');
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/unanchored|phase-anchor/i);
  });

  it('prints every finding, records one audit entry, and still exits zero on a multi-finding commit (TB1.AC2)', async () => {
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m seed --quiet');
    // Three findings at once: unanchored advance + bad ledger annotation + bad verify.md.
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    writeTestFile(
      dir,
      `${TICKET}/test-definitions.md`,
      ['# Test Definitions', '', '### Scenario: s1', '', '- [x] RED not-a-sha!', ''].join('\n'),
    );
    writeTestFile(dir, `${TICKET}/verify.md`, '# no pr scope line\n');
    git(dir, 'add -A');

    const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/unanchored|phase-anchor/i);
    expect(combined).toMatch(/ledger|annotation/i);
    expect(combined).toMatch(/verify\.md/);
    const entries = readAudit(dir);
    expect(entries).toHaveLength(1);
  });
});
