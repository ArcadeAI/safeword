import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  createExecutionPlanDeliveryDefinition,
  normalizedExecutionPlanDigest,
  parseDeliveryPlanContract,
} from '../../src/execution-plan/delivery-checklist.js';
import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { parseFrontmatter } from '../../templates/hooks/lib/hierarchy.js';
import {
  createConfiguredProject,
  createTemporaryDirectory,
  runCli,
  testCliPath,
} from '../helpers.js';
import { writePlanningInventories } from '../planning-fixtures.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const roots: string[] = [];
const ticketId = 'DIS123';
const folder = `.project/tickets/${ticketId}-review-disposition`;
const target = `${folder}/spec.md`;
const suggestion = 'Consider adding an optional approval audit export.';
const cli = testCliPath;
type Kind = 'quality-review' | 'plan-implementation' | 'plan-execution';
type PromptEdit = string | { path: string; before: string; after: string };

function executionFixture() {
  const plan = EXECUTION_PLAN_CONFORMANCE_CASES.find(
    row => row.id === 'one-coherent-change',
  )?.execution_plan;
  if (plan === undefined) throw new Error('Missing accepted execution fixture');
  const parsed = parseDeliveryPlanContract(plan);
  if (!parsed.ok) throw new Error(parsed.message);
  return {
    plan,
    record: {
      slicing_decision: 'one_pull_request',
      rationale: 'One coherent approval change.',
      slices: [
        {
          name: 'Complete delivery',
          purpose: 'Preserve reviewed approval.',
          boundary: 'The reviewed delivery boundary.',
          prerequisites: [],
          proof: 'The real CLI test passes.',
          completion_signal: 'The command retains approval.',
          relies_on_unmerged_successor: false,
        },
      ],
      obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
      decision_statuses: [{ decision: 'Use one coordinator', status: 'unchanged' }],
      accepted_scenarios_covered: true,
      accepted_approach_preserved: true,
      normalized_plan_digest: normalizedExecutionPlanDigest(plan),
      delivery_definition: createExecutionPlanDeliveryDefinition(parsed, false),
    },
  };
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
  cleanupTrustedReviewerDirectories();
});

