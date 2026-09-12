/**
 * Human design-approval boundary for G1C9PP R19.
 *
 * The interactive row deliberately crosses a real pseudo-terminal. Calling an
 * injected prompt would prove only handler composition, not that an installed
 * CLI can actually present the reviewed approach to a person.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { runCli, testCliPath } from '../helpers.js';

const TICKET_ID = 'PLAN42';
const TICKET_FOLDER = `${TICKET_ID}-review-the-approach`;
const REVIEW_ID = '42000000-0000-4000-8000-000000000019';

const PLAN = [
  '# Impl Plan: Review the approach',
  '',
  '**Status:** planned',
  '',
  '## Approach',
  '',
  'One command presents one reviewed approach before Execution Planning.',
  '',
  '## Decisions',
  '',
  'The exact plan bytes are the approval boundary.',
  '',
  '## Design alignment',
  '',
  'skip: this fixture has no configured project principles',
  '',
  '## Known deviations',
  '',
  'skip: no known deviations',
  '',
  '## Assessment triggers',
  '',
  'Revisit when the approval authority changes.',
  '',
].join('\n');

const PTY_RUNNER = String.raw`
import errno, os, pty, select, sys
response = sys.argv[1].encode() + b'\n'
pid, fd = pty.fork()
if pid == 0:
    os.execvpe(sys.argv[2], sys.argv[2:], os.environ)
output = bytearray()
answered = False
while True:
    ready, _, _ = select.select([fd], [], [], 5)
    if not ready:
        os.kill(pid, 9)
        raise SystemExit('timed out waiting for approval prompt')
    try:
        chunk = os.read(fd, 4096)
    except OSError as error:
        if error.errno == errno.EIO:
            break
        raise
    if not chunk:
        break
    output.extend(chunk)
    if not answered and b'Approve this reviewed Implementation Plan?' in output:
        os.write(fd, response)
        answered = True
_, status = os.waitpid(pid, 0)
sys.stdout.buffer.write(output)
raise SystemExit(os.waitstatus_to_exitcode(status))
`;

interface Fixture {
  readonly root: string;
  readonly ticketDirectory: string;
  readonly ticketPath: string;
  readonly ledgerPath: string;
}

const fixtures: string[] = [];

function fixture(designApprovalGate: boolean, reviewed = true): Fixture {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plan-approval-'));
  fixtures.push(root);
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', TICKET_FOLDER);
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  mkdirSync(ticketDirectory, { recursive: true });
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    `${JSON.stringify({ designApprovalGate, reviewGate: true }, undefined, 2)}\n`,
  );
  writeFileSync(
    ticketPath,
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: plan-implementation',
      'status: in_progress',
      'scope: review one approach',
      'out_of_scope: unrelated work',
      'done_when: execution planning begins safely',
      '---',
      '',
      '# Ticket',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), '# Product Plan\n');
  writeFileSync(nodePath.join(ticketDirectory, 'impl-plan.md'), PLAN);
  const scope = reviewScope(TICKET_FOLDER, 'impl-plan', hashArtifact(PLAN));
  writeFileSync(
    ledgerPath,
    reviewed
      ? `2026-09-11T00:00:00.000Z fixture review:${scope} author:claude reviewer:codex independence:cross-agent review-id:${REVIEW_ID}\n`
      : '',
  );
  return { root, ticketDirectory, ticketPath, ledgerPath };
}

function phase(path: string): string | undefined {
  return /^phase:\s*(\S+)/mu.exec(readFileSync(path, 'utf8'))?.[1];
}

function approvalEvents(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => line.includes(' design-decision:'));
}

function decisionPayloads(path: string): Record<string, unknown>[] {
  return approvalEvents(path).map(line =>
    JSON.parse(line.slice(line.indexOf(' design-decision:') + ' design-decision:'.length)),
  ) as Record<string, unknown>[];
}

function appendCurrentReview(project: Fixture, plan: string): void {
  const scope = reviewScope(TICKET_FOLDER, 'impl-plan', hashArtifact(plan));
  writeFileSync(
    project.ledgerPath,
    `${readFileSync(project.ledgerPath, 'utf8')}2026-09-11T00:01:00.000Z fixture review:${scope} author:claude reviewer:codex independence:cross-agent review-id:${REVIEW_ID}\n`,
  );
}

function runApprovalInPty(
  project: Fixture,
  response: 'y' | 'n',
  environment: Readonly<Record<string, string>> = {},
) {
  return spawnSync(
    'python3',
    [
      '-c',
      PTY_RUNNER,
      response,
      process.execPath,
      testCliPath,
      '--cwd',
      project.root,
      'ticket',
      'approve-plan',
      TICKET_ID,
    ],
    {
      cwd: project.root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', ...environment },
    },
  );
}

function runApprovalInPtyAsync(
  project: Fixture,
  ticketId: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'python3',
      [
        '-c',
        PTY_RUNNER,
        'y',
        process.execPath,
        testCliPath,
        '--cwd',
        project.root,
        'ticket',
        'approve-plan',
        ticketId,
      ],
      { cwd: project.root, env: { ...process.env, NODE_ENV: 'test', ...environment } },
    );
    child.once('error', reject);
    child.once('close', resolve);
  });
}

function addReviewedTicket(project: Fixture, ticketId: string, suffix: string): void {
  const folder = `${ticketId}-review-the-approach`;
  const directory = nodePath.join(project.root, '.project', 'tickets', folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'ticket.md'),
    [
      '---',
      `id: ${ticketId}`,
      'type: feature',
      'phase: plan-implementation',
      'status: in_progress',
      '---',
      '',
      '# Ticket',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(directory, 'spec.md'), '# Product Plan\n');
  const plan = `${PLAN}\n${suffix}\n`;
  writeFileSync(nodePath.join(directory, 'impl-plan.md'), plan);
  const scope = reviewScope(folder, 'impl-plan', hashArtifact(plan));
  writeFileSync(
    project.ledgerPath,
    `${readFileSync(project.ledgerPath, 'utf8')}2026-09-11T00:02:00.000Z fixture review:${scope} author:claude reviewer:codex independence:cross-agent review-id:${REVIEW_ID}\n`,
  );
}

function installBlockingReviewer(): string {
  const trustedRoot = nodePath.resolve(import.meta.dirname, '..', '..', '.test-tmp', 'reviewers');
  mkdirSync(trustedRoot, { recursive: true, mode: 0o700 });
  chmodSync(trustedRoot, 0o700);
  const root = mkdtempSync(nodePath.join(trustedRoot, 'safeword-plan-blocked-reviewer-'));
  fixtures.push(root);
  const bin = nodePath.join(root, 'bin');
  const executable = nodePath.join(bin, 'claude');
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    executable,
    String.raw`#!/bin/sh
set -eu
if [ "$#" -gt 0 ] && [ "$1" = "--version" ]; then printf 'claude 1.0.0\n'; exit 0; fi
case "$*" in
  *--help*) printf '%s\n' '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model'; exit 0 ;;
esac
payload=$(/bin/cat)
dispatch_id=$(printf '%s' "$payload" | /usr/bin/sed -n 's/.*"dispatch_id":"\([^"]*\)".*/\1/p')
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"plan is blocked","findings":[{"severity":"error","message":"Authorization boundary is missing."}]}\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('installed CLI human design authority follows configuration', () => {
  it('advances non-interactively and records not-required when the gate is disabled', async () => {
    const project = fixture(false);

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
    });

    expect(result.exitCode).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    const payload = JSON.parse(result.stdout) as { data?: Record<string, unknown> };
    expect(payload.data).toMatchObject({ approval_status: 'not-required' });
    expect(readFileSync(project.ledgerPath, 'utf8')).toContain('human-approval:not-required');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);
  });

  it('presents the reviewed approach exactly once through a real terminal', () => {
    const project = fixture(true);

    const result = runApprovalInPty(project, 'n');

    expect(result.status).toBe(0);
    expect(result.stdout.match(/# Impl Plan: Review the approach/gu)).toHaveLength(1);
    expect(result.stdout.match(/Approve this reviewed Implementation Plan\?/gu)).toHaveLength(1);
  });

  it('settles headless work as pending without prompting or changing phase', async () => {
    const project = fixture(true);

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
    });

    expect(result.timedOut).toBe(false);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    const payload = JSON.parse(result.stdout) as { data?: Record<string, unknown> };
    expect(payload.data).toMatchObject({ approval_status: 'pending' });
    expect(result.stdout).not.toContain('Approve this reviewed Implementation Plan?');
    expect(readFileSync(project.ledgerPath, 'utf8')).toContain('human-approval:pending');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);
  });
});

