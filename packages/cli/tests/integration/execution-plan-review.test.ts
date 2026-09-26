import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { reviewerPromptInstructions } from '../../src/review/review-rubric.js';
import { createTemporaryDirectory, runCli } from '../helpers.js';
import {
  cleanupTrustedReviewerDirectories,
  createTrustedReviewerDirectory,
  REVIEWER_CAPABILITIES,
} from '../review-fixtures.js';

const projects: string[] = [];
const JSON_NULL = JSON.parse('null') as null;

afterAll(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
  cleanupTrustedReviewerDirectories();
});

function projectFixture(): {
  root: string;
  plan: string;
  context: string[];
  bin: string;
  pluginRoot: string;
} {
  const root = createTemporaryDirectory();
  projects.push(root);
  const ticket = nodePath.join(root, '.project', 'tickets', 'TEST-execution-review');
  mkdirSync(ticket, { recursive: true });
  const source = EXECUTION_PLAN_CONFORMANCE_CASES[0];
  if (source === undefined) throw new Error('Missing Execution Plan fixture');
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: TEST\ntype: feature\nphase: plan-execution\nstatus: in_progress\n---\n',
  );
  writeFileSync(nodePath.join(ticket, 'execution-plan.md'), source.execution_plan);
  writeFileSync(nodePath.join(ticket, 'impl-plan.md'), source.implementation_plan);
  mkdirSync(nodePath.join(ticket, 'features'));
  writeFileSync(nodePath.join(ticket, 'features', 'behavior.feature'), source.scenario);
  mkdirSync(nodePath.join(root, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(root, '.safeword', 'config.json'),
    JSON.stringify({ crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] } }),
  );
  const trusted = createTrustedReviewerDirectory('safeword-execution-review-');
  const runtime = nodePath.join(trusted, 'runtime');
  mkdirSync(runtime);
  writeFileSync(
    nodePath.join(runtime, 'cli.js'),
    `import ${JSON.stringify(nodePath.resolve(__dirname, '../../src/cli.ts'))};\n`,
  );
  const bin = nodePath.join(trusted, 'bin');
  mkdirSync(bin);
  const executable = nodePath.join(bin, 'claude');
  writeFileSync(
    executable,
    String.raw`#!${process.execPath}
if (process.argv.includes('--version')) { console.log('claude 1.0.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log(${JSON.stringify(REVIEWER_CAPABILITIES.claude)}); process.exit(0); }
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  require('node:fs').writeFileSync(process.env.SAFEWORD_REVIEW_PROMPT_LOG, input);
  const packet = JSON.parse(input.slice(input.lastIndexOf('\n') + 1));
  const verdict = process.env.SAFEWORD_REVIEW_FAKE_VERDICT;
  const source = process.env.SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET;
  if (source) {
    const current = require('node:fs').readFileSync(source, 'utf8');
    const changed = current.replace('| behavior-boundary | open |', '| plan-integrity | open |');
    if (changed === current) throw new Error('Missing proof cell to mutate');
    require('node:fs').writeFileSync(source, changed);
  }
  const record = verdict === 'request_changes' ? null : {
    slicing_decision: 'one_pull_request',
    rationale: 'One coherent, independently proven change.',
    slices: [{ name: 'Complete delivery', purpose: 'Deliver the accepted behavior',
      boundary: 'One supported merge', prerequisites: [], proof: 'Run accepted boundary tests',
      completion_signal: 'Passing tests and a supported repository', relies_on_unmerged_successor: false }],
    obligation_owners: [{ obligation: 'Accepted behavior', slices: ['Complete delivery'] }],
    decision_statuses: [{ decision: 'One shared authorization service owns permission checks for every transport.', status: 'unchanged' }],
    accepted_scenarios_covered: true,
    accepted_approach_preserved: true,
    normalized_plan_digest: packet.execution_plan_normalized_digest,
    delivery_definition: packet.execution_plan_delivery_definition,
  };
  if (process.env.SAFEWORD_REVIEW_FAKE_IDENTITY === 'invalid-record' && record) {
    record.accepted_scenarios_covered = false;
  }
  if (process.env.SAFEWORD_REVIEW_FAKE_IDENTITY === 'echo-digest-mismatch' && record) {
    record.normalized_plan_digest = '0'.repeat(64);
  }
  if (process.env.SAFEWORD_REVIEW_FAKE_IDENTITY === 'echo-definition-mismatch' && record) {
    record.delivery_definition.checklist_items[0].obligation = 'A different obligation';
  }
  const output = { schema_version: 1, dispatch_id: packet.dispatch_id, reviewer_agent: 'claude',
    verdict: verdict === 'request_changes' ? 'request_changes' : 'approve',
    summary: verdict === 'request_changes' ? 'Missing boundary proof.' : 'Execution Plan is reviewable.',
    findings: verdict === 'request_changes' ? [{ severity: 'error', message: 'Missing boundary proof.' }] : [],
    planning_destination: 'plan-execution', execution_plan_record: record };
  console.log(JSON.stringify(output));
});
`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);
  return {
    root,
    plan: '.project/tickets/TEST-execution-review/execution-plan.md',
    context: [
      '.project/tickets/TEST-execution-review/impl-plan.md',
      '.project/tickets/TEST-execution-review/features/behavior.feature',
    ],
    bin,
    pluginRoot: trusted,
  };
}

