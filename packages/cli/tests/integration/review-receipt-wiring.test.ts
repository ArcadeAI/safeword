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

import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { expectHookAllow, expectHookDeny, type HookResult } from '../helpers';

const STAMP_PATH = nodePath.resolve(__dirname, '../../templates/hooks/write-review-stamp.ts');
const GATE_PATH = nodePath.resolve(__dirname, '../../templates/hooks/pre-tool-quality.ts');
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

/** Write the envelope the stubbed coordinator will replay for `review status`. */
function writeCoordinatorResponse(
  pluginRoot: string,
  envelope: Record<string, unknown> | undefined,
): void {
  writeFileSync(
    nodePath.join(pluginRoot, 'response.json'),
    JSON.stringify(envelope === undefined ? {} : { data: envelope }),
  );
}

/** Put a stub CLI on the hooks' own discovery path so the real spawn/parse runs. */
function installStubCli(pluginRoot: string): void {
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
}

describe('review-receipt wiring (write-review-stamp.ts ↔ review status --json)', () => {
  let projectRoot: string;
  let pluginRoot: string;

  const stubCoordinator = (envelope: Record<string, unknown> | undefined): void => {
    writeCoordinatorResponse(pluginRoot, envelope);
  };

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
    installStubCli(pluginRoot);

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

/**
 * The read path, end to end through the real gate. The write hook can be
 * bypassed entirely by appending to the ledger by hand, so the check that
 * matters is whether the gate honours a line it did not write. Both directions
 * are asserted: the positive control proves the deny below is not vacuous.
 */
describe('review-receipt wiring (pre-tool-quality gate ↔ review status --json)', () => {
  let projectRoot: string;
  let pluginRoot: string;

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

  const stubCoordinator = (envelope: Record<string, unknown> | undefined): void => {
    writeCoordinatorResponse(pluginRoot, envelope);
  };

  /** Append a ledger line directly — the bypass the write hook cannot police. */
  function handWriteStamp(reviewId: string): void {
    const scope = reviewScope(TICKET, 'spec', hashArtifact(SPEC));
    writeFileSync(
      nodePath.join(projectRoot, '.safeword-project', 'skill-invocations.log'),
      `2026-09-05T00:00:00Z sess-1 review:${scope} author:codex reviewer:claude independence:cross-agent review-id:${reviewId}\n`,
    );
  }

  function runGate(): HookResult {
    const result = spawnSync('bun', [GATE_PATH], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: {
          file_path: nodePath.join(
            projectRoot,
            '.safeword-project',
            'tickets',
            TICKET,
            'test-definitions.md',
          ),
          content: '# Test Definitions\n',
        },
      }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectRoot,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
      },
    });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }

  beforeEach(() => {
    projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-gate-'));
    pluginRoot = mkdtempSync(nodePath.join(tmpdir(), 'review-gate-cli-'));

    installStubCli(pluginRoot);

    const ticketDirectory = nodePath.join(projectRoot, '.safeword-project', 'tickets', TICKET);
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(ticketDirectory, 'ticket.md'),
      [
        '---',
        `id: ${TICKET}`,
        'type: feature',
        'phase: define-behavior',
        'status: in_progress',
        'last_modified: 2026-09-05T00:00:00.000Z',
        'scope:',
        '  - does a thing',
        'out_of_scope:',
        '  - another thing',
        'done_when:',
        '  - the thing works',
        '---',
        '',
      ].join('\n'),
    );
    writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), SPEC);
    writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
    writeFileSync(
      nodePath.join(projectRoot, '.safeword-project', 'personas.md'),
      '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n',
    );
    mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(projectRoot, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
    writeFileSync(
      nodePath.join(projectRoot, '.safeword', 'config.json'),
      JSON.stringify({ reviewGate: true }),
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(pluginRoot, { recursive: true, force: true });
  });

  it('refuses a hand-written stamp whose cited review the coordinator does not know', () => {
    stubCoordinator(undefined);
    handWriteStamp('not-real');

    expectHookDeny(runGate(), 'spec.md has not been reviewed');
  });

  it('refuses a hand-written stamp citing a review of different work', () => {
    stubCoordinator({
      ...approvedEnvelope,
      review_targets: [`.safeword-project/tickets/${OTHER_TICKET}/spec.md`],
    });
    handWriteStamp(REVIEW_ID);

    expectHookDeny(runGate(), 'spec.md has not been reviewed');
  });

  it('refuses a hand-written stamp citing a stale review', () => {
    stubCoordinator({
      ...approvedEnvelope,
      status: 'stale',
      review_targets: [`.safeword-project/tickets/${TICKET}/spec.md`],
    });
    handWriteStamp(REVIEW_ID);

    expectHookDeny(runGate(), 'spec.md has not been reviewed');
  });

  it('allows a stamp the coordinator actually witnesses — the deny above is not vacuous', () => {
    stubCoordinator({
      ...approvedEnvelope,
      review_targets: [`.safeword-project/tickets/${TICKET}/spec.md`],
    });
    handWriteStamp(REVIEW_ID);

    expectHookAllow(runGate());
  });
});
