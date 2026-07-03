/**
 * Integration test for the NMSD94 stamp-earning step (write-review-stamp.ts).
 * Proves the loop the unit tests can't: running the real stamp script earns a
 * stamp the real pre-tool-quality gate reads back and accepts — deny → stamp →
 * allow, end to end. Also covers the skip valve and the Tier 2 phase stamp.
 */

import { spawnSync } from 'node:child_process';
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

  function createSecondTicket(): void {
    const second = nodePath.join(projectRoot, '.safeword-project', 'tickets', 'XYZ789');
    mkdirSync(second, { recursive: true });
    writeFileSync(
      nodePath.join(second, 'ticket.md'),
      '---\nid: XYZ789\ntype: feature\nphase: intake\nstatus: in_progress\n---\n',
    );
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

  it('rejects a flag-like flag value instead of minting a pass stamp from a declared skip', () => {
    // Without this guard, `--model --skip` swallows --skip as the model id and
    // writes a PASS stamp whose bogus model tag clears the cross-model gate.
    const passFromSkip = runStamp('spec', '--model', '--skip');
    expect(passFromSkip.status).toBe(1);
    expect(passFromSkip.stdout).toContain('flag-like');

    const skipEatsTicket = runStamp('--skip', '--ticket', TICKET_ID);
    expect(skipEatsTicket.status).toBe(1);
    expect(skipEatsTicket.stdout).toContain('flag-like');

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
});