async function reviewedProject(
  severity: 'info' | 'warning' | 'error' = 'warning',
  kind: Kind = 'quality-review',
  findingMessage = suggestion,
  terminalFormat: 'json' | 'text' = 'json',
) {
  const root = createTemporaryDirectory();
  roots.push(root);
  await createConfiguredProject(root);
  writePlanningInventories(root);
  mkdirSync(nodePath.join(root, folder), { recursive: true });
  const ticketPath = nodePath.join(root, folder, 'ticket.md');
  writeFileSync(
    ticketPath,
    `---\nid: ${ticketId}\ntype: feature\nproduct_plan_contract: v1\nphase_anchors:\n  - scenario-gate: features/approval.feature\nscope:\n  - preserve current approval\nout_of_scope:\n  - optional audit export\n---\n`,
  );
  writeFileSync(
    nodePath.join(root, target),
    `# Product Plan

## Product Bet

- **Expected outcome:** Builder can trust current approval.
- **Persona outcome inventory:** Builder receives current approval.
- **Known facts:** Approval is authenticated.
- **Assumptions:** Review remains available.
- **Unresolved product decisions:** none
- **Success threshold:** Current approval advances.
- **Project non-goals:** No optional audit export.

## Jobs To Be Done

### approval.BU1 — Trust approval

**Persona:** Builder (BU)

#### approval.BU1.R1 — Preserve approval

Only current approval advances.

## Shape

### M1 — Current approval

- **Outcome:** Review is current.
- **Non-goals:** Optional audit export.

## Surfaces

Affected:
- Safeword CLI
`,
  );
  mkdirSync(nodePath.join(root, 'features'), { recursive: true });
  writeFileSync(
    nodePath.join(root, 'features/approval.feature'),
    'Feature: Preserve approval\n  Scenario: Current approval\n    Given current evidence\n',
  );
  const impl = `${folder}/impl-plan.md`;
  writeFileSync(
    nodePath.join(root, impl),
    '# Implementation Plan\n\n**Status:** accepted\n\n## Approach\n\nPreserve current approval.\n\n## Decisions\n\nPreserve the coordinator.\n\n## Architecture applicability\n\nskip: no durable architecture records apply\n\n## Data applicability\n\nskip: no product data is stored\n',
  );
  const execution = executionFixture();
  writeFileSync(nodePath.join(root, folder, 'execution-plan.md'), execution.plan);
  const workTarget = {
    'quality-review': target,
    'plan-implementation': impl,
    'plan-execution': `${folder}/execution-plan.md`,
  }[kind];
  const contexts = {
    'quality-review': [],
    'plan-implementation': ['--context', target, 'features/approval.feature'],
    'plan-execution': ['--context', impl, target, 'features/approval.feature'],
  }[kind];
  const reviewer = createTrustedReviewerDirectory('safeword-disposition-');
  writeFileSync(
    nodePath.join(reviewer, 'claude'),
    String.raw`#!${process.execPath}
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const packet = JSON.parse(input.trim().split('\n').pop());
  console.log(JSON.stringify({ structured_output: {
    schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    verdict: ${JSON.stringify(severity === 'error' ? 'request_changes' : 'approve')},
    summary: packet.review_disposition_context?.records[0]
      ? 'The user decline for ' + packet.review_disposition_context.records[0].message + ' is ' + packet.review_disposition_context.records[0].boundary_status + ' in ticket context.'
      : 'The accepted boundary remains intact.',
    findings: [{ severity: ${JSON.stringify(severity)}, message: ${JSON.stringify(findingMessage)} }],
    planning_destination: ${kind === 'plan-execution' ? "'plan-execution'" : 'undefined'},
    execution_plan_record: ${kind === 'plan-execution' ? JSON.stringify(execution.record) : 'undefined'},
  } }));
});
`,
    { mode: 0o755 },
  );
  const run = (args: string[]) =>
    runCli([...args, '--cwd', root, '--json', '--no-input'], {
      cwd: root,
      env: { PATH: `${reviewer}:/usr/bin:/bin`, SAFEWORD_AGENT_RUNTIME: 'codex' },
    });
  const reviewed = await run(['review', 'run', kind, workTarget, ...contexts]);
  expect(reviewed.exitCode, `${reviewed.stdout}\n${reviewed.stderr}`).toBe(
    severity === 'error' ? 2 : 0,
  );
  const data = JSON.parse(reviewed.stdout).data as { status: string; review_id: string };
  expect(data.status).toBe(severity === 'error' ? 'changes_requested' : 'approved');
  const terminal = (answer: string, reviewId: string, findingNumber = '1', edit: PromptEdit = '') =>
    spawnSync(
      'python3',
      [
        '-c',
        String.raw`import json, os, pty, select, subprocess, sys
master, slave = pty.openpty()
child = subprocess.Popen(sys.argv[4:], stdin=slave, stdout=slave, stderr=slave)
os.close(slave)
answered = False
output = bytearray()
while True:
    ready, _, _ = select.select([master], [], [], 0.1)
    if ready:
        try:
            part = os.read(master, 65536)
        except OSError:
            break
        if not part:
            break
        output.extend(part)
        if not answered and b'Record this decline in the ticket?' in output:
            if sys.argv[3]:
                if sys.argv[3].startswith('{'):
                    edit = json.loads(sys.argv[3])
                    with open(sys.argv[2]) as source:
                        content = source.read()
                    if edit['before'] not in content:
                        raise RuntimeError('The confirmation edit did not match its source')
                    with open(sys.argv[2], 'w') as source:
                        source.write(content.replace(edit['before'], edit['after']))
                else:
                    with open(sys.argv[2], 'a') as ticket:
                        ticket.write(sys.argv[3])
            os.write(master, (sys.argv[1] + '\n').encode())
            answered = True
    if child.poll() is not None and not ready:
        break
os.close(master)
sys.stdout.buffer.write(output)
sys.exit(child.wait())`,
        answer,
        typeof edit === 'string' ? ticketPath : edit.path,
        typeof edit === 'string' ? edit : JSON.stringify(edit),
        process.execPath,
        cli,
        'ticket',
        'record-review-disposition',
        ticketId,
        reviewId,
        findingNumber,
        '--reason',
        'Outside the accepted scope.',
        '--cwd',
        root,
        ...(terminalFormat === 'json' ? ['--json'] : []),
      ],
      {
        cwd: root,
        input: `${answer}\n`,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: `${reviewer}:${process.env.PATH ?? ''}`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          TERM: 'xterm',
        },
      },
    );
  return { run, terminal, ticketPath, reviewId: data.review_id };
}

