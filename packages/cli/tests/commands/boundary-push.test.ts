/**
 * Slice 3: push-tier scenarios for `safeword boundary` (CDRJTW). Real git
 * history fixtures — a bare remote, rebases, orphaned SHAs. Maps to SM1.AC2 /
 * TB1.AC2 scenarios in features/boundary-reconciliation-gate.feature.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const AUDIT_PATH = '.safeword/boundary-audit.jsonl';
const TICKET = '.project/tickets/BNP001-fixture';

function git(dir: string, command: string): string {
  return execSync(`git ${command}`, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
}

function readAudit(dir: string): Record<string, unknown>[] {
  const auditFile = nodePath.join(dir, AUDIT_PATH);
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

function ticketContent(options: { phase: string; anchors?: string[]; skips?: string[] }): string {
  const lines = [
    '---',
    'id: ZZBNP',
    'type: feature',
    `phase: ${options.phase}`,
    'status: in_progress',
  ];
  if (options.anchors) {
    lines.push('phase_anchors:');
    for (const entry of options.anchors) lines.push(`  - ${entry}`);
  }
  if (options.skips) {
    lines.push('phase_skips:');
    for (const entry of options.skips) lines.push(`  - ${entry}`);
  }
  lines.push('---', '', '# Fixture', '');
  return lines.join('\n');
}

describe('safeword boundary (slice 3: push tier)', () => {
  let dir: string;
  let remote: string;

  beforeEach(async () => {
    dir = createTemporaryDirectory();
    remote = createTemporaryDirectory();
    await createConfiguredProject(dir);
    execSync('git init --bare --quiet', { cwd: remote, stdio: 'pipe' });
    git(dir, `remote add origin ${remote}`);
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'define-behavior' }));
    git(dir, 'add -A');
    git(dir, 'commit -m baseline --quiet');
    git(dir, 'push -u origin HEAD --quiet');
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
    removeTemporaryDirectory(remote);
  });

  it('warns when a well-formed anchor is unreachable, naming forge and shallow clone (SM1.AC2)', async () => {
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: ['implement: deadbee'] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).toMatch(/not reachable|unreachable/i);
    expect(combined).toMatch(/forge/i);
    expect(combined).toMatch(/shallow/i);
  });

  it('warns about unreachable evidence but never blocks the push (TB1.AC2)', async () => {
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: ['implement: deadbee'] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/not reachable|unreachable/i);
  });

  it('accepts a reachable anchor and records a passing reachability verdict (SM1.AC2)', async () => {
    const anchor = git(dir, 'rev-parse --short HEAD').trim();
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${anchor}`] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/unreachable|not reachable/i);
    const lastEntry = JSON.stringify(readAudit(dir).at(-1));
    expect(lastEntry).toMatch(/phase-anchor.*pass|pass.*phase-anchor/);
  });

  it('demands only the entered phase anchor on a commitless multi-phase advance (SM1.AC2)', async () => {
    const anchor = git(dir, 'rev-parse --short HEAD').trim();
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({
        phase: 'verify',
        anchors: [`verify: ${anchor}`],
        skips: ['scenario-gate: reviewed on the PR thread', 'implement: pair-programmed live'],
      }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m multi-advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(
      /unanchored|unreachable|not reachable/i,
    );
  });

  it('verifies anchors across a rebase via patch-id canonicalization (SM1.AC2)', async () => {
    // Work commit whose SHA the anchor records.
    writeTestFile(dir, 'src/work.ts', 'export const work = 1;\n');
    git(dir, 'add -A');
    git(dir, 'commit -m work --quiet');
    const originalSha = git(dir, 'rev-parse --short HEAD').trim();
    writeTestFile(
      dir,
      `${TICKET}/ticket.md`,
      ticketContent({ phase: 'implement', anchors: [`implement: ${originalSha}`] }),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    // Rewrite history: amend a NEW baseline commit under the two commits via
    // rebase --onto a tweaked base, orphaning originalSha but keeping its patch.
    const base = git(dir, 'rev-parse HEAD~2').trim();
    git(dir, `checkout --quiet -b rebase-target ${base}`);
    writeTestFile(dir, 'docs/note.md', 'note\n');
    git(dir, 'add -A');
    git(dir, 'commit -m new-base --quiet');
    const newBase = git(dir, 'rev-parse HEAD').trim();
    git(dir, 'checkout --quiet -');
    git(dir, `rebase --quiet --onto ${newBase} ${base}`);

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/unreachable|not reachable/i);
  });

  it('verifies ledger step SHAs against pushed history (SM1.AC2)', async () => {
    const real = git(dir, 'rev-parse --short HEAD').trim();
    writeTestFile(
      dir,
      `${TICKET}/test-definitions.md`,
      [
        '# Test Definitions',
        '',
        '### Scenario: s1',
        '',
        `- [x] RED ${real}`,
        '- [x] GREEN deadbee',
        '- [ ] REFACTOR',
        '',
      ].join('\n'),
    );
    git(dir, 'add -A');
    git(dir, 'commit -m ledger --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/deadbee|ledger/i);
  });

  it('reconciles a first push from a branch with no upstream (SM1.AC2)', async () => {
    git(dir, 'checkout --quiet -b feature/no-upstream');
    writeTestFile(dir, `${TICKET}/ticket.md`, ticketContent({ phase: 'implement' }));
    git(dir, 'add -A');
    git(dir, 'commit -m advance --quiet');

    const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/unanchored|phase-anchor/i);
  });
});
