/**
 * Integration tests for the replan-on-resume I/O shell (ticket 153, design B).
 * Exercises the real git + fs path: a tmp repo with a ticket and a sibling
 * commit, asserting evaluateReplan surfaces (or stays silent) and returns the
 * HEAD to record. The pure decision logic is unit-tested in
 * replan-relevance.test.ts; this proves the gathering + wiring.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evaluateReplan } from '../../templates/hooks/lib/replan.js';
import { createTemporaryDirectory, initGitRepo, removeTemporaryDirectory } from '../helpers.js';

describe('evaluateReplan (integration)', () => {
  let directory: string;

  beforeEach(() => {
    directory = createTemporaryDirectory();
    initGitRepo(directory);
  });

  afterEach(() => {
    removeTemporaryDirectory(directory);
  });

  /** Write a ticket.md with a past last_modified and the given body. */
  function writeTicket(folder: string, body: string): void {
    const ticketDirectory = nodePath.join(directory, '.safeword-project', 'tickets', folder);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      `---\nid: ${folder}\nstatus: in_progress\ntype: task\nlast_modified: 2020-01-01T00:00:00Z\n---\n\n${body}\n`,
    );
  }

  /** Commit a file at `relativePath` — the "sibling work" since last_modified. */
  function commitFile(relativePath: string): void {
    const absolute = nodePath.join(directory, relativePath);
    mkdirSync(nodePath.dirname(absolute), { recursive: true });
    writeFileSync(absolute, 'export const x = 1;\n');
    execSync(`git add ${relativePath} && git commit -m "sibling work"`, {
      cwd: directory,
      stdio: 'pipe',
    });
  }

  it('surfaces an opt-in heads-up when a sibling commit touched a referenced path', () => {
    writeTicket('T1', 'Scope: see [the module](packages/app/src/).');
    commitFile('packages/app/src/foo.ts');

    const result = evaluateReplan(directory, 'T1', 'task');
    expect(result?.line).toContain('Resume check');
    expect(result?.headSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('does not re-fire once that HEAD has already been prompted', () => {
    writeTicket('T1', 'Scope: see [the module](packages/app/src/).');
    commitFile('packages/app/src/foo.ts');

    const first = evaluateReplan(directory, 'T1', 'task');
    expect(first).not.toBeNull();
    expect(evaluateReplan(directory, 'T1', 'task', first?.headSha)).toBeNull();
  });

  it('stays silent for an epic ticket', () => {
    writeTicket('T1', 'Scope: see [the module](packages/app/src/).');
    commitFile('packages/app/src/foo.ts');

    expect(evaluateReplan(directory, 'T1', 'epic')).toBeNull();
  });

  it('stays silent when the ticket references no paths', () => {
    writeTicket('T2', 'Scope: a behavior change with no file paths named.');
    commitFile('packages/app/src/foo.ts');

    expect(evaluateReplan(directory, 'T2', 'task')).toBeNull();
  });

  it('stays silent when the sibling commit touched no referenced path', () => {
    writeTicket('T3', 'Scope: see [the module](packages/other/lib/).');
    commitFile('packages/app/src/foo.ts');

    expect(evaluateReplan(directory, 'T3', 'task')).toBeNull();
  });

  it('stays silent when the ticket file is missing', () => {
    commitFile('packages/app/src/foo.ts');
    expect(evaluateReplan(directory, 'NOPE', 'task')).toBeNull();
  });

  describe('blocker-moved (E11N48)', () => {
    function writeTicketRaw(folder: string, frontmatterLines: string[], body = ''): void {
      const ticketDirectory = nodePath.join(directory, '.safeword-project', 'tickets', folder);
      mkdirSync(ticketDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        `---\n${frontmatterLines.join('\n')}\nlast_modified: 2020-01-01T00:00:00Z\n---\n\n${body}\n`,
      );
    }
    function commitTicket(folder: string): void {
      const relativePath = `.safeword-project/tickets/${folder}/ticket.md`;
      execSync(`git add ${relativePath} && git commit -m "blocker change"`, {
        cwd: directory,
        stdio: 'pipe',
      });
    }

    it('surfaces a blocker-moved heads-up when a terminal depends_on target moved', () => {
      writeTicketRaw('DEP', ['id: DEP', 'status: in_progress', 'type: task', 'depends_on: [BLK]']);
      writeTicketRaw('BLK', ['id: BLK', 'slug: the-blocker', 'status: done', 'type: task']);
      commitTicket('BLK');

      const result = evaluateReplan(directory, 'DEP', 'task');
      expect(result?.line.toLowerCase()).toContain('blocker');
      expect(result?.line).toContain('the-blocker (BLK)');
      expect(result?.line.toLowerCase()).toContain('check the plan');
    });

    it('stays silent when the depends_on target is not terminal', () => {
      writeTicketRaw('DEP', ['id: DEP', 'status: in_progress', 'type: task', 'depends_on: [BLK]']);
      writeTicketRaw('BLK', ['id: BLK', 'slug: the-blocker', 'status: in_progress', 'type: task']);
      commitTicket('BLK');

      expect(evaluateReplan(directory, 'DEP', 'task')).toBeNull();
    });

    it('stays silent when the terminal blocker ticket.md is not in the window', () => {
      writeTicketRaw('DEP', ['id: DEP', 'status: in_progress', 'type: task', 'depends_on: [BLK]']);
      writeTicketRaw('BLK', ['id: BLK', 'slug: the-blocker', 'status: done', 'type: task']);
      commitFile('packages/app/src/foo.ts'); // commit something else; blocker ticket.md uncommitted

      expect(evaluateReplan(directory, 'DEP', 'task')).toBeNull();
    });
  });
});