describe('user-owned planning review disposition', () => {
  it('safely renders the pending human result after declined confirmation', async () => {
    const message = 'Visible\u{1B}[31m\u{7}\u{202E}\u{2066}\u{2028}\u{2029}review advice';
    const project = await reviewedProject('warning', 'quality-review', message, 'text');
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = project.terminal('n', project.reviewId);
    expect(result.stdout).toContain('requires interactive confirmation: Visible');
    expect(result.stdout).not.toMatch(/[\p{Cf}\p{Zl}\p{Zp}]/u);
    // Readline may emit cursor controls outside the reviewer-owned text.
    const displayed = result.stdout
      .split('Declining this warning finding requires interactive confirmation: ', 2)[1]
      ?.trimEnd();
    expect(displayed).toBe('Visible [31m     review advice');
    expect(displayed).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });

  it.each([
    ['terminal controls', 'Visible\u{1B}[31m\u{7}\u{202E}\u{2066}\u{2028}\u{2029}\nreview advice'],
    ['oversized prose', `Advice ${'x'.repeat(2500)}`],
  ])(
    'safely displays %s at confirmation while preserving the recorded finding',
    async (_label, message) => {
      const project = await reviewedProject('warning', 'quality-review', message);
      const result = project.terminal('y', project.reviewId);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const displayed = result.stdout
        .split('Finding (warning): ', 2)[1]
        ?.split('Accepted boundary: ', 1)[0]
        ?.trimEnd();
      expect(displayed).toBeDefined();
      expect(displayed).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
      expect(displayed?.length).toBeLessThanOrEqual(2000);
      const metadata = parse(readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '');
      expect(metadata.review_dispositions).toEqual([
        expect.objectContaining({ finding_message: message, review_id: project.reviewId }),
      ]);
    },
  );

  it.each([
    ['info', 'quality-review'],
    ['warning', 'plan-implementation'],
    ['warning', 'plan-execution'],
  ] as const)('records an optional %s finding for %s', async (severity, kind) => {
    const project = await reviewedProject(severity, kind);
    const result = project.terminal('y', project.reviewId);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const metadata = parse(readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '');
    expect(metadata.review_dispositions).toEqual([
      expect.objectContaining({
        review_id: project.reviewId,
        review_kind: kind,
        finding_severity: severity,
        finding_message: suggestion,
        // Persisted compatibility: these bytes predate the fingerprint helper extraction.
        finding_fingerprint:
          severity === 'info'
            ? '4f1b748873a9fb477f449a3c83ad111e146f34781778d96a613f850994b927d3'
            : 'ef0132d4d205eb389bbb4e97594bbd8795d506e9c31066c957c179892637dcb6',
      }),
    ]);
  });

  it.each(['1e0', '01', ' 1 '])(
    'retains existing equivalent finding spelling %j',
    async spelling => {
      const project = await reviewedProject();
      const result = project.terminal('y', project.reviewId, spelling);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const metadata = parse(readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '');
      expect(metadata.review_dispositions).toEqual([
        expect.objectContaining({ review_id: project.reviewId, finding_message: suggestion }),
      ]);
    },
  );

  it.each([
    [
      'accepted boundary',
      'spec.md',
      'No optional audit export.',
      'No optional audit export or new policy.',
    ],
    [
      'review currency',
      '../../principles.md',
      'Current authenticated approval controls advancement.',
      'Only a newly authenticated approval controls advancement.',
    ],
  ])(
    'refuses changed %s during confirmation with unchanged ticket bytes',
    async (_label, relative, beforeText, afterText) => {
      const project = await reviewedProject();
      const before = readFileSync(project.ticketPath, 'utf8');
      const path = nodePath.resolve(nodePath.dirname(project.ticketPath), relative);
      const source = readFileSync(path, 'utf8');
      expect(source).toContain(beforeText);
      const result = project.terminal('y', project.reviewId, '1', {
        path,
        before: beforeText,
        after: afterText,
      });
      expect(result.stdout, result.stderr).toContain('REVIEW_DISPOSITION_STALE');
      expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
      expect(readFileSync(path, 'utf8')).toBe(source.replace(beforeText, () => afterText));
    },
  );

  it('refuses a current authenticated scenario-gate review as an unsupported disposition kind', async () => {
    const project = await reviewedProject();
    const review = await project.run([
      'review',
      'run',
      'scenario-gate',
      'features/approval.feature',
      '--context',
      target,
    ]);
    expect(review.exitCode, `${review.stdout}\n${review.stderr}`).toBe(0);
    const data = JSON.parse(review.stdout).data;
    expect(data.status).toBe('approved');
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = project.terminal('y', data.review_id);
    expect(result.stdout, result.stderr).toContain('REVIEW_NOT_CURRENT');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('preserves long ticket lists for the installed hook reader after a decline', async () => {
    const project = await reviewedProject();
    const longScope =
      'Preserve the authenticated approval of a planning review even when a contributor has written a detailed implementation note about the accepted behavior.';
    writeFileSync(
      project.ticketPath,
      readFileSync(project.ticketPath, 'utf8').replace(
        '  - preserve current approval',
        () =>
          `  - ${longScope}\n  - preserve current approval\nphase_skips:\n  - 'intake → define-behavior: approved scope already exists'\n  - 'scenario-gate → plan-implementation: accepted scenarios already exist'`,
      ),
    );
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, fresh.stdout).toBe(0);
    const reviewId = (JSON.parse(fresh.stdout).data as { review_id: string }).review_id;

    const confirmed = project.terminal('y', reviewId);
    expect(confirmed.status, `${confirmed.stdout}\n${confirmed.stderr}`).toBe(0);
    const frontmatter = readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '';
    const parsed = parseFrontmatter(frontmatter);
    expect(parsed.scope).toEqual([longScope, 'preserve current approval']);
    expect(parsed.phase_skips).toHaveLength(2);
  });

  it('retains prior declines when a fresh review receives another disposition', async () => {
    const project = await reviewedProject();
    const first = project.terminal('y', project.reviewId);
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, fresh.stdout).toBe(0);
    const reviewId = JSON.parse(fresh.stdout).data.review_id as string;
    const second = project.terminal('y', reviewId);
    expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);
    const frontmatter = readFileSync(project.ticketPath, 'utf8').split('---', 2)[1] ?? '';
    const metadata = parse(frontmatter) as {
      review_dispositions: { review_id: string; reason: string }[];
    };
    expect(metadata.review_dispositions).toMatchObject([
      { review_id: project.reviewId, reason: 'Outside the accepted scope.' },
      { review_id: reviewId, reason: 'Outside the accepted scope.' },
    ]);
    expect(metadata.review_dispositions).toHaveLength(2);
  });

  it('refuses an unauthenticated review without changing the ticket', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = project.terminal('y', '00000000-0000-4000-8000-000000000000');
    expect(result.stdout, result.stderr).toContain('REVIEW_NOT_CURRENT');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });

  it.each(['0', '2', '1.5'])('refuses invalid finding number %s', async number => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = project.terminal('y', project.reviewId, number);
    expect(result.stdout, result.stderr).toContain('INVALID_REVIEW_FINDING');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('refuses a blocking error without writing a decline', async () => {
    const project = await reviewedProject('error');
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = project.terminal('y', project.reviewId);
    expect(result.stdout, result.stderr).toContain('REVIEW_NOT_CURRENT');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('refuses another ticket’s authenticated current finding', async () => {
    const project = await reviewedProject();
    const other = nodePath.join(nodePath.dirname(project.ticketPath), '../DIS456-other');
    mkdirSync(other);
    writeFileSync(
      nodePath.join(other, 'ticket.md'),
      readFileSync(project.ticketPath, 'utf8').replace('DIS123', 'DIS456'),
    );
    const sourceSpec = nodePath.join(nodePath.dirname(project.ticketPath), 'spec.md');
    writeFileSync(nodePath.join(other, 'spec.md'), readFileSync(sourceSpec));
    const result = await project.run([
      'review',
      'run',
      'quality-review',
      '.project/tickets/DIS456-other/spec.md',
    ]);
    expect(result.exitCode, result.stdout).toBe(0);
    const reviewId = JSON.parse(result.stdout).data.review_id as string;
    const before = readFileSync(project.ticketPath, 'utf8');
    const refused = project.terminal('y', reviewId);
    expect(refused.stdout, refused.stderr).toContain('INVALID_REVIEW_FINDING');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('preserves an edit made after the confirmation prompt', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const edit = '\nConcurrent author note.\n';
    const result = project.terminal('y', project.reviewId, '1', edit);
    expect(result.stdout, result.stderr).toContain('REVIEW_DISPOSITION_STALE');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before + edit);
  });

  it('leaves an authenticated optional finding pending in noninteractive mode', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const result = await project.run([
      'ticket',
      'record-review-disposition',
      ticketId,
      project.reviewId,
      '1',
      '--reason',
      'Outside the accepted scope.',
    ]);
    const output = JSON.parse(result.stdout);
    expect(output.state).toBe('action_required');
    expect(output.data).toMatchObject({ status: 'pending', review_id: project.reviewId });
    expect(JSON.stringify(output)).toContain(suggestion);
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
  it('records an explicit local decline and stales the matching review', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    const refused = project.terminal('n', project.reviewId);
    expect(refused.stdout, refused.stderr).toContain('"status":"pending"');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
    const confirmed = project.terminal('y', project.reviewId);
    expect(confirmed.status, `${confirmed.stdout}\n${confirmed.stderr}`).toBe(0);
    expect(readFileSync(project.ticketPath, 'utf8')).toContain('review_dispositions:');
    const status = await project.run(['review', 'status', project.reviewId]);
    expect(JSON.parse(status.stdout).data.status).toBe('stale');
    const fresh = await project.run(['review', 'run', 'quality-review', target]);
    expect(fresh.exitCode, `${fresh.stdout}\n${fresh.stderr}`).toBe(0);
    expect(fresh.stdout).toContain(
      `The user decline for ${suggestion} is current in ticket context.`,
    );
    expect(fresh.stdout).toContain(suggestion);
    writeFileSync(
      project.ticketPath,
      readFileSync(project.ticketPath, 'utf8').replace(
        'preserve current approval',
        'expand approval',
      ),
    );
    const changedBoundary = await project.run(['review', 'run', 'quality-review', target]);
    expect(changedBoundary.exitCode, `${changedBoundary.stdout}\n${changedBoundary.stderr}`).toBe(
      0,
    );
    expect(changedBoundary.stdout).toContain(
      `The user decline for ${suggestion} is superseded in ticket context.`,
    );
  });
  it('leaves the ticket untouched when another disposition writer owns its lock', async () => {
    const project = await reviewedProject();
    const before = readFileSync(project.ticketPath, 'utf8');
    writeFileSync(`${project.ticketPath}.review-disposition.lock`, String(process.pid));
    const result = project.terminal('y', project.reviewId);
    expect(result.stdout).toContain('REVIEW_DISPOSITION_WRITE_UNAVAILABLE');
    expect(readFileSync(project.ticketPath, 'utf8')).toBe(before);
  });
});