async function review(
  fixture: ReturnType<typeof projectFixture>,
  mode:
    | 'approve'
    | 'deny'
    | 'source-change'
    | 'invalid-record'
    | 'echo-digest-mismatch'
    | 'echo-definition-mismatch',
) {
  return runCli(
    [
      'review',
      'run',
      'plan-execution',
      fixture.plan,
      ...fixture.context.flatMap(path => ['--context', path]),
      '--json',
      '--no-input',
      '--cwd',
      fixture.root,
    ],
    {
      cwd: fixture.root,
      env: {
        PATH: `${fixture.bin}:/usr/bin:/bin`,
        SAFEWORD_AGENT_RUNTIME: 'codex',
        SAFEWORD_REVIEW_FAKE_VERDICT: mode === 'deny' ? 'request_changes' : 'approve',
        SAFEWORD_REVIEW_FAKE_SOURCE_MUTATE_TARGET:
          mode === 'source-change' ? nodePath.join(fixture.root, fixture.plan) : '',
        SAFEWORD_REVIEW_FAKE_IDENTITY:
          mode.startsWith('echo-') || mode === 'invalid-record' ? mode : '',
        SAFEWORD_REVIEW_PROMPT_LOG: nodePath.join(fixture.root, 'reviewer-prompt.txt'),
        SAFEWORD_NO_UPDATE_CHECK: '1',
      },
    },
  );
}

async function storedReview(
  fixture: ReturnType<typeof projectFixture>,
  id: string,
  expectedExitCode = 0,
) {
  const status = await runCli(
    ['review', 'status', id, '--json', '--no-input', '--cwd', fixture.root],
    { cwd: fixture.root, env: { SAFEWORD_NO_UPDATE_CHECK: '1' } },
  );
  expect(status.exitCode, status.stdout).toBe(expectedExitCode);
  return JSON.parse(status.stdout) as {
    data: Record<string, unknown>;
    findings: { code: string }[];
  };
}

function stampPhase(fixture: ReturnType<typeof projectFixture>, id: string) {
  return spawnSync(
    'bun',
    [
      nodePath.resolve(__dirname, '../../templates/hooks/write-review-stamp.ts'),
      '--ticket',
      'TEST-execution-review',
      '--phase',
      'plan-execution',
      '--independence',
      'cross-agent',
      '--review-id',
      id,
    ],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: fixture.root,
        CLAUDE_SESSION_ID: 'test-execution-review',
        CLAUDE_PLUGIN_ROOT: fixture.pluginRoot,
      },
    },
  );
}

