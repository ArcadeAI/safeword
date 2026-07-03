/**
 * Integration test for the MBGQ89 blocked_on hard gate, wired into the real
 * pre-tool-quality hook (always-on). A ticket.md edit that advances phase OUT
 * OF intake is denied while any same-repo blocked_on target is not `done`;
 * terminal-but-not-done (cancelled/superseded/wontfix) and other non-done
 * states open only via a substantive blocked_on_override. Unresolvable ids
 * never block; unreadable status fails safe; grandfather (only the intake
 * transition); one-hop (a cycle just denies, no loop).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, it } from 'vitest';

import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const SUBJECT_ID = 'SUBJ01';

describe('MBGQ89 blocked_on phase gate (wired, always-on)', () => {
  let projectRoot: string;
  let ticketsRoot: string;
  let subjectFile: string;

  /** Frontmatter body for the subject ticket at `phase`, with optional extra lines. */
  function subjectBody(phase: string, ...extra: string[]): string {
    return [
      '---',
      `id: ${SUBJECT_ID}`,
      'type: feature',
      `phase: ${phase}`,
      'status: in_progress',
      'scope: test scope',
      'out_of_scope: none',
      'done_when: ready',
      ...extra,
      '---',
      '',
      '# Subject',
      '',
    ].join('\n');
  }

  /** Write a blocker ticket with the given status (omit for an unreadable status). */
  function writeBlocker(id: string, status?: string): void {
    const frontmatter = status === undefined ? [`id: ${id}`] : [`id: ${id}`, `status: ${status}`];
    const directory = nodePath.join(ticketsRoot, id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'ticket.md'),
      ['---', ...frontmatter, '---', '', `# ${id}`, ''].join('\n'),
    );
  }

  /** Drive the gate with a Write of the subject ticket at `newPhase` + extra frontmatter. */
  function advance(newPhase: string, ...extra: string[]): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: subjectFile, content: subjectBody(newPhase, ...extra) },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  /** Seed the subject ticket on disk at `phase` with optional extra frontmatter. */
  function seedSubject(phase: string, ...extra: string[]): void {
    writeFileSync(subjectFile, subjectBody(phase, ...extra));
  }

  /** Drive the gate with an Edit that flips `phase: <from>` → `phase: <to>`. */
  function advanceViaEdit(fromPhase: string, toPhase: string): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: {
          file_path: subjectFile,
          old_string: `phase: ${fromPhase}`,
          new_string: `phase: ${toPhase}`,
        },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'blocked-on-gate-'));
    ticketsRoot = nodePath.join(projectRoot, '.safeword-project', 'tickets');
    mkdirSync(nodePath.join(ticketsRoot, SUBJECT_ID), { recursive: true });
    subjectFile = nodePath.join(ticketsRoot, SUBJECT_ID, 'ticket.md');
    writeFileSync(
      nodePath.join(ticketsRoot, SUBJECT_ID, 'spec.md'),
      '# Spec\n\n## Jobs To Be Done\n\nskip: blocked_on fixture\n',
    );
    writeFileSync(
      nodePath.join(ticketsRoot, SUBJECT_ID, 'dimensions.md'),
      'skip: blocked_on fixture\n',
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  // --- AC3: gate denies/allows on done-ness of direct blockers ---

  it('denies advancing out of intake while a blocker is in_progress', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'in_progress');
    expectHookDeny(advance('define-behavior', 'blocked_on: [BLK1]'), 'BLOCKED on BLK1');
  });

  it('allows the advance once the blocker is done', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'done');
    expectHookAllow(advance('define-behavior', 'blocked_on: [BLK1]'));
  });

  it('denies an Edit payload that advances out of intake while a blocker is unmet', () => {
    // The gate reads the on-disk prior content and reconstructs the post-Edit
    // text, so an Edit that only flips the phase line must be caught the same as
    // a full Write — exercises the Edit/MultiEdit branch of nextContentAfterEdit.
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'in_progress');
    expectHookDeny(advanceViaEdit('intake', 'define-behavior'), 'BLOCKED on BLK1');
  });

  it('allows an Edit payload past the intake exit once the blocker is done', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'done');
    expectHookAllow(advanceViaEdit('intake', 'define-behavior'));
  });

  it('denies when any of several blockers is not done', () => {
    seedSubject('intake', 'blocked_on: [BLK1, BLK2]');
    writeBlocker('BLK1', 'done');
    writeBlocker('BLK2', 'in_progress');
    expectHookDeny(advance('define-behavior', 'blocked_on: [BLK1, BLK2]'), 'BLOCKED on BLK2');
  });

  it('allows when all blockers are done', () => {
    seedSubject('intake', 'blocked_on: [BLK1, BLK2]');
    writeBlocker('BLK1', 'done');
    writeBlocker('BLK2', 'done');
    expectHookAllow(advance('define-behavior', 'blocked_on: [BLK1, BLK2]'));
  });

  it('fails safe (denies) when a blocker has an unreadable status', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1'); // no status field
    expectHookDeny(advance('define-behavior', 'blocked_on: [BLK1]'), 'BLOCKED on BLK1');
  });

  it('never blocks on an unresolvable (cross-repo / unknown) id', () => {
    seedSubject('intake', 'blocked_on: [NOPE9]');
    expectHookAllow(advance('define-behavior', 'blocked_on: [NOPE9]'));
  });

  // --- AC4: terminal-not-done needs a substantive override ---

  it('denies a cancelled blocker with no override', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'cancelled');
    expectHookDeny(advance('define-behavior', 'blocked_on: [BLK1]'), 'BLOCKED on BLK1');
  });

  it('allows past a cancelled blocker with a substantive override', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'cancelled');
    expectHookAllow(
      advance(
        'define-behavior',
        'blocked_on: [BLK1]',
        'blocked_on_override: BLK1 cancelled; subject still needs the schema, doing it inline',
      ),
    );
  });

  it('rejects a trivial override reason', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'cancelled');
    expectHookDeny(
      advance('define-behavior', 'blocked_on: [BLK1]', 'blocked_on_override: proceeding'),
      'BLOCKED on BLK1',
    );
  });

  // --- AC5: transition-only (grandfather) + cycle one-hop ---

  it('does not block a phase advance that is not leaving intake (grandfather)', () => {
    seedSubject('define-behavior', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'in_progress');
    // scenario-gate, not implement: the phase-provenance gate (0KYEBN) runs
    // first and denies multi-step jumps — this test's subject is the
    // blocked_on grandfather, so the advance itself must be legal.
    expectHookAllow(advance('scenario-gate', 'blocked_on: [BLK1]'));
  });

  it('allows a non-phase edit even while a blocker is unmet', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'in_progress');
    expectHookAllow(advance('intake', 'blocked_on: [BLK1]'));
  });

  it('denies (does not loop) when blocked_on forms a cycle', () => {
    seedSubject('intake', 'blocked_on: [BLK1]');
    writeBlocker('BLK1', 'in_progress'); // BLK1 would point back at SUBJ01, but the gate is one-hop
    expectHookDeny(advance('define-behavior', 'blocked_on: [BLK1]'), 'BLOCKED on BLK1');
  });
});
