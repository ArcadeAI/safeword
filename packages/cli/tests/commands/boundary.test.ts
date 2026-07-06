/**
 * Command tests for `safeword boundary --at commit|push` (ticket CDRJTW, #810
 * slice 1). Real temp git repos; only the process boundary is real — no
 * internal mocks. Slice 1 covers the engine core: clean pass + audit append,
 * the silence promise (TB1.AC1), and the audit record (SM1.AC3). Findings
 * tiers land in later slices with their own RED steps.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const AUDIT_PATH = '.safeword/boundary-audit.jsonl';

function git(dir: string, command: string): void {
  execSync(`git ${command}`, { cwd: dir, stdio: 'pipe' });
}

/** Read parsed audit entries, or [] when the record doesn't exist yet. */
function readAudit(dir: string): Record<string, unknown>[] {
  const auditFile = nodePath.join(dir, AUDIT_PATH);
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

function writeIntakeFeatureTicket(dir: string, folder: string): void {
  writeTestFile(
    dir,
    `.project/tickets/${folder}/ticket.md`,
    [
      '---',
      `id: ${folder.split('-', 1)[0]}`,
      'type: feature',
      'phase: intake',
      'status: in_progress',
      '---',
      '',
      '# Fixture feature',
      '',
    ].join('\n'),
  );
}

describe('safeword boundary (slice 1: engine core)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = createTemporaryDirectory();
    await createConfiguredProject(dir);
    git(dir, 'add -A');
    git(dir, 'commit -m baseline --quiet');
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
