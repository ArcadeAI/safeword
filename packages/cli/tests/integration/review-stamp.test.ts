/**
 * Integration test for the NMSD94 stamp-earning step (write-review-stamp.ts).
 * Proves the loop the unit tests can't: running the real stamp script earns a
 * stamp the real pre-tool-quality gate reads back and accepts — deny → stamp →
 * allow, end to end. Also covers the skip valve and the Tier 2 phase stamp.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hashArtifact,
  parseReviewStamps,
  reviewScope,
} from '../../templates/hooks/lib/review-ledger.js';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const STAMP_PATH = nodePath.resolve(__dirname, '../../templates/hooks/write-review-stamp.ts');
const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
const POST_TOOL_PATH = nodePath.resolve(__dirname, '../../templates/hooks/post-tool-quality.ts');
const CURSOR_BEFORE_SHELL_PATH = nodePath.resolve(
  __dirname,
  '../../templates/hooks/cursor/before-shell-execution.ts',
);
const TICKET_ID = 'ABC123';

const TICKET_FRONTMATTER = [
  'id: ABC123',
  'type: feature',
  'phase: define-behavior',
  'status: in_progress',
  'last_modified: 2026-06-03T00:00:00.000Z',
  'scope:',
  '  - does a thing',
  'out_of_scope:',
  '  - another thing',
  'done_when:',
  '  - the thing works',
].join('\n');

const SPEC = [
  '# Spec: x',
  '',
  '## Jobs To Be Done',
  '',
  '### feat.PO1 — title',
  '',
  '**Persona:** Platform Operator (PO)',
  '',
  '> When I do x, I want y, so I can z.',
  '',
  '#### feat.PO1.AC1 — a capability',
  '',
  'The capability.',
  '',
].join('\n');

const PERSONAS = '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n';

describe('NMSD94 stamp-earning step (write-review-stamp.ts)', () => {
  let projectRoot: string;
  let ticketDirectory: string;

  function runStamp(...args: string[]): HookResult {
    const result = spawnSync('bun', [STAMP_PATH, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot, CLAUDE_SESSION_ID: 'sess-1' },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function runStampWithoutRuntimeIdentity(...args: string[]): HookResult {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: projectRoot };
    delete env.CLAUDE_SESSION_ID;
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CODEX_THREAD_ID;

    const result = spawnSync('bun', [STAMP_PATH, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function runGate(): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: {
          file_path: nodePath.join(ticketDirectory, 'test-definitions.md'),
          content: '# Test Definitions\n',
        },
      }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function readLog(): string {
    const logFile = nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log');
    return existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  }

  function bindSessionTicket(ticketId: string = TICKET_ID): void {
    writeFileSync(
      nodePath.join(projectRoot, '.safeword-project', 'quality-state-sess-1.json'),
      JSON.stringify({ activeTicket: ticketId }),
    );
  }

  function createTicketFolder(
    folder: string,
    { type = 'feature', phase = 'intake', status = 'in_progress' } = {},
  ): string {
    const directory = nodePath.join(projectRoot, '.safeword-project', 'tickets', folder);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'ticket.md'),
      `---\nid: ${folder}\ntype: ${type}\nphase: ${phase}\nstatus: ${status}\n---\n`,
    );
    return directory;
  }

  function createSecondTicket(): void {
    createTicketFolder('XYZ789');
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-stamp-'));
    ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', TICKET_ID);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), `---\n${TICKET_FRONTMATTER}\n---\n`);
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), SPEC);
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(nodePath.join(projectRoot, '.safeword-project', 'personas.md'), PERSONAS);
    // Enable the gate so the deny→stamp→allow loop is observable.
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(projectRoot, '.safeword', 'config.json'),
      JSON.stringify({ reviewGate: true }),
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('earns a stamp the gate accepts: deny → stamp spec → allow', () => {
    expectHookDeny(runGate(), 'not been reviewed');

    const stamp = runStamp('spec');
    expect(stamp.status).toBe(0);
    expect(stamp.stdout).toContain('✓');

    expectHookAllow(runGate());
  });

  it('writes a content-bound scope matching the gate (folder + spec + hash)', () => {
    runStamp('spec');
    expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`);
  });

  it('a --skip stamp clears the gate and records its reason', () => {
    const stamp = runStamp('spec', '--skip', 'trivial boilerplate spec');
    expect(stamp.status).toBe(0);
    expect(readLog()).toContain('skip:trivial boilerplate spec');
    expectHookAllow(runGate());
  });

  it('rejects free text after the artifact instead of misrecording a pass as a skip (#629)', () => {
    const stamp = runStamp('spec', 'review', 'passed,', 'some', 'note');
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('unexpected trailing arguments');
    expect(stamp.stdout).toContain('--skip');
    expect(readLog()).toBe('');
  });

  it('rejects free text after --phase instead of misrecording a pass as a skip (#629)', () => {
    const stamp = runStamp('--phase', 'define-behavior', 'independent review PASSED 0 must-fix');
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('unexpected trailing arguments');
    expect(readLog()).toBe('');
  });

  it('rejects a blank --skip reason', () => {
    const stamp = runStamp('spec', '--skip', ' '.repeat(3));
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('must not be blank');
    expect(readLog()).toBe('');
  });

  it('rejects --model swallowing --skip instead of minting a pass stamp from a declared skip', () => {
    // Without this guard, `--model --skip` swallows --skip as the model id and
    // writes a PASS stamp whose bogus model tag clears the cross-model gate.
    const stamp = runStamp('spec', '--model', '--skip');
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('flag-like');
    expect(readLog()).toBe('');
  });

  it('rejects --skip swallowing --ticket instead of stamping the wrong ticket', () => {
    const stamp = runStamp('--skip', '--ticket', TICKET_ID);
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('flag-like');
    expect(readLog()).toBe('');
  });

  it('rejects --skip with no value at end of argv', () => {
    const stamp = runStamp('spec', '--skip');
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('--skip requires a value');
    expect(readLog()).toBe('');
  });

  it('rejects a repeated flag instead of silently last-winning', () => {
    const stamp = runStamp('spec', '--skip', 'reason a', '--skip', 'reason b');
    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('--skip given more than once');
    expect(readLog()).toBe('');
  });

  it('--phase writes a ticket-qualified phase scope', () => {
    const stamp = runStamp('--phase', 'define-behavior');
    expect(stamp.status).toBe(0);
    expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'phase', 'define-behavior')}`);
  });

  it('a stale stamp (spec edited after stamping) no longer satisfies the gate', () => {
    runStamp('spec');
    expectHookAllow(runGate());
    // Edit the spec — the prior stamp's content hash is now stale.
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), `${SPEC}\nedited.\n`);
    expectHookDeny(runGate(), 'not been reviewed');
  });

  it('a newline in the skip reason cannot inject a second stamp line', () => {
    // A reason crafted to forge a stamp for another scope must be collapsed to
    // one line — the log stays one stamp, and parsing yields only the real one.
    runStamp('spec', '--skip', 'looks fine\nreview:HACKED:spec@deadbeefcafe');
    const stamps = parseReviewStamps(readLog());
    expect(stamps).toHaveLength(1);
    expect(stamps[0]?.scope).toBe(reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC)));
    expect(stamps.some(s => s.scope === 'HACKED:spec@deadbeefcafe')).toBe(false);
  });

  it('uses the session-bound active ticket when more than one ticket is in_progress (no --ticket)', () => {
    createSecondTicket();
    bindSessionTicket();

    const stamp = runStamp('spec');

    expect(stamp.status).toBe(0);
    expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`);
  });

  it('fails loudly when multiple tickets are in_progress and no session ticket is bound', () => {
    createSecondTicket();

    const stamp = runStamp('spec');

    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('multiple in_progress tickets');
    expect(stamp.stdout).toContain('pass --ticket <folder>');
  });

  it('rejects a path-separator in --ticket or the artifact (no escaping tickets/)', () => {
    const traversedTicket = runStamp('--ticket', '../../etc', 'spec');
    expect(traversedTicket.status).toBe(1);
    expect(traversedTicket.stdout).toContain('bare name');

    const traversedArtifact = runStamp('--ticket', TICKET_ID, '../../../secret');
    expect(traversedArtifact.status).toBe(1);
    expect(traversedArtifact.stdout).toContain('bare name');
  });

  it('--ticket disambiguates when more than one ticket is in_progress', () => {
    createSecondTicket();
    const stamp = runStamp('--ticket', TICKET_ID, 'spec');
    expect(stamp.status).toBe(0);
    expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`);
  });

  it('--ticket after --phase disambiguates when more than one ticket is in_progress', () => {
    createSecondTicket();
    const stamp = runStamp('--phase', 'define-behavior', '--ticket', TICKET_ID);
    expect(stamp.status).toBe(0);
    expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'phase', 'define-behavior')}`);
  });

  it('fails visibly instead of stamping unknown-session when no runtime identity is available', () => {
    const stamp = runStampWithoutRuntimeIdentity('spec');

    expect(stamp.status).toBe(1);
    expect(stamp.stdout).toContain('missing run identity');
    expect(readLog()).not.toContain('unknown-session');
  });

  // #630: the binding write-site broadened from ticket.md-only to any artifact
  // under the ticket's folder, so a session that resumes an in_progress ticket
  // (never editing ticket.md) still stamps without --ticket. Exercises the real
  // post-tool-quality.ts → write-review-stamp.ts chain.
  describe('artifact-edit session binding (#630)', () => {
    function runPostToolEdit(filePath: string): void {
      const result = spawnSync('bun', [POST_TOOL_PATH], {
        input: JSON.stringify({
          session_id: 'sess-1',
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: filePath },
        }),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
      });
      expect(result.status).toBe(0);
    }

    function readSessionBinding(): string | undefined {
      const stateFile = nodePath.join(
        projectRoot,
        '.safeword-project',
        'quality-state-sess-1.json',
      );
      if (!existsSync(stateFile)) return undefined;
      return (
        (JSON.parse(readFileSync(stateFile, 'utf8')) as { activeTicket: string | null })
          .activeTicket ?? undefined
      );
    }

    beforeEach(() => {
      // post-tool-quality.ts exits before the binding write when HEAD is absent.
      execSync(
        'git init -q && git add -A && git -c user.email=t@t.t -c user.name=t commit -qm fixture',
        { cwd: projectRoot, stdio: 'pipe' },
      );
    });

    it('resume flow: a spec.md edit binds the session, so the stamp resolves among multiple in_progress tickets', () => {
      createSecondTicket();

      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));
      const stamp = runStamp('spec');

      expect(stamp.status).toBe(0);
      expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`);
    });

    it('does not rebind to an epic when one of its artifacts is edited', () => {
      const epicDirectory = createTicketFolder('EPIC01', { type: 'epic' });
      writeFileSync(nodePath.join(epicDirectory, 'spec.md'), '# Epic spec\n');

      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));
      runPostToolEdit(nodePath.join(epicDirectory, 'spec.md'));

      expect(readSessionBinding()).toBe(TICKET_ID);
    });

    it("editing a cancelled ticket's artifact does not steal the session binding", () => {
      // The status vocabulary is wider than done/backlog — any non-in_progress
      // status must neither bind nor overwrite an existing binding.
      const cancelledDirectory = createTicketFolder('CAN001', { status: 'cancelled' });
      writeFileSync(nodePath.join(cancelledDirectory, 'work-log.md'), '# Notes\n');

      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));
      runPostToolEdit(nodePath.join(cancelledDirectory, 'work-log.md'));

      expect(readSessionBinding()).toBe(TICKET_ID);
    });

    it("editing a done ticket's artifact does not unbind the session from its active ticket", () => {
      const doneDirectory = createTicketFolder('DONE01', { phase: 'done', status: 'done' });
      writeFileSync(nodePath.join(doneDirectory, 'spec.md'), '# Archived spec\n');

      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));
      runPostToolEdit(nodePath.join(doneDirectory, 'spec.md'));

      expect(readSessionBinding()).toBe(TICKET_ID);
    });

    it("clears the binding when the bound ticket's own artifact is edited after it went done", () => {
      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));
      expect(readSessionBinding()).toBe(TICKET_ID);

      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        `---\n${TICKET_FRONTMATTER.replace('status: in_progress', 'status: done')}\n---\n`,
      );
      runPostToolEdit(nodePath.join(ticketDirectory, 'spec.md'));

      expect(readSessionBinding()).toBeUndefined();
    });

    it('does not bind from artifacts under tickets/completed/', () => {
      const completedDirectory = nodePath.join(
        projectRoot,
        '.safeword-project',
        'tickets',
        'completed',
        'OLD001',
      );
      mkdirSync(completedDirectory, { recursive: true });
      writeFileSync(nodePath.join(completedDirectory, 'spec.md'), '# Old spec\n');

      runPostToolEdit(nodePath.join(completedDirectory, 'spec.md'));

      expect(readSessionBinding()).toBeUndefined();
    });
  });

  // #630: on Codex/Cursor the stamp helper's process env has no run identity;
  // the runtime's pre-shell hook stashes the session id right before the
  // command runs. Exercises the real pre-shell hook → write-review-stamp.ts
  // chain, including that the bridged identity reads the SAME session-state
  // key the runtime's post-tool adapter writes the binding under.
  describe('run-identity bridge on Codex/Cursor (#630)', () => {
    const STAMP_COMMAND = 'bun .safeword/hooks/write-review-stamp.ts spec';

    function runCursorBeforeShell(conversationId: string): void {
      const result = spawnSync('bun', [CURSOR_BEFORE_SHELL_PATH], {
        cwd: projectRoot,
        input: JSON.stringify({
          conversation_id: conversationId,
          command: STAMP_COMMAND,
          workspace_roots: [projectRoot],
        }),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout) as { permission?: string }).toEqual({
        permission: 'allow',
      });
    }

    function bindRuntimeSessionTicket(storageKey: string): void {
      writeFileSync(
        nodePath.join(projectRoot, '.safeword-project', `quality-state-${storageKey}.json`),
        JSON.stringify({ activeTicket: TICKET_ID }),
      );
    }

    it('Cursor: the pre-shell stash lets the stamp resolve the cursor-bound session ticket', () => {
      createSecondTicket();
      bindRuntimeSessionTicket('cursor-conv-1');

      runCursorBeforeShell('conv-1');
      const stamp = runStampWithoutRuntimeIdentity('spec');

      expect(stamp.status).toBe(0);
      expect(readLog()).toContain(`review:${reviewScope(TICKET_ID, 'spec', hashArtifact(SPEC))}`);
    });

    it('the stash is single-use: a second stamp without a new pre-shell event fails loudly', () => {
      createSecondTicket();
      bindRuntimeSessionTicket('cursor-conv-1');

      runCursorBeforeShell('conv-1');
      expect(runStampWithoutRuntimeIdentity('spec').status).toBe(0);

      const secondStamp = runStampWithoutRuntimeIdentity('spec');
      expect(secondStamp.status).toBe(1);
      expect(secondStamp.stdout).toContain('missing run identity');
    });
  });
});
