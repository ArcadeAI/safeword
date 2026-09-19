/**
 * Design-approval and Execution Planning boundary for G1C9PP R19, A639WN R4,
 * and 7CAMAD R1/R17.
 *
 * The interactive row deliberately crosses a real pseudo-terminal. Calling an
 * injected prompt would prove only handler composition, not that an installed
 * CLI can actually present the reviewed approach to a person.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { appendDesignDecision } from '../../src/review/approval-ledger.js';
import { hashArtifact, reviewScope } from '../../templates/hooks/lib/review-ledger.js';
import { assertTestCliFresh, runCli, testCliPath } from '../helpers.js';

const TICKET_ID = 'PLAN42';
const TICKET_FOLDER = `${TICKET_ID}-review-the-approach`;
const EXECUTION_PLAN_TEMPLATE = readFileSync(
  nodePath.resolve(__dirname, '../../templates/doc-templates/execution-plan-template.md'),
  'utf8',
);

const REPLAN_CATEGORIES = [
  'outcome and scope',
  'resolved decisions',
  'dependency and pull-request decomposition',
  'testing',
  'data and compatibility',
  'monitoring and failure signals',
  'security and privacy',
  'rollout and rollback',
  'documentation',
  'ownership and human dependencies',
  'completion evidence',
] as const;

function replanExecutionPlan(discovery: string): string {
  const checklist = REPLAN_CATEGORIES.map((category, index) => {
    if (category === 'testing') {
      return '| item-4 | testing | Preserve accepted proof. | contributor | proof | complete | reusable_earlier_revision | proof-revision | receipt:retained-proof; compatible:Implementation-only planning changes preserve this boundary. |';
    }
    return `| item-${index + 1} | ${category} | Deliver ${category}. | contributor | proof | open | missing |  |  |`;
  });
  return [
    '# Execution Plan',
    '',
    '**Status:** planned',
    '',
    `Implementation discovery: ${discovery}.`,
    '',
    '## Proof specifications',
    '',
    '| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| proof | command | integration | installed CLI | real_boundary | compatible_earlier_allowed | {"type":"command","cwd":".","argv":[${JSON.stringify(process.execPath)},"-e","require('node:fs').writeFileSync('.proof-reran','yes')"]} |`,
    '',
    '## Delivery checklist',
    '',
    '<!-- safeword:delivery-checklist:v1 -->',
    '',
    '| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...checklist,
    '',
  ].join('\n');
}

function executionPlanRecord(plan: string): Record<string, unknown> {
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    slicing_decision: 'one_pull_request',
    rationale: 'One planning repair preserves one coherent contribution.',
    slices: [
      {
        name: 'Planning repair',
        purpose: 'Resume from the first invalidated obligation.',
        boundary: 'Installed CLI planning transition.',
        prerequisites: [],
        proof: 'Installed CLI integration test.',
        completion_signal: 'The ticket returns to its owning planning phase.',
        relies_on_unmerged_successor: false,
      },
    ],
    obligation_owners: [{ obligation: 'Planning repair', slices: ['Planning repair'] }],
    decision_statuses: [{ decision: 'Preserve retained proof', status: 'unchanged' }],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: normalizedExecutionPlanDigest(plan),
    delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
  };
}

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
  readonly reviewId?: string;
}

type ReviewState = 'approved' | 'missing' | 'rejected';

const fixtures: string[] = [];

function projectFiles(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = nodePath.join(directory, entry.name);
    return entry.isDirectory() ? projectFiles(path, root) : [nodePath.relative(root, path)];
  });
}

function fixture(designApprovalGate: boolean, reviewState: ReviewState = 'approved'): Fixture {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-plan-approval-'));
  fixtures.push(root);
  const ticketDirectory = nodePath.join(root, '.project', 'tickets', TICKET_FOLDER);
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const ledgerPath = nodePath.join(root, '.project', 'skill-invocations.log');
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  mkdirSync(nodePath.join(root, '.safeword', 'templates'), { recursive: true });
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
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
  writeFileSync(
    nodePath.join(root, 'features', 'review-the-approach.feature'),
    'Feature: Review the approach\n',
  );
  writeFileSync(
    nodePath.join(root, '.safeword', 'templates', 'execution-plan-template.md'),
    EXECUTION_PLAN_TEMPLATE,
  );
  writeFileSync(ledgerPath, '');
  if (reviewState === 'missing') return { root, ticketDirectory, ticketPath, ledgerPath };

  const bin = installBlockingReviewer();
  const target = `.project/tickets/${TICKET_FOLDER}/impl-plan.md`;
  const reviewed = spawnSync(
    process.execPath,
    [
      testCliPath,
      'review',
      'run',
      'plan-implementation',
      target,
      '--context',
      `.project/tickets/${TICKET_FOLDER}/spec.md`,
      '--context',
      'features/review-the-approach.feature',
      '--json',
      '--no-input',
      '--cwd',
      root,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(root, '.review-keys'),
        SAFEWORD_REVIEW_FAKE_VERDICT: reviewState === 'rejected' ? 'request_changes' : 'approve',
      },
    },
  );
  const payload = JSON.parse(reviewed.stdout) as { data?: { review_id?: string } };
  const reviewId = payload.data?.review_id;
  if (reviewId === undefined)
    throw new Error(`Implementation Plan review failed: ${reviewed.stdout}`);
  const scope = reviewScope(TICKET_FOLDER, 'impl-plan', hashArtifact(PLAN));
  const existingLedger = readFileSync(ledgerPath, 'utf8');
  writeFileSync(
    ledgerPath,
    `${existingLedger}${[
      `2026-09-11T00:00:00.000Z fixture review:${scope} author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      `2026-09-11T00:00:01.000Z fixture review:${TICKET_FOLDER}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      '',
    ].join('\n')}`,
  );
  return { root, ticketDirectory, ticketPath, ledgerPath, reviewId };
}

function mutateReview(
  project: Fixture,
  mutate: (data: Record<string, unknown>) => Record<string, unknown>,
): void {
  if (project.reviewId === undefined) throw new Error('review id missing');
  const path = nodePath.join(
    project.root,
    '.safeword',
    'state',
    'reviews',
    `${project.reviewId}.json`,
  );
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const { integrity: _integrity, ...unsigned } = record;
  const result = { ...(unsigned.result as Record<string, unknown>) };
  result.data = mutate({ ...(result.data as Record<string, unknown>) });
  const changed = { ...unsigned, result };
  const key = Buffer.from(
    readFileSync(
      nodePath.join(project.root, '.review-keys', 'safeword', 'review-integrity.key'),
      'utf8',
    ).trim(),
    'hex',
  );
  const integrity = createHmac('sha256', key)
    .update(realpathSync.native(project.root))
    .update('\0')
    .update(JSON.stringify(changed))
    .digest('hex');
  writeFileSync(path, `${JSON.stringify({ ...changed, integrity })}\n`);
}

function rewriteReviewStamps(project: Fixture, rewrite: (line: string) => string): void {
  writeFileSync(
    project.ledgerPath,
    readFileSync(project.ledgerPath, 'utf8')
      .split('\n')
      .map(line => (line.includes(`review-id:${project.reviewId}`) ? rewrite(line) : line))
      .join('\n'),
  );
}

function phase(path: string): string | undefined {
  return /^phase:\s*(\S+)/mu.exec(readFileSync(path, 'utf8'))?.[1];
}

function approvalEvents(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => line.includes(' design-decision:'));
}

function reviewEnvironment(project: Fixture): Record<string, string> {
  return { SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(project.root, '.review-keys') };
}

function decisionPayloads(path: string): Record<string, unknown>[] {
  return approvalEvents(path).map(line =>
    JSON.parse(line.slice(line.indexOf(' design-decision:') + ' design-decision:'.length)),
  ) as Record<string, unknown>[];
}

function appendCurrentReview(project: Fixture, plan: string): void {
  const reviewId = runImplementationReview(project, TICKET_FOLDER);
  const scope = reviewScope(TICKET_FOLDER, 'impl-plan', hashArtifact(plan));
  writeFileSync(
    project.ledgerPath,
    `${readFileSync(project.ledgerPath, 'utf8')}${[
      `2026-09-11T00:01:00.000Z fixture review:${scope} author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      `2026-09-11T00:01:01.000Z fixture review:${TICKET_FOLDER}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      '',
    ].join('\n')}`,
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
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...reviewEnvironment(project),
        ...environment,
      },
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
      {
        cwd: project.root,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ...reviewEnvironment(project),
          ...environment,
        },
      },
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
  const reviewId = runImplementationReview(project, folder);
  const scope = reviewScope(folder, 'impl-plan', hashArtifact(plan));
  writeFileSync(
    project.ledgerPath,
    `${readFileSync(project.ledgerPath, 'utf8')}${[
      `2026-09-11T00:02:00.000Z fixture review:${scope} author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      `2026-09-11T00:02:01.000Z fixture review:${folder}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${reviewId}`,
      '',
    ].join('\n')}`,
  );
}

function runImplementationReview(project: Fixture, ticketFolder: string): string {
  const bin = installBlockingReviewer();
  const target = `.project/tickets/${ticketFolder}/impl-plan.md`;
  const reviewed = spawnSync(
    process.execPath,
    [
      testCliPath,
      'review',
      'run',
      'plan-implementation',
      target,
      '--context',
      `.project/tickets/${ticketFolder}/spec.md`,
      '--json',
      '--no-input',
      '--cwd',
      project.root,
    ],
    {
      cwd: project.root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_NO_UPDATE_CHECK: '1',
        SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
        SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(project.root, '.review-keys'),
      },
    },
  );
  const payload = JSON.parse(reviewed.stdout) as { data?: { review_id?: string } };
  const reviewId = payload.data?.review_id;
  if (reviewed.status !== 0 || reviewId === undefined) {
    throw new Error(`Implementation Plan review failed: ${reviewed.stdout}`);
  }
  return reviewId;
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
if printf '%s' "$payload" | /usr/bin/grep -Fq '"kind":"plan-execution"'; then
  review_record=$(printenv SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD || true)
  if [ -n "$review_record" ]; then
    printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"replan approved","findings":[],"planning_destination":"plan-execution","execution_plan_record":%s}\n' "$dispatch_id" "$review_record"
    exit 0
  fi
  if printf '%s' "$payload" | /usr/bin/grep -Fq 'Accepted authorization approach changed'; then
    destination=plan-implementation
  else
    destination=plan-execution
  fi
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"implementation discovery","findings":[{"severity":"error","message":"Repair the affected plan."}],"planning_destination":"%s","execution_plan_record":null}\n' "$dispatch_id" "$destination"
  exit 0
fi
if [ "${'$'}{SAFEWORD_REVIEW_FAKE_VERDICT:-approve}" = "request_changes" ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"plan is blocked","findings":[{"severity":"error","message":"Authorization boundary is missing."}]}\n' "$dispatch_id"
else
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"plan is approved","findings":[]}\n' "$dispatch_id"
fi
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return bin;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

beforeAll(assertTestCliFresh);

describe('installed CLI human design authority follows configuration', () => {
  it('advances non-interactively and records not-required when the gate is disabled', async () => {
    const project = fixture(false);

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    const payload = JSON.parse(result.stdout) as { data?: Record<string, unknown> };
    expect(payload.data).toMatchObject({
      approval_status: 'not-required',
      achieved_independence: 'cross-agent',
    });
    expect(readFileSync(project.ledgerPath, 'utf8')).toContain('human-approval:not-required');
    expect(approvalEvents(project.ledgerPath)).toEqual([]);
  });

  it('creates the feature checklist only inside the canonical Execution Plan', async () => {
    const project = fixture(false);
    const filesBefore = projectFiles(project.root);

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode, result.stdout).toBe(0);
    const planPath = nodePath.join(project.ticketDirectory, 'execution-plan.md');
    expect(existsSync(planPath), 'approve-plan must scaffold execution-plan.md').toBe(true);
    const executionPlan = readFileSync(planPath, 'utf8');
    expect(executionPlan).toContain('<!-- safeword:delivery-checklist:v1 -->');
    expect(executionPlan).toMatch(/^\|\s*completion-evidence\s*\|\s*completion evidence\s*\|/mu);
    const createdFiles = projectFiles(project.root).filter(path => !filesBefore.includes(path));
    expect(createdFiles).toEqual([
      nodePath.join('.project', 'tickets', TICKET_FOLDER, 'execution-plan.md'),
    ]);
  });

  it('fails closed when the approval configuration is malformed', async () => {
    const project = fixture(true);
    writeFileSync(nodePath.join(project.root, '.safeword', 'config.json'), '{not-json\n');
    const ledgerBefore = readFileSync(project.ledgerPath, 'utf8');

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(1);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(readFileSync(project.ledgerPath, 'utf8')).toBe(ledgerBefore);
    expect(result.stdout).toContain(
      'Could not determine whether human design approval is required',
    );
    expect(result.stdout).not.toContain('human-approval:not-required');
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
      env: reviewEnvironment(project),
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

describe('implementation-time discoveries return to the affected planning phase', () => {
  it.each([
    ['the order of independent build tasks changed', 'plan-execution', 'plan-execution'],
    ['Accepted authorization approach changed', 'plan-implementation', 'plan-implementation'],
  ] as const)(
    'routes %s repair from implementation through the installed CLI',
    async (discovery, planningDestination, expectedPhase) => {
      const project = fixture(false);
      writeFileSync(
        project.ticketPath,
        readFileSync(project.ticketPath, 'utf8').replace(
          'phase: plan-implementation',
          'phase: implement',
        ),
      );
      const executionPlanPath = nodePath.join(project.ticketDirectory, 'execution-plan.md');
      const discoveredPlan = replanExecutionPlan(discovery);
      writeFileSync(executionPlanPath, discoveredPlan);
      const retainedProofRow = discoveredPlan
        .split('\n')
        .find(line => line.startsWith('| item-4 |'));
      expect(retainedProofRow).toEqual(expect.any(String));
      const reviewerBin = installBlockingReviewer();
      const executionReviewArguments = [
        '--json',
        '--no-input',
        'review',
        'run',
        'plan-execution',
        nodePath.relative(project.root, executionPlanPath),
        '--context',
        nodePath.relative(project.root, nodePath.join(project.ticketDirectory, 'impl-plan.md')),
        '--context',
        'features/review-the-approach.feature',
        '--cwd',
        project.root,
      ];
      const reviewed = await runCli(executionReviewArguments, {
        cwd: project.root,
        env: {
          PATH: `${reviewerBin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
          SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
          ...reviewEnvironment(project),
        },
      });
      expect(reviewed.exitCode, reviewed.stdout).toBe(2);
      expect(reviewed.stdout).toContain(`"planning_destination":"${planningDestination}"`);

      const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
        cwd: project.root,
        env: reviewEnvironment(project),
      });

      expect(result.exitCode, result.stdout).toBe(2);
      expect(phase(project.ticketPath)).toBe(expectedPhase);
      expect(result.stdout).toContain('EXECUTION_DISCOVERY_APPLIED');
      expect(result.stdout).toContain(`"planning_destination":"${planningDestination}"`);

      if (planningDestination === 'plan-implementation') {
        const revisedImplementationPlan = `${PLAN}\nAccepted authorization uses the revised boundary.\n`;
        writeFileSync(
          nodePath.join(project.ticketDirectory, 'impl-plan.md'),
          revisedImplementationPlan,
        );
        appendCurrentReview(project, revisedImplementationPlan);
        const implementationApproved = await runCli(
          ['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID],
          { cwd: project.root, env: reviewEnvironment(project) },
        );
        expect(implementationApproved.exitCode, implementationApproved.stdout).toBe(0);
      }

      expect(phase(project.ticketPath)).toBe('plan-execution');
      const repairedPlan = readFileSync(executionPlanPath, 'utf8').replace(
        `Implementation discovery: ${discovery}.`,
        'Implementation discovery: reviewed repair is complete.',
      );
      writeFileSync(executionPlanPath, repairedPlan);
      const executionApproved = await runCli(executionReviewArguments, {
        cwd: project.root,
        env: {
          PATH: `${reviewerBin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_NO_UPDATE_CHECK: '1',
          SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
          SAFEWORD_REVIEW_FAKE_EXECUTION_PLAN_RECORD: JSON.stringify(
            executionPlanRecord(repairedPlan),
          ),
          ...reviewEnvironment(project),
        },
      });
      expect(executionApproved.exitCode, executionApproved.stdout).toBe(0);
      expect(executionApproved.stdout).toContain('"status":"approved"');
      const finalPlan = readFileSync(executionPlanPath, 'utf8');
      expect(finalPlan).toContain(retainedProofRow);
      const parsedFinalPlan = parseDeliveryPlanContract(finalPlan);
      if (!parsedFinalPlan.ok) throw new Error(parsedFinalPlan.message);
      expect(parsedFinalPlan.items.find(item => item.id === 'item-4')).toMatchObject({
        evidenceClass: 'reusable_earlier_revision',
        disposition: 'complete',
      });
      const proofMarker = nodePath.join(project.root, '.proof-reran');
      expect(existsSync(proofMarker)).toBe(false);
      const proof = parsedFinalPlan.specifications.find(
        specification => specification.id === 'proof',
      );
      if (proof?.invocation.type !== 'command') throw new Error('proof command missing');
      const control = spawnSync(proof.invocation.argv[0], proof.invocation.argv.slice(1), {
        cwd: project.root,
      });
      expect(control.status).toBe(0);
      expect(existsSync(proofMarker)).toBe(true);
      unlinkSync(proofMarker);
      const implementationReviews = readFileSync(project.ledgerPath, 'utf8').match(
        /phase@plan-implementation/gu,
      );
      expect(implementationReviews).toHaveLength(
        planningDestination === 'plan-implementation' ? 2 : 1,
      );
    },
  );
});

describe('an accepted design enters Execution Planning', () => {
  it('binds the approval to the exact approach bytes before advancing', () => {
    const project = fixture(true);
    const digest = createHash('sha256').update(PLAN).digest('hex');

    const result = runApprovalInPty(project, 'y');

    expect(result.status).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(
      readFileSync(nodePath.join(project.ticketDirectory, 'execution-plan.md'), 'utf8'),
    ).toContain('<!-- safeword:delivery-checklist:v1 -->');
    expect(result.stdout).toContain(
      `Approved approach: .project/tickets/${TICKET_FOLDER}/impl-plan.md at ${digest}`,
    );
    const events = approvalEvents(project.ledgerPath);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain(`"planDigest":"${digest}"`);
    expect(events[0]).toContain('"decision":"approved"');
  });
});

describe('Implementation Plan review admission controls Execution Planning', () => {
  it('blocks when the project-local Implementation Plan is absent', async () => {
    const project = fixture(false);
    rmSync(nodePath.join(project.ticketDirectory, 'impl-plan.md'));

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).not.toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain('impl-plan.md');
  });

  it('rejects a current stamp with no authenticated review receipt', async () => {
    const project = fixture(false);
    rewriteReviewStamps(project, line =>
      line.replace(
        `review-id:${project.reviewId}`,
        'review-id:42000000-0000-4000-8000-000000000019',
      ),
    );

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain(
      'has no current authenticated Implementation Plan review receipt',
    );
  });

  it('rejects an authenticated receipt for earlier plan bytes', async () => {
    const project = fixture(false);
    const changedPlan = `${PLAN}\nA later unreviewed decision.\n`;
    writeFileSync(nodePath.join(project.ticketDirectory, 'impl-plan.md'), changedPlan);
    const scope = reviewScope(TICKET_FOLDER, 'impl-plan', hashArtifact(changedPlan));
    writeFileSync(
      project.ledgerPath,
      `${readFileSync(project.ledgerPath, 'utf8')}${[
        `2026-09-11T00:01:00.000Z fixture review:${scope} author:codex reviewer:claude independence:cross-agent review-id:${project.reviewId}`,
        `2026-09-11T00:01:01.000Z fixture review:${TICKET_FOLDER}:phase@plan-implementation author:codex reviewer:claude independence:cross-agent review-id:${project.reviewId}`,
        '',
      ].join('\n')}`,
    );

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain(
      'has no current authenticated Implementation Plan review receipt',
    );
  });

  it('reports a rejected semantic verdict instead of treating its stamp as approval', async () => {
    const project = fixture(false, 'rejected');

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain('Authorization boundary is missing.');
  });

  it('rejects an approving receipt with no achieved independence', async () => {
    const project = fixture(false);
    mutateReview(project, data => {
      const { independence: _independence, ...withoutIndependence } = data;
      return withoutIndependence;
    });

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain('has no validated achieved independence');
  });

  it('rejects assurance text that disagrees with the authenticated review', async () => {
    const project = fixture(false);
    rewriteReviewStamps(project, line =>
      line.replace('independence:cross-agent', 'independence:degraded'),
    );

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain(
      'recorded assurance disagrees with the authenticated Implementation Plan review',
    );
  });

  it('rejects a self-authored cross-agent claim', async () => {
    const project = fixture(false);
    mutateReview(project, data => ({
      ...data,
      author_agent: 'claude',
      actual_reviewer: 'claude',
    }));
    rewriteReviewStamps(project, line =>
      line.replace('author:codex reviewer:claude', 'author:claude reviewer:claude'),
    );

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode).toBe(2);
    expect(phase(project.ticketPath)).toBe('plan-implementation');
    expect(result.stdout).toContain(
      'self-authored cross-agent claim did not establish achieved independence',
    );
  });

  it('preserves a permitted fallback as degraded assurance', async () => {
    const project = fixture(false);
    mutateReview(project, data => ({ ...data, independence: 'degraded' }));
    rewriteReviewStamps(project, line =>
      line.replace('independence:cross-agent', 'independence:degraded'),
    );

    const result = await runCli(['--json', '--no-input', 'ticket', 'approve-plan', TICKET_ID], {
      cwd: project.root,
      env: reviewEnvironment(project),
    });

    expect(result.exitCode, result.stdout).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: { approval_status: 'not-required', achieved_independence: 'degraded' },
    });
  });
});

describe('a review-blocked design is never presented for human approval', () => {
  it('returns the current semantic finding before crossing the prompt boundary', async () => {
    const project = fixture(true, 'missing');
    const bin = installBlockingReviewer();
    const keyRoot = nodePath.join(project.root, 'review-integrity');
    const environment = {
      PATH: `${bin}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_FOREGROUND_MS: '5000',
      SAFEWORD_REVIEW_KEY_ROOT: keyRoot,
      SAFEWORD_REVIEW_FAKE_VERDICT: 'request_changes',
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

  it('enters Execution Planning when the changed approach is approved', () => {
    const project = fixture(true);
    expect(runApprovalInPty(project, 'y').status).toBe(0);
    const changedPlan = `${PLAN}\nA newly approved authorization boundary.\n`;
    writeFileSync(nodePath.join(project.ticketDirectory, 'impl-plan.md'), changedPlan);
    appendCurrentReview(project, changedPlan);

    const resumed = runApprovalInPty(project, 'y');

    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain('Approve this reviewed Implementation Plan?');
    expect(resumed.stdout).toContain(
      `Approved approach: .project/tickets/${TICKET_FOLDER}/impl-plan.md`,
    );
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(decisionPayloads(project.ledgerPath).at(-1)).toMatchObject({
      decision: 'approved',
      planDigest: createHash('sha256').update(changedPlan).digest('hex'),
    });
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

  it('records a fresh approval after an earlier approval was superseded', () => {
    const project = fixture(true);
    const digest = createHash('sha256').update(PLAN).digest('hex');
    const identity = (decision: 'approved' | 'declined') => ({
      authorityRef: 'interactive-cli',
      decision,
      planDigest: digest,
      ticket: TICKET_ID,
    });
    expect(appendDesignDecision(project.ledgerPath, identity('approved'))).toEqual({
      status: 'written',
    });
    expect(appendDesignDecision(project.ledgerPath, identity('declined'))).toEqual({
      status: 'written',
    });

    const result = runApprovalInPty(project, 'y');

    expect(result.status).toBe(0);
    expect(phase(project.ticketPath)).toBe('plan-execution');
    expect(decisionPayloads(project.ledgerPath)).toHaveLength(3);
    expect(decisionPayloads(project.ledgerPath).at(-1)).toMatchObject({
      appendPosition: 3,
      decision: 'approved',
      planDigest: digest,
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