describe('public Execution Plan review', () => {
  it('retains the typed judgment on an admitted approval', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    const prompt = readFileSync(nodePath.join(fixture.root, 'reviewer-prompt.txt'), 'utf8');
    const prefix = `${reviewerPromptInstructions('plan-execution', 'claude')}\n`;
    expect(prompt.startsWith(prefix)).toBe(true);
    const packet = JSON.parse(prompt.slice(prefix.length));
    expect(packet).toMatchObject({
      kind: 'plan-execution',
      logical_files: [{ path: fixture.plan }],
      context_files: fixture.context.map(path => ({ path })),
      execution_plan_delivery_definition: expect.any(Object),
      execution_plan_normalized_digest: expect.any(String),
    });
    expect(output).toMatchObject({
      state: 'healthy',
      data: {
        status: 'approved',
        review_id: expect.any(String),
        review_kind: 'plan-execution',
        review_targets: [fixture.plan],
        reviewer_output: {
          execution_plan_record: { slicing_decision: 'one_pull_request' },
        },
      },
    });
    const stored = await storedReview(fixture, String(output.data.review_id));
    expect(stored.data.reviewer_output).toMatchObject({
      execution_plan_record: { slicing_decision: 'one_pull_request' },
    });
    const stamp = stampPhase(fixture, String(output.data.review_id));
    expect(stamp.error).toBeUndefined();
    expect(stamp.status, stamp.stdout + stamp.stderr).toBe(0);
    expect(
      readFileSync(nodePath.join(fixture.root, '.project', 'skill-invocations.log'), 'utf8'),
    ).toContain(`review-id:${output.data.review_id}`);
  });

  it('keeps a semantic denial final and without an approval record', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'deny');
    expect(result.exitCode, result.stdout).toBe(2);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      state: 'action_required',
      data: { status: 'changes_requested', reviewer_output: { execution_plan_record: JSON_NULL } },
    });
    const stored = await storedReview(fixture, String(output.data.review_id), 2);
    expect(stored.data.status).toBe('changes_requested');
    const stamp = stampPhase(fixture, String(output.data.review_id));
    expect(stamp.error).toBeUndefined();
    expect(stamp.status).not.toBe(0);
    expect(existsSync(nodePath.join(fixture.root, '.project', 'skill-invocations.log'))).toBe(
      false,
    );
  });

  it('cannot approve a plan changed during review', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'source-change');
    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_STALE' }],
      data: { status: 'stale' },
    });
  });

  it('keeps approval current after ordinary checklist progress', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(0);
    const id = String(JSON.parse(result.stdout).data.review_id);
    const path = nodePath.join(fixture.root, fixture.plan);
    const before = readFileSync(path, 'utf8');
    const after = before.replace(
      '| open | missing | | |',
      '| complete | recorded | r1 | verified |',
    );
    expect(after).not.toBe(before);
    writeFileSync(path, after);
    const stored = await storedReview(fixture, id);
    expect(stored.data.status).toBe('approved');
  });

  it('invalidates approval after a definition-bearing checklist change', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(0);
    const id = String(JSON.parse(result.stdout).data.review_id);
    const path = nodePath.join(fixture.root, fixture.plan);
    const before = readFileSync(path, 'utf8');
    const after = before.replace('| behavior-boundary | open |', '| plan-integrity | open |');
    expect(after).not.toBe(before);
    writeFileSync(path, after);
    const stored = await storedReview(fixture, id, 2);
    expect(stored.data.status).toBe('stale');
    expect(stored.findings).toContainEqual(expect.objectContaining({ code: 'REVIEW_STALE' }));
  });

  it('invalidates approval when the design approval gate changes', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(0);
    const id = String(JSON.parse(result.stdout).data.review_id);
    writeFileSync(
      nodePath.join(fixture.root, '.safeword', 'config.json'),
      JSON.stringify({
        designApprovalGate: true,
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'opus' }] },
      }),
    );
    const stored = await storedReview(fixture, id, 2);
    expect(stored.data.status).toBe('stale');
    expect(stored.findings).toContainEqual(expect.objectContaining({ code: 'REVIEW_STALE' }));
  });

  it('preserves proof commands with repeated flags, empty operands, and backslashes', async () => {
    const fixture = projectFixture();
    const path = nodePath.join(fixture.root, fixture.plan);
    const before = readFileSync(path, 'utf8');
    const argv = [
      'bun',
      'run',
      '--filter',
      'a',
      '--filter',
      'b',
      '',
      String.raw`C:\tmp`,
      'test:review-cli',
    ];
    const after = before.replace('["bun","run","test:review-cli"]', () => JSON.stringify(argv));
    expect(after).not.toBe(before);
    writeFileSync(path, after);
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.data.status).toBe('approved');
    const prompt = readFileSync(nodePath.join(fixture.root, 'reviewer-prompt.txt'), 'utf8');
    const packet = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
    expect(
      packet.execution_plan_delivery_definition.proof_specifications[0].invocation.argv,
    ).toEqual(argv);
  });

  it('rejects missing approved context before dispatch', async () => {
    const fixture = projectFixture();
    fixture.context.pop();
    const result = await review(fixture, 'approve');
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'failed',
      errors: [{ code: 'REVIEW_PACKET_INVALID' }],
    });
    expect(existsSync(nodePath.join(fixture.root, 'reviewer-prompt.txt'))).toBe(false);
  });

  it('exhausts the route when a positive judgment lacks a valid typed record', async () => {
    const fixture = projectFixture();
    const result = await review(fixture, 'invalid-record');
    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
    });
  });

  it.each(['echo-digest-mismatch', 'echo-definition-mismatch'] as const)(
    'rejects %s before an approval can be retained',
    async mode => {
      const fixture = projectFixture();
      const result = await review(fixture, mode);
      expect(result.exitCode, result.stdout).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        state: 'action_required',
        findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
        data: { status: 'blocked' },
      });
      expect(existsSync(nodePath.join(fixture.root, '.project', 'skill-invocations.log'))).toBe(
        false,
      );
    },
  );

  it('does not start a review through an unadmitted model', async () => {
    const fixture = projectFixture();
    writeFileSync(
      nodePath.join(fixture.root, '.safeword', 'config.json'),
      JSON.stringify({
        crossAgentReviewRoutes: { codex: [{ reviewer: 'claude', model: 'other' }] },
      }),
    );
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
      data: { status: 'blocked', independence: 'none' },
    });
    expect(existsSync(nodePath.join(fixture.root, 'reviewer-prompt.txt'))).toBe(false);
  });

  it('does not let a runtime-default route inherit a named model admission', async () => {
    const fixture = projectFixture();
    writeFileSync(
      nodePath.join(fixture.root, '.safeword', 'config.json'),
      JSON.stringify({ crossAgentReviewRoutes: { codex: [{ reviewer: 'claude' }] } }),
    );
    const result = await review(fixture, 'approve');
    expect(result.exitCode, result.stdout).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      findings: [{ code: 'REVIEW_ROUTES_EXHAUSTED' }],
      data: { status: 'blocked', independence: 'none' },
    });
    expect(existsSync(nodePath.join(fixture.root, 'reviewer-prompt.txt'))).toBe(false);
  });
});