describe('a declined design returns to Implementation Planning', () => {
  it('names the exact declined approach and leaves it in planning for repair', () => {
    const project = fixture(true);

    const result = runApprovalInPty(project, 'n');

    expect(result.status).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain(
      `Declined approach: .project/tickets/${TICKET_FOLDER}/impl-plan.md`,
    );
    const events = approvalEvents(project.ledgerPath);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain(
      `"planDigest":"${createHash('sha256').update(PLAN).digest('hex')}"`,
    );
    expect(events[0]).toContain('"decision":"declined"');
  });
});

describe('an accepted design enters Execution Planning', () => {
  it('binds the approval to the exact approach bytes before advancing', () => {
    const project = fixture(true);
    const digest = createHash('sha256').update(PLAN).digest('hex');

    const result = runApprovalInPty(project, 'y');

    expect(result.status).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(result.stdout).toContain(
      `Approved approach: .project/tickets/${TICKET_FOLDER}/impl-plan.md at ${digest}`,
    );
    const events = approvalEvents(project.ledgerPath);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain(`"planDigest":"${digest}"`);
    expect(events[0]).toContain('"decision":"approved"');
  });
});

describe('a review-blocked design is never presented for human approval', () => {
  it('returns the current semantic finding before crossing the prompt boundary', async () => {
    const project = fixture(true, false);
    const bin = installBlockingReviewer();
    const keyRoot = nodePath.join(project.root, 'review-integrity');
    const environment = {
      PATH: `${bin}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
      SAFEWORD_REVIEW_KEY_ROOT: keyRoot,
    };
    const target = `.project/tickets/${TICKET_FOLDER}/impl-plan.md`;
    const reviewed = await runCli(
      ['--json', '--no-input', 'review', 'run', 'plan-implementation', target],
      { cwd: project.root, env: environment },
    );
    expect(reviewed.exitCode, reviewed.stdout).toBe(2);

    const result = runApprovalInPty(project, 'n', environment);

    expect(result.status).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain('Authorization boundary is missing.');
    expect(result.stdout).not.toContain('Approve this reviewed Implementation Plan?');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);
  });
});

describe('human design authority follows approach currency', () => {
  it('reuses approval for unchanged approach bytes without prompting again', () => {
    const project = fixture(true);
    expect(runApprovalInPty(project, 'y').status).toBe(0);

    const resumed = runApprovalInPty(project, 'n');

    expect(resumed.status).toBe(0);
    expect(resumed.stdout).not.toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(approvalEvents(project.ledgerPath)).toHaveLength(1);
  });

  it('requires a new decision after the approach bytes change', () => {
    const project = fixture(true);
    expect(runApprovalInPty(project, 'y').status).toBe(0);
    const changedPlan = `${PLAN}\nA newly decided authorization boundary.\n`;
    writeFileSync(nodePath.join(project.ticketDirectory, 'impl-plan.md'), changedPlan);
    appendCurrentReview(project, changedPlan);

    const resumed = runApprovalInPty(project, 'n');

    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    const events = approvalEvents(project.ledgerPath);
    expect(events).toHaveLength(2);
    expect(events[1]).toContain(
      `"planDigest":"${createHash('sha256').update(changedPlan).digest('hex')}"`,
    );
    expect(events[1]).toContain('"decision":"declined"');
  });
});

describe('concurrent design decisions do not overwrite each other', () => {
  it('serializes two installed CLI writers in one project ledger', async () => {
    const project = fixture(true);
    const secondTicket = 'PLAN43';
    addReviewedTicket(project, secondTicket, 'A distinct reviewed approach.');

    const statuses = await Promise.all([
      runApprovalInPtyAsync(project, TICKET_ID),
      runApprovalInPtyAsync(project, secondTicket),
    ]);

    expect(statuses).toEqual([0, 0]);
    const decisions = decisionPayloads(project.ledgerPath);
    expect(
      decisions
        .map(event => event.ticket)
        .toSorted((left, right) => String(left).localeCompare(String(right))),
    ).toEqual([TICKET_ID, secondTicket]);
    expect(
      decisions
        .map(event => event.appendPosition)
        .toSorted((left, right) => Number(left) - Number(right)),
    ).toEqual([1, 2]);
    expect(new Set(decisions.map(event => event.fencingGeneration)).size).toBe(2);
  });
});

describe('an interrupted approval resumes according to durable authority', () => {
  it('requires a new decision when the first invocation exits before durability', () => {
    const project = fixture(true);

    const interrupted = runApprovalInPty(project, 'y', {
      SAFEWORD_APPROVAL_TEST_INTERRUPT: 'before-decision',
    });

    expect(interrupted.status).toBe(86);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);

    const resumed = runApprovalInPty(project, 'y');
    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(approvalEvents(project.ledgerPath)).toHaveLength(1);
  });

  it('resumes one durable approval without prompting after the phase write is interrupted', () => {
    const project = fixture(true);

    const interrupted = runApprovalInPty(project, 'y', {
      SAFEWORD_APPROVAL_TEST_INTERRUPT: 'after-decision',
    });

    expect(interrupted.status).toBe(86);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(approvalEvents(project.ledgerPath)).toHaveLength(1);

    const resumed = runApprovalInPty(project, 'n');
    expect(resumed.status).toBe(0);
    expect(resumed.stdout).not.toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(approvalEvents(project.ledgerPath)).toHaveLength(1);
  });
});

describe('retrying the same design approval does not duplicate authority', () => {
  it('keeps one event when two installed CLI invocations submit the same decision', async () => {
    const project = fixture(true);

    const statuses = await Promise.all([
      runApprovalInPtyAsync(project, TICKET_ID),
      runApprovalInPtyAsync(project, TICKET_ID),
    ]);

    expect(statuses).toEqual([0, 0]);
    const decisions = decisionPayloads(project.ledgerPath);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      appendPosition: 1,
      decision: 'approved',
      fencingGeneration: 1,
      ticket: TICKET_ID,
    });
  });
});

describe('approval-ledger contention fails closed without changing authority', () => {
  it('returns pending within the configured budget while a live writer owns the lock', () => {
    const project = fixture(true);
    writeFileSync(
      `${project.ledgerPath}.approval-lock`,
      `${JSON.stringify({
        leaseExpiresAt: Date.now() + 10_000,
        pid: process.pid,
        token: 'live-test-owner',
      })}\n`,
    );

    const started = Date.now();
    const result = runApprovalInPty(project, 'y', {
      SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS: '100',
    });

    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('approval remains pending');
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);
  });
});

describe('a design decision preserves compatible approval-ledger extensions', () => {
  it('keeps earlier known authority and opaque event bytes while appending approval', () => {
    const project = fixture(true);
    const unknown = '2026-09-11T00:03:00.000Z extension:{"opaque":"value  with  spaces"}';
    const before = `${readFileSync(project.ledgerPath, 'utf8')}${unknown}`;
    writeFileSync(project.ledgerPath, before);

    const result = runApprovalInPty(project, 'y');

    expect(result.status).toBe(0);
    const after = readFileSync(project.ledgerPath, 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after.slice(0, before.length)).toBe(before);
    expect(after).toContain(unknown);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(decisionPayloads(project.ledgerPath)).toHaveLength(1);
  });
});

describe('a completed Execution Plan does not trigger a second design approval', () => {
  it('reuses current approach approval at the downstream implementation boundary', () => {
    const project = fixture(true);
    expect(runApprovalInPty(project, 'y').status).toBe(0);
    writeFileSync(
      nodePath.join(project.ticketDirectory, 'execution-plan.md'),
      '# Execution Plan\n\n**Status:** complete\n',
    );

    const result = runApprovalInPty(project, 'n');

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(approvalEvents(project.ledgerPath)).toHaveLength(1);
  });
});

describe('a completed Execution Plan cannot preserve stale design approval', () => {
  it('returns to a fresh human decision when the accepted approach bytes changed', () => {
    const project = fixture(true);
    expect(runApprovalInPty(project, 'y').status).toBe(0);
    writeFileSync(
      nodePath.join(project.ticketDirectory, 'execution-plan.md'),
      '# Execution Plan\n\n**Status:** complete\n',
    );
    const changedPlan = `${PLAN}\nA changed decision after execution planning.\n`;
    writeFileSync(nodePath.join(project.ticketDirectory, 'impl-plan.md'), changedPlan);
    appendCurrentReview(project, changedPlan);

    const result = runApprovalInPty(project, 'n');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Approve this reviewed Implementation Plan?');
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(decisionPayloads(project.ledgerPath).at(-1)).toMatchObject({
      decision: 'declined',
      planDigest: createHash('sha256').update(changedPlan).digest('hex'),
    });
  });
});
