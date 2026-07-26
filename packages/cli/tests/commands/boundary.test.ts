/**
 * Command tests for `safeword boundary --at commit|push` (ticket CDRJTW, #810
 * slice 1). Real temp git repos; only the process boundary is real — no
 * internal mocks. Slice 1 covers the engine core: clean pass + audit append,
 * the silence promise (TB1.AC1), and the audit record (SM1.AC3). Findings
 * tiers land in later slices with their own RED steps.
 */

import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';
import {
  AUDIT_PATH,
  boundaryTicketContent,
  createBoundaryProject,
  git,
  readAudit,
} from './boundary-helpers';

function writeIntakeFeatureTicket(dir: string, folder: string): void {
  writeTestFile(
    dir,
    `.project/tickets/${folder}/ticket.md`,
    boundaryTicketContent({ id: folder.split('-', 1)[0], phase: 'intake' }),
  );
}

describe('safeword boundary (slice 1: engine core)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createBoundaryProject();
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  describe('CDRJTW.SM1.AC1: clean evidence passes quietly and is recorded', () => {
    it('exits zero with no warnings and appends a passing audit entry', async () => {
      writeIntakeFeatureTicket(dir, 'BND001-clean');
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/warn/i);
      const entries = readAudit(dir);
      expect(entries).toHaveLength(1);
      expect(JSON.stringify(entries[0])).toContain('BND001');
      expect(entries[0]?.boundary).toBe('commit');
    });
  });

  describe('HGYGND.SM1.R2: the commit tier verifies anchors against the staged tree', () => {
    it('warns when the anchored artifact exists on disk but is not staged', async () => {
      const ticket = '.project/tickets/BND009-staged';
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({ id: 'BND009', phase: 'scenario-gate' }),
      );
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      // The anchored impl-plan lands on disk only — never `git add`ed, so the
      // staged tree the commit will ship does not contain it.
      writeTestFile(dir, `${ticket}/impl-plan.md`, '# plan on disk only\n');
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({
          id: 'BND009',
          phase: 'implement',
          anchors: [`implement: ${ticket}/impl-plan.md`],
        }),
      );
      git(dir, `add ${ticket}/ticket.md`);

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/missing/i);
    });

    it("warns when a ticket reuses another ticket's same-kind artifact", async () => {
      const ticket = '.project/tickets/BND010-owner';
      const foreignTicket = '.project/tickets/BND011-foreign';
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({ id: 'BND010', phase: 'scenario-gate' }),
      );
      writeTestFile(dir, `${foreignTicket}/impl-plan.md`, '# foreign plan\n');
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      writeTestFile(
        dir,
        `${foreignTicket}/impl-plan.md`,
        [
          '# Impl Plan: foreign',
          '',
          '**Status:** planned',
          '',
          '## Approach',
          '',
          'Foreign evidence.',
          '',
          '## Decisions',
          '',
          'skip: fixture',
          '',
          '## Arch alignment',
          '',
          'skip: fixture',
          '',
          '## Known deviations',
          '',
          'skip: fixture',
          '',
          '## Assessment triggers',
          '',
          'skip: fixture',
          '',
        ].join('\n'),
      );
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({
          id: 'BND010',
          phase: 'implement',
          anchors: [`implement: ${foreignTicket}/impl-plan.md`],
        }),
      );
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/ticket.*artifact|artifact.*ticket/i);
    });

    it('warns when an index-stage prefix aliases an existing staged artifact', async () => {
      const ticket = '.project/tickets/BND012-stage-alias';
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({ id: 'BND012', phase: 'scenario-gate' }),
      );
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      writeTestFile(
        dir,
        `${ticket}/impl-plan.md`,
        [
          '# Impl Plan: owner',
          '',
          '**Status:** planned',
          '',
          '## Approach',
          '',
          'Real evidence.',
          '',
          '## Decisions',
          '',
          'skip: fixture',
          '',
          '## Arch alignment',
          '',
          'skip: fixture',
          '',
          '## Known deviations',
          '',
          'skip: fixture',
          '',
          '## Assessment triggers',
          '',
          'skip: fixture',
          '',
        ].join('\n'),
      );
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({
          id: 'BND012',
          phase: 'implement',
          anchors: [`implement: 0:${ticket}/impl-plan.md`],
        }),
      );
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/repo-relative/i);
    });

    it("warns when a ticket reuses another ticket's feature source", async () => {
      const ticket = '.project/tickets/BND013-owner';
      const foreignFeature = 'features/another-ticket.feature';
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({ id: 'BND013', phase: 'define-behavior' }),
      );
      writeTestFile(
        dir,
        foreignFeature,
        [
          'Feature: another ticket',
          '',
          '  Scenario: foreign evidence',
          '    Then it exists',
          '',
        ].join('\n'),
      );
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({
          id: 'BND013',
          phase: 'scenario-gate',
          anchors: [`scenario-gate: ${foreignFeature}`],
        }),
      );
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/ticket/i);
    });

    it('uses the staged tree, not an unstaged removal, to identify the canonical feature', async () => {
      const ticket = '.project/tickets/BND014-owner';
      const feature = 'features/owner.feature';
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({ id: 'BND014', phase: 'define-behavior' }),
      );
      git(dir, 'add -A');
      git(dir, 'commit -m seed --quiet');
      writeTestFile(
        dir,
        feature,
        ['Feature: owner', '', '  Scenario: owned evidence', '    Then it exists', ''].join('\n'),
      );
      writeTestFile(
        dir,
        `${ticket}/ticket.md`,
        boundaryTicketContent({
          id: 'BND014',
          phase: 'scenario-gate',
          anchors: [`scenario-gate: ${feature}`],
        }),
      );
      git(dir, 'add -A');
      unlinkSync(nodePath.join(dir, feature));

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).not.toMatch(/phase-anchor/i);
    });
  });

  describe('CDRJTW.TB1.AC1: silence for changes touching no ticket artifacts', () => {
    it('a commit touching only source code produces no output and no audit entry', async () => {
      writeTestFile(dir, 'src/widget.ts', 'export const widget = 1;\n');
      git(dir, 'add -A');

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('');
      expect(readAudit(dir)).toHaveLength(0);
    });

    it('a push whose outgoing range contains no ticket-artifact changes is a silent no-op', async () => {
      const remote = createTemporaryDirectory();
      try {
        execSync('git init --bare --quiet', { cwd: remote, stdio: 'pipe' });
        git(dir, `remote add origin ${remote}`);
        git(dir, 'push -u origin HEAD --quiet');
        writeTestFile(dir, 'src/widget.ts', 'export const widget = 1;\n');
        git(dir, 'add -A');
        git(dir, 'commit -m source-only --quiet');

        const result = await runCli(['boundary', '--at', 'push'], { cwd: dir });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('');
        expect(readAudit(dir)).toHaveLength(0);
      } finally {
        removeTemporaryDirectory(remote);
      }
    });

    it('outside a safeword project the command is a silent no-op with no audit entry', async () => {
      const bare = createTemporaryDirectory();
      try {
        initGitRepo(bare);
        writeTestFile(bare, 'README.md', 'hello\n');
        execSync('git add -A', { cwd: bare, stdio: 'pipe' });

        const result = await runCli(['boundary', '--at', 'commit'], { cwd: bare });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('');
        expect(readAudit(bare)).toHaveLength(0);
      } finally {
        removeTemporaryDirectory(bare);
      }
    });
  });

  describe('CDRJTW.SM1.AC3: durable local audit record', () => {
    it('audit entries accumulate across boundary runs, one per run with boundary, commit id, and verdicts', async () => {
      writeIntakeFeatureTicket(dir, 'BND002-first');
      git(dir, 'add -A');
      await runCli(['boundary', '--at', 'commit'], { cwd: dir });
      git(dir, 'commit -m first --quiet');

      writeIntakeFeatureTicket(dir, 'BND003-second');
      git(dir, 'add -A');
      await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      const entries = readAudit(dir);
      expect(entries).toHaveLength(2);
      for (const entry of entries) {
        expect(entry.boundary).toBe('commit');
        expect(typeof entry.head).toBe('string');
        expect(JSON.stringify(entry)).toMatch(/verdict/i);
      }
    });

    it('the audit record is created on first use', async () => {
      writeIntakeFeatureTicket(dir, 'BND004-fresh');
      git(dir, 'add -A');
      expect(existsSync(nodePath.join(dir, AUDIT_PATH))).toBe(false);

      const result = await runCli(['boundary', '--at', 'commit'], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(readAudit(dir)).toHaveLength(1);
    });
  });
});
