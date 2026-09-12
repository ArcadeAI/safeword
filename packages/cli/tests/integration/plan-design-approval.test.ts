/**
 * Human design-approval boundary for G1C9PP R19.
 *
 * The interactive row deliberately crosses a real pseudo-terminal. Calling an
 * injected prompt would prove only handler composition, not that an installed
 * CLI can actually present the reviewed approach to a person.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function fixture(designApprovalGate: boolean): Fixture {
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
    `2026-09-11T00:00:00.000Z fixture review:${scope} author:claude reviewer:codex independence:cross-agent review-id:${REVIEW_ID}\n`,
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

function runApprovalInPty(project: Fixture, response: 'y' | 'n') {
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
    { cwd: project.root, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } },
  );
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
