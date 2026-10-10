import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  admitThroughInstalledCli,
  featureFixture,
  installedReviewCli,
  installFailingReviewers,
  installReviewer,
} from '../packages/cli/tests/fixtures/execution-review.js';
import { cleanupTrustedReviewerDirectories } from '../packages/cli/tests/review-fixtures.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import { fixtureProject } from './keep-plan-reviews-installed-context.steps.js';
import type { SafewordWorld } from './world.js';

const repository = path.resolve(import.meta.dirname, '..');
const ticketFolder = 'ABC123-feature';
const states = new WeakMap<SafewordWorld, StaleGateState>();

interface StaleGateState {
  root: string;
  host: string;
  output?: string;
  pendingReviewId?: string;
  fallbackReview?: {
    review_id: string;
    actual_reviewer: string;
    independence: string;
    review_routes: { status: string; failure?: string }[];
  };
}

function environment(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    XDG_STATE_HOME: path.join(root, '.review-keys'),
    CLAUDE_PROJECT_DIR: root,
    CLAUDE_PLUGIN_ROOT: path.join(repository, 'plugin'),
    PLUGIN_ROOT: path.join(repository, 'packages/cli/codex-plugin'),
    NODE_ENV: 'test',
  };
}

function dispatch(state: StaleGateState): string {
  const file = path.join(state.root, '.project/tickets', ticketFolder, 'ticket.md');
  const edit = {
    file_path: file,
    old_string: 'phase: plan-implementation',
    new_string: 'phase: plan-execution',
  };
  let command: string;
  let input: Record<string, unknown>;
  if (state.host === 'Cursor') {
    const manifest = JSON.parse(readFileSync(path.join(state.root, '.cursor/hooks.json'), 'utf8'));
    command = manifest.hooks.preToolUse.find(
      (hook: { matcher: string }) => hook.matcher === 'Write',
    ).command;
    input = {
      conversation_id: 'r9-stale',
      workspace_roots: [state.root],
      cwd: state.root,
      tool_name: 'Write',
      tool_input: {
        file_path: file,
        content: readFileSync(file, 'utf8').replace(edit.old_string, edit.new_string),
      },
    };
  } else {
    if (state.host === 'OpenAI Codex') {
      const manifest = JSON.parse(
        readFileSync(path.join(repository, 'packages/cli/codex-plugin/hooks.json'), 'utf8'),
      );
      command = manifest.hooks.PreToolUse[0].hooks[0].command;
    } else {
      assert.equal(
        state.host,
        'Claude Code',
        'cloud and OpenCode need their own actual host evidence',
      );
      const manifest = JSON.parse(
        readFileSync(path.join(state.root, '.claude/settings.json'), 'utf8'),
      );
      command = manifest.hooks.PreToolUse.flatMap(
        (group: { hooks: { command: string }[] }) => group.hooks,
      ).find((hook: { command: string }) => hook.command.includes('pre-tool-quality.ts')).command;
    }
    input = {
      cwd: state.root,
      session_id: 'r9-stale',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: edit,
    };
  }
  const result = spawnSync('/bin/sh', ['-c', command], {
    cwd: state.root,
    env: environment(state.root),
    encoding: 'utf8',
    timeout: 60_000,
    input: JSON.stringify(input),
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function prepareApprovedGate(this: SafewordWorld, host: string, invalidate: boolean) {
  const root = featureFixture();
  const state = { root, host };
  states.set(this, state);
  const owned = fixtureProject();
  try {
    for (const file of ['ticket.md', 'spec.md', 'impl-plan.md']) {
      writeFileSync(
        path.join(root, '.project/tickets', ticketFolder, file),
        readFileSync(path.join(owned, '.project/tickets/CTX123-current-context', file), 'utf8')
          .replaceAll('CTX123', 'ABC123')
          .replaceAll('features/current-context.feature', 'features/feature.feature'),
      );
    }
    writeFileSync(
      path.join(root, 'features/feature.feature'),
      readFileSync(path.join(owned, 'features/current-context.feature'), 'utf8'),
    );
  } finally {
    rmSync(owned, { recursive: true, force: true });
  }
  const cli = installedReviewCli(root);
  const installed = await cli(
    ['install', '--agents', 'cursor', '--no-input', '--offline', '--json', '--cwd', root],
    { cwd: root, env: { NODE_ENV: 'test' } },
  );
  assert.equal(installed.exitCode, 0, installed.stdout);
  if (host === 'Claude Code') {
    // Exercise the supported local-project delivery contract, without enrolling a user profile.
    mkdirSync(path.join(root, '.claude'), { recursive: true });
    const settings = SAFEWORD_SCHEMA.jsonMerges['.claude/settings.json'].merge({});
    writeFileSync(path.join(root, '.claude/settings.json'), JSON.stringify(settings));
  }
  await admitThroughInstalledCli(cli, root, ['plan-implementation']);
  const ledger = path.join(root, '.project/skill-invocations.log');
  const rows = readFileSync(ledger, 'utf8').trim().split('\n');
  writeFileSync(ledger, '');
  // Earn the native ledger stamps through the real receipt-verifying writer.
  for (const row of rows) {
    const phase = /:phase@(\S+)/u.exec(row)?.[1];
    const id = /review-id:(\S+)/u.exec(row)?.[1];
    assert.ok(phase && id);
    const stamped = spawnSync(
      'bun',
      [
        path.join(root, '.safeword/hooks/write-review-stamp.ts'),
        '--ticket',
        ticketFolder,
        '--phase',
        phase,
        '--review-id',
        id,
        '--author-agent',
        'codex',
        '--reviewer-agent',
        'claude',
        '--independence',
        'reduced',
      ],
      {
        cwd: root,
        env: environment(root),
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    assert.equal(stamped.status, 0, stamped.stdout + stamped.stderr);
  }
  const allowed = dispatch(state);
  if (host === 'Cursor') assert.equal(JSON.parse(allowed).permission, 'allow', allowed);
  else assert.equal(allowed, '', allowed);
  if (!invalidate) return;
  const scenarios = path.join(root, 'features/feature.feature');
  const before = readFileSync(scenarios, 'utf8');
  const changed = before.replace(
    'Then the current context reaches review',
    'Then changed acceptance reaches review',
  );
  assert.notEqual(changed, before);
  writeFileSync(scenarios, changed);
  const id = /review-id:(\S+)/u.exec(rows[0])?.[1];
  assert.ok(id);
  const status = await cli(['review', 'status', id, '--json'], {
    cwd: root,
    env: { NODE_ENV: 'test' },
  });
  assert.equal(status.exitCode, 2, status.stdout);
  const stale = JSON.parse(status.stdout);
  assert.deepEqual(stale.errors, []);
  assert.equal(stale.data.status, 'stale', status.stdout);
  assert.ok(stale.findings.some((finding: { code: string }) => finding.code === 'REVIEW_STALE'));
}

Given(
  /^a planning phase on (Claude Code|OpenAI Codex|Cursor) has an approving receipt invalidated by a changed accepted scenario$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, host: string) {
    await prepareApprovedGate.call(this, host, true);
  },
);

Given(
  /^a planning phase on (Claude Code|OpenAI Codex|Cursor) through (installed local project hooks|installed Codex hooks|installed Cursor hooks) has a current approving receipt$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, host: string, boundary: string) {
    assert.equal(
      boundary,
      {
        'Claude Code': 'installed local project hooks',
        'OpenAI Codex': 'installed Codex hooks',
        Cursor: 'installed Cursor hooks',
      }[host],
    );
    await prepareApprovedGate.call(this, host, false);
  },
);

Given(
  /^a planning phase on (Claude Code|OpenAI Codex|Cursor) through (installed local project hooks|installed Codex hooks|installed Cursor hooks) has a pending review$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, host: string, boundary: string) {
    assert.equal(
      boundary,
      {
        'Claude Code': 'installed local project hooks',
        'OpenAI Codex': 'installed Codex hooks',
        Cursor: 'installed Cursor hooks',
      }[host],
    );
    await prepareApprovedGate.call(this, host, false);
    const state = states.get(this);
    assert.ok(state);
    const bin = installReviewer(path.join(state.root, 'reviewer-hold'));
    const reviewed = await installedReviewCli(state.root)(
      [
        'review',
        'run',
        'plan-implementation',
        `.project/tickets/${ticketFolder}/impl-plan.md`,
        '--context',
        'features/feature.feature',
        '--context',
        `.project/tickets/${ticketFolder}/spec.md`,
        '--json',
        '--no-input',
        '--cwd',
        state.root,
      ],
      {
        cwd: state.root,
        env: {
          NODE_ENV: 'test',
          PATH: `${bin}:/usr/bin:/bin`,
          SAFEWORD_AGENT_RUNTIME: 'codex',
          SAFEWORD_REVIEW_KEY_ROOT: path.join(state.root, '.review-keys'),
          SAFEWORD_NO_UPDATE_CHECK: '1',
          SAFEWORD_REVIEW_FOREGROUND_MS: '0',
          SAFEWORD_REVIEW_TIMEOUT_MS: '30000',
          SAFEWORD_REVIEW_RUN_BOUND_MS: '60000',
        },
      },
    );
    const result = JSON.parse(reviewed.stdout);
    state.pendingReviewId = result.data.review_id;
    assert.ok(state.pendingReviewId, reviewed.stdout);
    assert.equal(result.data.status, 'pending', reviewed.stdout);
    const deadline = Date.now() + 10_000;
    while (!existsSync(path.join(state.root, 'reviewer-hold')) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(
      existsSync(path.join(state.root, 'reviewer-hold')),
      'The reviewer must actually start and remain pending',
    );
    // The ledger only locates a job. Its pending authenticated result must never authorize a gate.
    const ledger = path.join(state.root, '.project/skill-invocations.log');
    const approved = readFileSync(ledger, 'utf8');
    assert.match(approved, /review-id:\S+/u);
    writeFileSync(
      ledger,
      approved.replace(/review-id:\S+/gu, `review-id:${state.pendingReviewId}`),
    );
  },
);

Given(
  /^a planning phase on (Claude Code|OpenAI Codex|Cursor) through (installed local project hooks|installed Codex hooks|installed Cursor hooks) has a permitted fallback approval after every configured independent route was attempted and returned a typed failure$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, host: string, boundary: string) {
    assert.equal(
      boundary,
      {
        'Claude Code': 'installed local project hooks',
        'OpenAI Codex': 'installed Codex hooks',
        Cursor: 'installed Cursor hooks',
      }[host],
    );
    await prepareApprovedGate.call(this, host, false);
    const state = states.get(this);
    assert.ok(state);
    const author = host === 'Claude Code' ? 'claude' : host === 'Cursor' ? 'cursor' : 'codex';
    const configPath = path.join(state.root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    writeFileSync(
      configPath,
      JSON.stringify({
        ...config,
        crossAgentReviewRoutes: {
          [author]: [{ reviewer: author === 'codex' ? 'claude' : 'codex' }],
        },
      }),
    );
    const target = `.project/tickets/${ticketFolder}/impl-plan.md`;
    const planPath = path.join(state.root, target);
    const before = readFileSync(planPath, 'utf8');
    const changed = before.replace(
      '## Approach\n',
      '## Approach\n\nPreserve authenticated review when independent routes fail.\n',
    );
    assert.notEqual(changed, before);
    writeFileSync(planPath, changed);
    const cli = installedReviewCli(state.root);
    const env = {
      NODE_ENV: 'test',
      PATH: `${installFailingReviewers()}:/usr/bin:/bin`,
      SAFEWORD_AGENT_RUNTIME: author,
      SAFEWORD_NO_UPDATE_CHECK: '1',
      SAFEWORD_REVIEW_KEY_ROOT: path.join(state.root, '.review-keys'),
      SAFEWORD_REVIEW_TIMEOUT_MS: '3000',
      SAFEWORD_REVIEW_RUN_BOUND_MS: '10000',
    };
    const exhausted = await cli(
      [
        'review',
        'run',
        'plan-implementation',
        target,
        '--context',
        'features/feature.feature',
        '--context',
        `.project/tickets/${ticketFolder}/spec.md`,
        '--json',
        '--no-input',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env },
    );
    const pending = JSON.parse(exhausted.stdout);
    assert.equal(pending.data.status, 'continuation_required', exhausted.stdout);
    assert.equal(pending.data.continuation.tier, 'fresh-context');
    assert.ok(pending.data.review_routes.length > 0);
    for (const route of pending.data.review_routes) {
      assert.equal(route.status, 'attempted', exhausted.stdout);
      assert.equal(typeof route.failure, 'string', exhausted.stdout);
    }
    writeFileSync(
      path.join(state.root, 'fallback-review.json'),
      JSON.stringify({
        schema_version: 1,
        dispatch_id: pending.data.continuation.packet.dispatch_id,
        reviewer_agent: author,
        verdict: 'approve',
        summary: 'Current plan approved in a fresh host context.',
        findings: [],
        evidence_records: { schema_version: 1, records: [] },
      }),
    );
    const continued = await cli(
      [
        'review',
        'continue',
        pending.data.review_id,
        '--tier',
        'fresh-context',
        '--output',
        'fallback-review.json',
        '--offline',
        '--json',
        '--no-input',
        '--cwd',
        state.root,
      ],
      { cwd: state.root, env },
    );
    assert.equal(continued.exitCode, 0, continued.stdout);
    const result = JSON.parse(continued.stdout);
    assert.equal(result.data.status, 'approved', continued.stdout);
    assert.equal(result.data.actual_reviewer, author);
    assert.equal(result.data.independence, 'reduced');
    assert.ok(
      !result.findings.some(
        (finding: { code: string }) => finding.code === 'REVIEW_INDEPENDENCE_DEGRADED',
      ),
    );
    state.fallbackReview = result.data;
    const denied = JSON.parse(dispatch(state));
    if (host === 'Cursor') assert.equal(denied.permission, 'deny');
    else assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
    const stampEnv = {
      ...environment(state.root),
      ...env,
      PATH: process.env.PATH,
      CLAUDE_SESSION_ID: author === 'claude' ? `r6-${path.basename(state.root)}` : undefined,
      CLAUDE_CODE_SESSION_ID: undefined,
      CODEX_THREAD_ID: author === 'codex' ? `r6-${path.basename(state.root)}` : undefined,
    };
    if (host === 'Cursor') {
      const bridge = spawnSync('bun', ['.safeword/hooks/cursor/before-shell-execution.ts'], {
        cwd: state.root,
        env: stampEnv,
        encoding: 'utf8',
        timeout: 60_000,
        input: JSON.stringify({
          workspace_roots: [state.root],
          conversation_id: `r6-${path.basename(state.root)}`,
          command: `bun "${state.root}/.safeword/hooks/write-review-stamp.ts" --phase plan-implementation`,
        }),
      });
      assert.equal(bridge.error, undefined, bridge.error?.message);
      assert.equal(bridge.status, 0, bridge.stderr);
      assert.equal(JSON.parse(bridge.stdout).permission, 'allow', bridge.stdout);
    }
    const stamped = spawnSync(
      'bun',
      [
        path.join(state.root, '.safeword/hooks/write-review-stamp.ts'),
        '--ticket',
        ticketFolder,
        '--phase',
        'plan-implementation',
        '--review-id',
        pending.data.review_id,
        '--author-agent',
        author,
        '--reviewer-agent',
        author,
        '--independence',
        'reduced',
      ],
      {
        cwd: state.root,
        env: stampEnv,
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    assert.equal(stamped.error, undefined, stamped.error?.message);
    assert.equal(stamped.status, 0, stamped.stdout + stamped.stderr);
  },
);

When(
  /^actual lifecycle dispatch through (installed local project hooks|installed Codex hooks|installed Cursor hooks) evaluates the phase transition with real configuration and collaborators, mocking only the reviewer process boundary$/,
  function (this: SafewordWorld, boundary: string) {
    const state = states.get(this);
    assert.ok(state);
    assert.equal(
      boundary,
      {
        'Claude Code': 'installed local project hooks',
        'OpenAI Codex': 'installed Codex hooks',
        Cursor: 'installed Cursor hooks',
      }[state.host],
    );
    state.output = dispatch(state);
    this.nativePlanningGate = { host: state.host, output: state.output };
  },
);

Then('the phase remains blocked with re-review named', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.output);
  const result = JSON.parse(state.output);
  if (state.host === 'Cursor') assert.equal(result.permission, 'deny');
  else assert.equal(result.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(state.output, /plan-implementation/u);
  assert.match(state.output, /review run plan-implementation|fork review of the phase is logged/u);
});

Then('the phase remains blocked', { timeout: 60_000 }, async function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state?.pendingReviewId && state.output);
  const result = JSON.parse(state.output);
  if (state.host === 'Cursor') assert.equal(result.permission, 'deny');
  else assert.equal(result.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(state.output, /plan-implementation/u);
  const cli = installedReviewCli(state.root);
  const status = await cli(['review', 'status', state.pendingReviewId, '--json'], {
    cwd: state.root,
    env: { NODE_ENV: 'test' },
  });
  assert.equal(JSON.parse(status.stdout).data.status, 'pending', status.stdout);
  const ledger = path.join(state.root, '.project/skill-invocations.log');
  const pendingLedger = readFileSync(ledger, 'utf8');
  const stampArguments = [
    path.join(state.root, '.safeword/hooks/write-review-stamp.ts'),
    '--ticket',
    ticketFolder,
    '--phase',
    'plan-implementation',
    '--review-id',
    state.pendingReviewId,
    '--author-agent',
    'codex',
    '--reviewer-agent',
    'claude',
    '--independence',
    'reduced',
  ];
  const stampOptions = {
    cwd: state.root,
    env: environment(state.root),
    encoding: 'utf8' as const,
    timeout: 60_000,
  };
  const refused = spawnSync('bun', stampArguments, stampOptions);
  assert.equal(refused.error, undefined, refused.error?.message);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stdout + refused.stderr, /did not approve \(status: pending\)/u);
  assert.equal(readFileSync(ledger, 'utf8'), pendingLedger);
  // Complete this exact job, changing no stamp or reviewed source. The same
  // native gate must now allow, distinguishing pending denial from a bad stamp.
  const hold = openSync(
    path.join(state.root, 'reviewer-hold'),
    constants.O_WRONLY | constants.O_NONBLOCK,
  );
  try {
    writeSync(hold, 'complete\n');
  } finally {
    closeSync(hold);
  }
  const deadline = Date.now() + 15_000;
  let completed;
  do {
    completed = await cli(['review', 'status', state.pendingReviewId, '--json'], {
      cwd: state.root,
      env: { NODE_ENV: 'test' },
    });
    if (JSON.parse(completed.stdout).data.status !== 'pending') break;
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.equal(JSON.parse(completed.stdout).data.status, 'approved', completed.stdout);
  assert.equal(readFileSync(ledger, 'utf8'), pendingLedger);
  const allowed = dispatch(state);
  if (state.host === 'Cursor') assert.equal(JSON.parse(allowed).permission, 'allow', allowed);
  else assert.equal(allowed, '', allowed);
  const stamped = spawnSync('bun', stampArguments, stampOptions);
  assert.equal(stamped.error, undefined, stamped.error?.message);
  assert.equal(stamped.status, 0, stamped.stdout + stamped.stderr);
  state.pendingReviewId = undefined;
});

Then(
  'the phase transition proceeds with reduced independence and the actual reviewer recorded without calling the capability degraded',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state?.fallbackReview && state.output !== undefined);
    assert.equal(state.fallbackReview.independence, 'reduced');
    assert.equal(
      state.fallbackReview.actual_reviewer,
      state.host === 'Claude Code' ? 'claude' : state.host === 'Cursor' ? 'cursor' : 'codex',
    );
    const stamp = readFileSync(path.join(state.root, '.project/skill-invocations.log'), 'utf8')
      .split('\n')
      .find(row => row.includes(`review-id:${state.fallbackReview?.review_id}`));
    assert.ok(stamp);
    assert.ok(stamp.includes(`reviewer:${state.fallbackReview.actual_reviewer}`));
    assert.match(stamp, /independence:reduced/u);
    assert.doesNotMatch(state.output, /degrad/iu);
    if (state.host === 'Cursor')
      assert.equal(JSON.parse(state.output).permission, 'allow', state.output);
    else assert.equal(state.output, '', state.output);
  },
);

After(async function (this: SafewordWorld) {
  const state = states.get(this);
  try {
    if (!state) return;
    if (state.pendingReviewId) {
      const cancelled = await installedReviewCli(state.root)(
        ['review', 'cancel', state.pendingReviewId, '--json'],
        { cwd: state.root, env: { NODE_ENV: 'test' } },
      );
      assert.equal(JSON.parse(cancelled.stdout).data.status, 'canceled', cancelled.stdout);
    }
  } finally {
    if (state) rmSync(state.root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
    states.delete(this);
  }
});
