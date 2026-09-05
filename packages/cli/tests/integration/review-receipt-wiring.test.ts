/**
 * Integration test for the review-receipt gate's collaborators (ticket PB1GMZ).
 *
 * The unit tests pin the decision; this pins the wiring the decision depends on
 * — that write-review-stamp.ts really does shell out to `review status <id>
 * --json`, really does read provenance out of that envelope, and refuses when
 * the answer does not witness the stamp being written. A stubbed CLI stands in
 * for the coordinator so each envelope under test is exact.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const STAMP_PATH = nodePath.resolve(__dirname, '../../templates/hooks/write-review-stamp.ts');
const TICKET = 'ABC123';
const OTHER_TICKET = 'XYZ789';
const REVIEW_ID = 'b3f1c2d4-0000-4000-8000-000000000001';

/** The envelope a real coordinator returns for an approved cross-agent review. */
const approvedEnvelope = {
  review_id: REVIEW_ID,
  status: 'approved',
  review_kind: 'plan-implementation',
  review_targets: [`.safeword-project/tickets/${TICKET}/impl-plan.md`],
  independence: 'cross-agent',
  author_agent: 'codex',
  actual_reviewer: 'claude',
};

describe('review-receipt wiring (write-review-stamp.ts ↔ review status --json)', () => {
  let projectRoot: string;
  let pluginRoot: string;

  /** Point the hook's CLI lookup at a stub that answers with `envelope`. */
  function stubCoordinator(envelope: Record<string, unknown> | undefined): void {
    writeFileSync(
      nodePath.join(pluginRoot, 'response.json'),
      JSON.stringify(envelope === undefined ? {} : { data: envelope }),
    );
  }

  function runStamp(...args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync('bun', [STAMP_PATH, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectRoot,
        CLAUDE_SESSION_ID: 'sess-1',
        CLAUDE_PLUGIN_ROOT: pluginRoot,
      },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  function stampImplPlan(...extra: string[]): ReturnType<typeof runStamp> {
    return runStamp(
      '--independence',
      'cross-agent',
      '--review-id',
      REVIEW_ID,
      ...extra,
      'impl-plan',
    );
  }

  function readLog(): string {
    const logFile = nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log');
    return existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  }

  function createTicket(folder: string): string {
    const directory = nodePath.join(projectRoot, '.safeword-project', 'tickets', folder);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      nodePath.join(directory, 'ticket.md'),
      `---\nid: ${folder}\ntype: feature\nphase: plan-implementation\nstatus: in_progress\n---\n`,
    );
    writeFileSync(nodePath.join(directory, 'impl-plan.md'), '# Plan\n');
    return directory;
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-receipt-'));
    pluginRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-receipt-cli-'));

    // A stub CLI on the hook's own discovery path: it replays the fixture for
    // `review status`, so the hook's real spawn/parse/verify path is exercised.
    mkdirSync(nodePath.join(pluginRoot, 'runtime'), { recursive: true });
    writeFileSync(
      nodePath.join(pluginRoot, 'runtime', 'cli.js'),
      [
        "import { readFileSync } from 'node:fs';",
        "import nodePath from 'node:path';",
        'const argv = process.argv.slice(2);',
        "if (argv[0] !== 'review' || argv[1] !== 'status') process.exit(1);",
        "process.stdout.write(readFileSync(nodePath.join(import.meta.dirname, '..', 'response.json'), 'utf8'));",
      ].join('\n'),
    );

    createTicket(TICKET);
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(projectRoot, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(
      nodePath.join(projectRoot, '.safeword-project', 'quality-state-sess-1.json'),
      JSON.stringify({ activeTicket: TICKET }),
    );
    stubCoordinator(approvedEnvelope);
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('writes the stamp when the coordinator witnesses the claim, and records the cited id', () => {
    const result = stampImplPlan();

    expect(result.status).toBe(0);
    expect(readLog()).toContain(`review-id:${REVIEW_ID}`);
  });

  it("refuses when the cited review covered a different ticket's impl-plan", () => {
    stubCoordinator({
      ...approvedEnvelope,
      review_targets: [`.safeword-project/tickets/${OTHER_TICKET}/impl-plan.md`],
    });

    const result = stampImplPlan();

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(TICKET);
    expect(readLog()).toBe('');
  });

  it('refuses to record a degraded review as cross-agent', () => {
    stubCoordinator({ ...approvedEnvelope, independence: 'degraded' });

    const result = stampImplPlan();

    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/degraded/u);
  });

  it('refuses when the coordinator answers about a different review', () => {
    stubCoordinator({ ...approvedEnvelope, review_id: '00000000-0000-4000-8000-000000000999' });

    expect(stampImplPlan().status).not.toBe(0);
    expect(readLog()).toBe('');
  });

  it('refuses when the cited review has not approved', () => {
    stubCoordinator({ ...approvedEnvelope, status: 'changes_requested' });

    expect(stampImplPlan().status).not.toBe(0);
  });

  it('refuses a stamp naming a reviewer the coordinator did not use', () => {
    const result = stampImplPlan('--reviewer-agent', 'codex');

    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/reviewer/u);
  });
});
