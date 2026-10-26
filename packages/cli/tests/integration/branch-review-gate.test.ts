import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { branchReviewCompletionProblem } from '../../templates/hooks/lib/safeword-cli.js';
import { expectHookAllow, expectHookDeny, runCli, testCliPath, TIMEOUT_QUICK } from '../helpers.js';
import { claudeReviewerShellPrelude, createTrustedReviewerDirectory } from '../review-fixtures.js';

const roots: string[] = [];
const hookPath = nodePath.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts');
const codexHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/codex/pre-tool-quality.ts',
);
const claudeStopHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/stop-quality.ts',
);
const codexStopHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/codex/stop.ts',
);
const cursorHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/cursor/pre-tool-quality.ts',
);
const openCodeDispatcherPath = nodePath.resolve(
  import.meta.dirname,
  '../../dist/opencode/dispatcher.js',
);
const writeReviewStampPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/write-review-stamp.ts',
);
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function expectCurrentBranchCheck(stdout: string): void {
  const decision = JSON.parse(stdout) as {
    data?: { may_advance?: boolean; freshness?: string };
    findings?: { message: string }[];
  };
  expect(decision.data?.may_advance, decision.findings?.[0]?.message).toBe(true);
  expect(decision.data?.freshness).toBe('current');
}

function expectMarkerRemovalBlocked(
  host: string,
  project: string,
  ticketPath: string,
  reviewId: string,
): void {
  const markerText = `branch_review_exit_id: ${reviewId}\n`;
  let selectedHook: string;
  switch (host) {
    case 'OpenAI Codex': {
      selectedHook = codexHookPath;
      break;
    }
    case 'Cursor': {
      selectedHook = cursorHookPath;
      break;
    }
    case 'OpenCode CLI': {
      selectedHook = openCodeDispatcherPath;
      break;
    }
    default: {
      selectedHook = hookPath;
    }
  }
  const toolInput =
    host === 'Cursor'
      ? {
          conversation_id: 'branch-marker',
          workspace_roots: [project],
          tool_name: 'Write',
          tool_input: {
            file_path: ticketPath,
            content: readFileSync(ticketPath, 'utf8').replace(markerText, ''),
          },
        }
      : {
          session_id: 'branch-marker',
          hook_event_name: 'PreToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: ticketPath, old_string: markerText, new_string: '' },
        };
  const result = spawnSync('bun', [selectedHook], {
    cwd: project,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
    input: JSON.stringify(toolInput),
  });
  if (host === 'OpenCode CLI') {
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('review marker');
  } else if (host === 'Cursor') {
    expect(result.stdout).toContain('review marker');
    expect(JSON.parse(result.stdout).permission).toBe('deny');
  } else {
    expectHookDeny(result, 'review marker');
  }
}

async function expectMissingRecordRecovery(
  project: string,
  ticketPath: string,
  reviewId: string,
  env: NodeJS.ProcessEnv,
  attemptExit: () => Parameters<typeof expectHookDeny>[0],
): Promise<void> {
  const directory = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
  const savedRecord = readdirSync(directory).find(name => name.endsWith(`${reviewId}.json`));
  if (savedRecord === undefined) throw new Error('sealed branch review record was not saved');
  rmSync(nodePath.join(directory, savedRecord));
  expectHookDeny(attemptExit(), 'No current branch review');
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('- allow bypass', '- preserve access rule'),
  );
  const replacement = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env,
  });
  expect(JSON.parse(replacement.stdout).data?.coverage).toBe('complete');
  expectHookAllow(attemptExit());
}

async function expectLegacyVerificationUncovered(
  project: string,
  ticketPath: string,
): Promise<void> {
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: implement', 'phase: verify'),
  );
  const result = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  const report = JSON.parse(result.stdout) as {
    data?: { legacy_uncovered?: boolean; may_advance?: boolean };
  };
  expect(report.data?.legacy_uncovered).toBe(true);
  expect(report.data?.may_advance).toBe(true);
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: verify', 'phase: implement'),
  );
}

it('keeps a saved review current after verification checklist progress', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-bookkeeping-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: ABC123\ntype: feature\nphase: verify\n---\n# Review branch\n\n## Work Log\n',
  );
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  writeFileSync(nodePath.join(project, '.safeword', 'config.json'), '{"reviewGate":false}\n');
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\n');
  const planPath = nodePath.join(ticket, 'execution-plan.md');
  const plan =
    '# Delivery work\n\n## Delivery checklist\n\n| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| branch | scope | Review all authored paths | builder | branch-gate | open | missing | | |\n';
  writeFileSync(planPath, plan);
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-bookkeeping-'), 'bin');
  mkdirSync(reviewerBin);
  writeFileSync(
    nodePath.join(reviewerBin, 'claude'),
    `${claudeReviewerShellPrelude()}\nprintf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed source","findings":[]}\\n' "$dispatch_id"\n`,
    { mode: 0o755 },
  );
  const review = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  });
  expect(JSON.parse(review.stdout).data?.coverage).toBe('complete');
  const checkReview = async () =>
    runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], { cwd: project });
  const baseline = await checkReview();
  expectCurrentBranchCheck(baseline.stdout);
  const laterTest = nodePath.join(project, 'packages', 'app', 'tests', 'access.test.ts');
  mkdirSync(nodePath.dirname(laterTest), { recursive: true });
  writeFileSync(laterTest, 'test access after review\n');
  const afterTest = await checkReview();
  expect(JSON.parse(afterTest.stdout).data?.freshness).toBe('stale');
  rmSync(laterTest);
  const afterTestRemoval = await checkReview();
  expectCurrentBranchCheck(afterTestRemoval.stdout);
  const laterScenario = nodePath.join(project, 'features', 'access.feature');
  mkdirSync(nodePath.dirname(laterScenario), { recursive: true });
  writeFileSync(laterScenario, 'Feature: access after review\n');
  const afterScenario = await checkReview();
  expect(JSON.parse(afterScenario.stdout).data?.freshness).toBe('stale');
  rmSync(laterScenario);
  const afterScenarioRemoval = await checkReview();
  expectCurrentBranchCheck(afterScenarioRemoval.stdout);
  const ticketPath = nodePath.join(ticket, 'ticket.md');
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace(
      'phase: verify\n',
      'phase: verify\nphase_anchors:\n  - verify: .project/tickets/ABC123-review-branch/verify.md\n',
    ),
  );
  const afterAnchor = await checkReview();
  expectCurrentBranchCheck(afterAnchor.stdout);
  const anchorExit = spawnSync('bun', [hookPath], {
    cwd: project,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
    input: JSON.stringify({
      session_id: 'branch-bookkeeping',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: ticketPath,
        content: readFileSync(ticketPath, 'utf8')
          .replace('phase: verify', 'phase: done')
          .replace(
            '  - verify: .project/tickets/ABC123-review-branch/verify.md',
            '  - verify: .project/tickets/ABC123-review-branch/verify.md\n  - done: .project/tickets/ABC123-review-branch/verify.md',
          ),
      },
    }),
  });
  expectHookAllow(anchorExit);
  const records = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
  const saved = readdirSync(records).find(name => /^\d+-[a-f\d-]+\.json$/u.test(name));
  if (saved === undefined) throw new Error('branch review record is missing');
  const otherTicket = JSON.parse(readFileSync(nodePath.join(records, saved), 'utf8'));
  otherTicket.ticket_id = 'OTHER';
  const damagedOther = nodePath.join(records, '999999999999-deadbeef.json');
  writeFileSync(damagedOther, JSON.stringify(otherTicket));
  const afterDamagedOther = await checkReview();
  expectCurrentBranchCheck(afterDamagedOther.stdout);
  rmSync(damagedOther);
  const damagedSame = nodePath.join(records, '999999999999-deadbeef.json');
  otherTicket.ticket_id = 'ABC123';
  otherTicket.coverage = 'none';
  writeFileSync(damagedSame, JSON.stringify(otherTicket));
  const afterDamagedSame = await checkReview();
  expect(JSON.parse(afterDamagedSame.stdout).data?.may_advance).toBe(false);
  rmSync(damagedSame);
  writeFileSync(
    planPath,
    plan.replace('| open | missing | | |', '| done | real_boundary | | passed |'),
  );
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'record verification progress');
  const check = await checkReview();
  expectCurrentBranchCheck(check.stdout);
  const exit = spawnSync('bun', [hookPath], {
    cwd: project,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
    input: JSON.stringify({
      session_id: 'branch-bookkeeping',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: ticketPath, old_string: 'phase: verify', new_string: 'phase: done' },
    }),
  });
  expectHookAllow(exit);
  writeFileSync(planPath, plan.replace('Review all authored paths', 'Review only source.ts'));
  const changedGoal = await checkReview();
  expect(JSON.parse(changedGoal.stdout).data?.freshness).toBe('stale');
  writeFileSync(
    planPath,
    plan.replace('| open | missing | | |', '| done | real_boundary | | passed |'),
  );
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('## Work Log', 'status: allow bypass\n\n## Work Log'),
  );
  const bodyGoal = await checkReview();
  expect(JSON.parse(bodyGoal.stdout).data?.freshness).toBe('stale');
});

// eslint-disable-next-line complexity -- One fixture follows the same ticket through review, edits, verification, and recovery.
async function gatherGateProof(hostCase: string) {
  const host = hostCase.split(' / ', 2)[0] ?? '';
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-gate-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticket = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticket, { recursive: true });
  writeFileSync(
    nodePath.join(ticket, 'ticket.md'),
    '---\nid: ABC123\ntype: feature\nphase: implement\nscope:\n  - preserve access rule\n---\n# Review branch\n',
  );
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  writeFileSync(nodePath.join(project, '.safeword', 'config.json'), '{"reviewGate":false}\n');
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\n');
  writeFileSync(nodePath.join(project, 'seed.txt'), 'seed\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'change.txt'), 'reviewed content\n');
  const ledgerPath = nodePath.join(ticket, 'test-definitions.md');
  const ledger =
    '# Scenario proof\n- [ ] RED\n- [ ] GREEN\n- [ ] REFACTOR\n- [ ] cross-scenario\n- [ ] VERIFIED\n';
  writeFileSync(ledgerPath, ledger);
  const auditSource = nodePath.join(project, 'packages', 'app', 'src', 'audit', 'logger.ts');
  mkdirSync(nodePath.dirname(auditSource), { recursive: true });
  writeFileSync(auditSource, 'export const audit = 1;\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-gate-'), 'bin');
  mkdirSync(reviewerBin);
  const reviewer = nodePath.join(reviewerBin, 'claude');
  writeFileSync(
    reviewer,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = '--version' ]; then printf 'claude 1.0.0\\n'; exit 0; fi
if printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then
  printf '%s\\n' '--output-format --json-schema --no-session-persistence --disable-slash-commands --setting-sources --strict-mcp-config --tools --model'
  exit 0
fi
payload=$(cat)
dispatch_id=$(printf '%s' "$payload" | sed -n 's/.*"dispatch_id":"\\([^"]*\\)".*/\\1/p')
if [ "\${SAFEWORD_REVIEW_FAKE_FINDING:-}" = '1' ]; then
  printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"request_changes","summary":"Access rule needs repair","findings":[{"severity":"error","message":"The access rule still permits bypass."}]}\\n' "$dispatch_id"
  exit 0
fi
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed branch change","findings":[]}\\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(reviewer, 0o755);
  const env = {
    PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
    SAFEWORD_AGENT_RUNTIME: 'codex',
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
  const completionProblem = () => {
    const previous = process.env.SAFEWORD_PLUGIN_CLI;
    process.env.SAFEWORD_PLUGIN_CLI = testCliPath;
    try {
      return branchReviewCompletionProblem(
        project,
        'ABC123-review-branch',
        nodePath.join(ticket, 'ticket.md'),
      );
    } finally {
      if (previous === undefined) delete process.env.SAFEWORD_PLUGIN_CLI;
      else process.env.SAFEWORD_PLUGIN_CLI = previous;
    }
  };
  const ticketPath = nodePath.join(ticket, 'ticket.md');
  const attemptEdit = (oldString: string, newString: string) => {
    const hookEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    };
    delete hookEnvironment.CODEX_HOME;
    delete hookEnvironment.CLAUDE_PLUGIN_ROOT;
    return spawnSync('bun', [hookPath], {
      cwd: project,
      encoding: 'utf8',
      env: hookEnvironment,
      timeout: 20_000,
      input: JSON.stringify({
        session_id: 'branch-review-gate',
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketPath,
          old_string: oldString,
          new_string: newString,
        },
      }),
    });
  };
  const attemptExit = (from = 'implement', to = 'verify') =>
    attemptEdit(`phase: ${from}`, `phase: ${to}`);
  expectHookDeny(attemptEdit('type: feature', 'type: task'), 'bypass');
  const beforeStatus = readFileSync(ticketPath, 'utf8');
  writeFileSync(
    ticketPath,
    beforeStatus.replace('type: feature', 'type: feature\nstatus: in_progress'),
  );
  expectHookDeny(attemptEdit('status: in_progress', 'status: done'), 'No current branch review');
  writeFileSync(ticketPath, beforeStatus);
  const beforeSkip = readFileSync(ticketPath, 'utf8');
  writeFileSync(
    ticketPath,
    beforeSkip.replace(
      'phase: implement',
      'phase: implement\nphase_skips:\n  - verify: Review at implementation exit before closing.',
    ),
  );
  expectHookDeny(attemptExit('implement', 'done'), 'No current branch review');
  writeFileSync(ticketPath, beforeSkip);
  writeFileSync(
    nodePath.join(project, '.project', 'skill-invocations.log'),
    'review:ABC123-review-branch:phase@implement skip:No reviewable changes.\n',
  );
  expectHookDeny(attemptExit(), 'No current branch review');
  rmSync(nodePath.join(project, '.project', 'skill-invocations.log'));
  const review = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project, env });
  const firstReview = JSON.parse(review.stdout) as {
    data?: { coverage?: string; review_id?: string };
  };
  expect(firstReview.data?.coverage).toBe('complete');
  const missingTicketCheck = await runCli(
    ['review', 'branch-check', 'ABC123X', 'verify', '--json'],
    {
      cwd: project,
    },
  );
  expect(JSON.parse(missingTicketCheck.stdout).data?.may_advance).toBe(false);
  expect(readFileSync(ticketPath, 'utf8')).toContain(
    `branch_review_exit_id: ${firstReview.data?.review_id}`,
  );
  expectMarkerRemovalBlocked(host, project, ticketPath, String(firstReview.data?.review_id));
  const markedTicket = readFileSync(ticketPath, 'utf8');
  writeFileSync(
    ticketPath,
    markedTicket
      .replace(/^branch_review_exit_id:[^\n]*\n/mu, '')
      .replace('phase: implement', 'phase: verify'),
  );
  const droppedMarker = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(droppedMarker.stdout).data?.may_advance).toBe(false);
  writeFileSync(ticketPath, markedTicket);

  /* eslint-disable complexity -- One adapter fixture checks current, stale, and bypass edits across four hosts. */
  const assertLocalHostsEdit = (
    oldString: string,
    newString: string,
    allowed = false,
    denial = 'stale',
  ) => {
    const edit = {
      file_path: ticketPath,
      old_string: oldString,
      new_string: newString,
    };
    const hookEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
    };
    delete hookEnvironment.CODEX_HOME;
    delete hookEnvironment.CLAUDE_PLUGIN_ROOT;
    if (host === 'Claude Code') {
      const result = attemptEdit(oldString, newString);
      if (allowed) expectHookAllow(result);
      else expectHookDeny(result, denial);
      return;
    }
    if (host === 'OpenAI Codex') {
      const codex = spawnSync('bun', [codexHookPath], {
        cwd: project,
        encoding: 'utf8',
        env: hookEnvironment,
        timeout: 20_000,
        input: JSON.stringify({
          session_id: 'branch-codex',
          tool_name: 'Edit',
          tool_input: edit,
        }),
      });
      if (allowed) expectHookAllow(codex);
      else expectHookDeny(codex, denial);
      return;
    }
    if (host === 'Cursor') {
      const cursor = spawnSync('bun', [cursorHookPath], {
        cwd: project,
        encoding: 'utf8',
        env: hookEnvironment,
        timeout: 20_000,
        input: JSON.stringify({
          conversation_id: 'branch-cursor',
          workspace_roots: [project],
          tool_name: 'Write',
          tool_input: {
            file_path: ticketPath,
            content: readFileSync(ticketPath, 'utf8').split(oldString).join(newString),
          },
        }),
      });
      if (!allowed) expect(cursor.stdout).toContain(denial);
      expect(JSON.parse(cursor.stdout).permission).toBe(allowed ? 'allow' : 'deny');
      return;
    }
    const openCode = spawnSync('bun', [openCodeDispatcherPath], {
      cwd: project,
      encoding: 'utf8',
      env: hookEnvironment,
      timeout: 20_000,
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'branch-opencode',
        tool_name: 'Edit',
        tool_input: edit,
      }),
    });
    expect(openCode.status).toBe(allowed ? 0 : 2);
    if (!allowed) expect(openCode.stderr).toContain(denial);
  };
  /* eslint-enable complexity */
  const assertLocalHostsBlockEdit = (oldString: string, newString: string, denial = 'stale') => {
    assertLocalHostsEdit(oldString, newString, false, denial);
  };
  const assertLocalHostsBlock = (from: 'implement' | 'verify', to: 'verify' | 'done') => {
    assertLocalHostsBlockEdit(`phase: ${from}`, `phase: ${to}`);
  };
  const current = attemptExit();
  expectHookAllow(current);
  const changePath = nodePath.join(project, 'change.txt');
  writeFileSync(changePath, 'staged correction\n');
  git(project, 'add', 'change.txt');
  assertLocalHostsBlock('implement', 'verify');
  git(project, 'reset', 'HEAD', '--', 'change.txt');
  writeFileSync(changePath, 'reviewed content\n');
  expectHookAllow(attemptExit());
  const untrackedPath = nodePath.join(project, 'new-work.ts');
  writeFileSync(untrackedPath, 'export const newWork = true;\n');
  assertLocalHostsBlock('implement', 'verify');
  rmSync(untrackedPath);
  expectHookAllow(attemptExit());
  const committedFix = hostCase.endsWith('/ committed');
  writeFileSync(changePath, committedFix ? 'committed correction\n' : 'uncommitted correction\n');
  if (committedFix) {
    git(project, 'add', 'change.txt');
    git(project, 'commit', '-m', 'authored correction after review');
  }
  assertLocalHostsBlock('implement', 'verify');
  if (committedFix) {
    git(project, 'reset', '--hard', 'HEAD~1');
    writeFileSync(ticketPath, markedTicket);
  } else {
    writeFileSync(changePath, 'reviewed content\n');
  }
  writeFileSync(
    ledgerPath,
    ledger
      .replace('- [ ] RED', '- [x] RED abc1234')
      .replace('- [ ] GREEN', '- [x] GREEN def5678')
      .replace('- [ ] REFACTOR', '- [x] REFACTOR skip: no change needed')
      .replace('- [ ] cross-scenario', '- [x] cross-scenario fed1234')
      .replace(
        '- [ ] VERIFIED',
        '- [x] VERIFIED eligibility=11111111-1111-4111-8111-111111111111 proof=22222222-2222-4222-8222-222222222222',
      ),
  );
  expectHookAllow(attemptExit());
  git(project, 'commit', '--allow-empty', '-m', 'same content, new head');
  expectHookDeny(attemptExit(), 'stale');
  assertLocalHostsBlock('implement', 'verify');
  const afterCommitReview = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env,
  });
  expect(JSON.parse(afterCommitReview.stdout).data?.coverage).toBe('complete');
  expectHookAllow(attemptExit());
  const combinedWrite = spawnSync('bun', [hookPath], {
    cwd: project,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
      SAFEWORD_AGENT_RUNTIME: 'claude',
    },
    input: JSON.stringify({
      session_id: 'branch-review-gate',
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: ticketPath,
        content: readFileSync(ticketPath, 'utf8')
          .replace('phase: implement', 'phase: verify')
          .replace('- preserve access rule', '- allow bypass'),
      },
    }),
  });
  expectHookDeny(combinedWrite, 'ticket goals');
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: implement', 'phase: verify'),
  );
  expect(readFileSync(ticketPath, 'utf8')).toContain('phase: verify');
  writeFileSync(nodePath.join(ticket, 'verify.md'), '# Verification result\n');
  writeFileSync(
    ticketPath,
    `${readFileSync(ticketPath, 'utf8').trimEnd()}\n\n## Work Log\n\n- Verified tests\n`,
  );
  expectHookAllow(attemptExit('verify', 'done'));
  const beforeDoneClose = readFileSync(ticketPath, 'utf8');
  const doneVerifyPath = nodePath.join(ticket, 'verify.md');
  const beforeDoneVerify = readFileSync(doneVerifyPath, 'utf8');
  const beforeDoneLedger = readFileSync(ledgerPath, 'utf8');
  writeFileSync(
    ticketPath,
    beforeDoneClose
      .replace('phase: verify', 'phase: done')
      .replace('type: feature', 'type: feature\nstatus: in_progress'),
  );
  writeFileSync(
    doneVerifyPath,
    '# Verification result\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
  );
  writeFileSync(ledgerPath, ledger.replaceAll('- [ ]', '- [x]').replace('- [x] VERIFIED\n', ''));
  writeFileSync(changePath, 'unreviewed completion change\n');
  assertLocalHostsBlockEdit('status: in_progress', 'status: done');
  assertLocalHostsBlockEdit('id: ABC123', 'id: ABC123X', 'ticket ID');
  const priorTicketId = readFileSync(ticketPath, 'utf8');
  writeFileSync(ticketPath, priorTicketId.replace('id: ABC123', 'id: ABC123X'));
  assertLocalHostsBlockEdit('status: in_progress', 'status: done', 'ticket ID');
  assertLocalHostsEdit('# Review branch', '# Review branch\n\n## Work Log', true);
  writeFileSync(ticketPath, priorTicketId);
  assertLocalHostsBlockEdit('type: feature', 'type: task', 'bypass');
  assertLocalHostsBlockEdit(
    'type: feature\nstatus: in_progress',
    'type: task\nstatus: done',
    'bypass',
  );
  writeFileSync(ticketPath, beforeDoneClose);
  writeFileSync(doneVerifyPath, beforeDoneVerify);
  writeFileSync(ledgerPath, beforeDoneLedger);
  writeFileSync(changePath, 'reviewed content\n');
  writeFileSync(nodePath.join(project, 'change.txt'), 'unreviewed correction\n');
  const stale = attemptExit('verify', 'done');
  expect(stale.stdout).toContain('permissionDecision');
  expectHookDeny(stale, 'stale');
  expect(readFileSync(ticketPath, 'utf8')).toContain('phase: verify');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'verification correction');
  const verificationReview = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env,
  });
  expect(JSON.parse(verificationReview.stdout).data?.coverage, verificationReview.stdout).toBe(
    'complete',
  );
  expectHookAllow(attemptExit('verify', 'done'));
  expect(completionProblem()).toBeUndefined();
  let stopProof:
    | {
        claude: ReturnType<typeof spawnSync>;
        codex: ReturnType<typeof spawnSync>;
        owedAfter: string[];
        claudeTicket: string;
        codexTicket: string;
      }
    | undefined;
  if (hostCase === 'Claude Code / committed') {
    const savedTicket = readFileSync(ticketPath, 'utf8');
    const savedSource = readFileSync(changePath, 'utf8');
    const verifyPath = nodePath.join(ticket, 'verify.md');
    const savedVerify = readFileSync(verifyPath, 'utf8');
    const savedLedger = readFileSync(ledgerPath, 'utf8');
    writeFileSync(ledgerPath, ledger.replaceAll('- [ ]', '- [x]').replace('- [x] VERIFIED\n', ''));
    writeFileSync(
      verifyPath,
      '# Verification result\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
    );
    writeFileSync(
      ticketPath,
      savedTicket
        .replace('type: feature', 'type: feature\nstatus: done')
        .replace('phase: verify', 'phase: done'),
    );
    writeFileSync(changePath, 'unreviewed after phase exit\n');
    const transcriptPath = nodePath.join(project, 'branch-stop-transcript.jsonl');
    writeFileSync(
      transcriptPath,
      `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } })}\n`,
    );
    const claudeStatePath = nodePath.join(
      project,
      '.project',
      'quality-state-branch-stop-claude.json',
    );
    writeFileSync(
      claudeStatePath,
      JSON.stringify({ activeTicket: 'ABC123', doneGateOwedTickets: ['ABC123'] }),
    );
    const stopEnvironment = {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_PLUGIN_CLI: testCliPath,
    };
    const claude = spawnSync('bun', [claudeStopHookPath], {
      cwd: project,
      env: stopEnvironment,
      encoding: 'utf8',
      timeout: 20_000,
      input: JSON.stringify({
        session_id: 'branch-stop-claude',
        transcript_path: transcriptPath,
        stop_hook_active: true,
      }),
    });
    const owedAfter = (
      JSON.parse(readFileSync(claudeStatePath, 'utf8')) as { doneGateOwedTickets: string[] }
    ).doneGateOwedTickets;
    const claudeTicket = readFileSync(ticketPath, 'utf8');
    writeFileSync(ticketPath, claudeTicket.replace('status: done', 'status: in_progress'));
    const codexStatePath = nodePath.join(
      project,
      '.project',
      'quality-state-codex-branch-stop-codex.json',
    );
    writeFileSync(
      codexStatePath,
      JSON.stringify({ activeTicket: 'ABC123', locSinceCommit: 0, lastCommitHash: '' }),
    );
    const codex = spawnSync('bun', [codexStopHookPath], {
      cwd: project,
      env: stopEnvironment,
      encoding: 'utf8',
      timeout: 20_000,
      input: JSON.stringify({ session_id: 'branch-stop-codex', cwd: project }),
    });
    stopProof = {
      claude,
      codex,
      owedAfter,
      claudeTicket,
      codexTicket: readFileSync(ticketPath, 'utf8'),
    };
    writeFileSync(ticketPath, savedTicket);
    writeFileSync(changePath, savedSource);
    writeFileSync(verifyPath, savedVerify);
    writeFileSync(ledgerPath, savedLedger);
    rmSync(transcriptPath);
    rmSync(claudeStatePath);
    rmSync(codexStatePath);
    rmSync(nodePath.join(project, '.project', 'failure-counts.json'), { force: true });
  }
  git(project, 'commit', '--allow-empty', '-m', 'same reviewed correction');
  expectHookAllow(attemptExit('verify', 'done'));
  writeFileSync(auditSource, 'export const audit = 2;\n');
  expectHookDeny(attemptExit('verify', 'done'), 'stale');
  expect(completionProblem()).toContain('stale');
  writeFileSync(auditSource, 'export const audit = 1;\n');
  expectHookAllow(attemptExit('verify', 'done'));
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('- preserve access rule', '- allow bypass'),
  );
  const changedGoalBlocked = attemptExit('verify', 'done');
  expectHookDeny(changedGoalBlocked, 'stale');
  assertLocalHostsBlock('verify', 'done');

  const verificationReviewId = JSON.parse(verificationReview.stdout).data?.review_id as string;
  await expectMissingRecordRecovery(project, ticketPath, verificationReviewId, env, () =>
    attemptExit('verify', 'done'),
  );

  if (hostCase === 'Cursor / committed') {
    writeFileSync(
      ticketPath,
      readFileSync(ticketPath, 'utf8')
        .replace('- allow bypass', '- preserve access rule')
        .replace('phase: verify', 'phase: done')
        .replace('type: feature', 'type: feature\nstatus: in_progress'),
    );
    writeFileSync(
      doneVerifyPath,
      '# Verification result\n\n**PR Scope:** ✅ Diff matches ticket scope\n',
    );
    writeFileSync(ledgerPath, ledger.replaceAll('- [ ]', '- [x]').replace('- [x] VERIFIED\n', ''));
    git(project, 'add', ledgerPath);
    git(project, 'commit', '-m', 'complete scenario evidence');
    const closingReview = await runCli(['review', 'branch', 'ABC123', '--json'], {
      cwd: project,
      env,
    });
    expect(JSON.parse(closingReview.stdout).data?.coverage, closingReview.stdout).toBe('complete');
    assertLocalHostsEdit('status: in_progress', 'status: done', true);
  }

  git(project, 'reset', '--hard', 'main');
  git(project, 'clean', '-fd');
  let earlierFindingRecord: string | undefined;
  if (hostCase === 'Claude Code / committed') {
    writeFileSync(nodePath.join(project, 'change.txt'), 'unresolved access rule\n');
    git(project, 'add', 'change.txt');
    git(project, 'commit', '-m', 'unresolved access rule');
    const requested = await runCli(['review', 'branch', 'ABC123', '--json'], {
      cwd: project,
      env: { ...env, SAFEWORD_REVIEW_FAKE_FINDING: '1' },
    });
    const requestedId = JSON.parse(requested.stdout).data?.review_id as string;
    expect(JSON.parse(requested.stdout).data?.review_passes?.[0]?.status).toBe('changes_requested');
    const records = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
    const requestedFile = readdirSync(records).find(name => name.endsWith(`${requestedId}.json`));
    if (requestedFile === undefined) throw new Error('requested-change record is missing');
    earlierFindingRecord = nodePath.join(records, requestedFile);
    git(project, 'reset', '--hard', 'main');
    git(project, 'clean', '-fd');
  }
  const recordDirectory = nodePath.join(project, '.safeword', 'state', 'reviews', 'branch');
  const archivedRecords = `${recordDirectory}.legacy-fixture`;
  renameSync(recordDirectory, archivedRecords);
  await expectLegacyVerificationUncovered(project, ticketPath);
  renameSync(archivedRecords, recordDirectory);
  const noChanges = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project, env });
  const noChangesReport = JSON.parse(noChanges.stdout) as {
    data?: { coverage?: string; review_id?: string };
  };
  expect(noChangesReport.data?.coverage).toBe('none');
  const emptyBlocked = attemptExit();
  expectHookDeny(emptyBlocked, 'No branch changes were reviewed');
  writeFileSync(
    nodePath.join(project, '.project', 'skill-invocations.log'),
    'review:ABC123-review-branch:phase@implement skip:No branch changes exist at this implementation exit.\n',
  );
  expectHookDeny(attemptExit(), 'No branch changes were reviewed');
  writeFileSync(
    nodePath.join(project, '.project', 'skill-invocations.log'),
    `review:ABC123-review-branch:phase@implement review-id:${noChangesReport.data?.review_id} skip:No branch changes exist at this implementation exit.\n`,
  );
  const skippedExit = attemptExit();
  expectHookAllow(skippedExit);
  expect(skippedExit.stdout).toContain('No branch changes were reviewed');
  if (earlierFindingRecord !== undefined) {
    expect(skippedExit.stdout).toContain('The access rule still permits bypass.');
    expect(skippedExit.stdout).toContain('retained local jobs');
    const saved = readFileSync(earlierFindingRecord, 'utf8');
    writeFileSync(earlierFindingRecord, saved.replace('"integrity":"', '"integrity":"broken-'));
    expectHookDeny(attemptExit(), 'earlier retained branch review record is damaged');
    writeFileSync(earlierFindingRecord, saved);
  }
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: implement', 'phase: verify'),
  );
  expect(completionProblem()).toBeUndefined();
  if (earlierFindingRecord !== undefined) {
    const completion = await runCli(['review', 'branch-check', 'ABC123', 'verify', '--json'], {
      cwd: project,
    });
    expect(JSON.parse(completion.stdout).data?.disclosure).toContain(
      'The access rule still permits bypass.',
    );
    const saved = readFileSync(earlierFindingRecord, 'utf8');
    writeFileSync(earlierFindingRecord, saved.replace('"integrity":"', '"integrity":"broken-'));
    expect(completionProblem()).toContain('earlier retained branch review record is damaged');
    writeFileSync(earlierFindingRecord, saved);
  }
  writeFileSync(
    ticketPath,
    readFileSync(ticketPath, 'utf8').replace('phase: verify', 'phase: implement'),
  );
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/missing');
  const unavailable = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env,
  });
  expect(JSON.parse(unavailable.stdout).data?.coverage).toBe('none');
  expect(JSON.parse(unavailable.stdout).data?.freshness).toBe('current');
  expectHookDeny(attemptExit(), 'No branch changes were reviewed');
  const unavailableId = JSON.parse(unavailable.stdout).data?.review_id as string;
  if (host === 'OpenCode CLI') {
    const stampEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      SAFEWORD_AGENT_RUNTIME: 'opencode',
      SAFEWORD_PLUGIN_CLI: testCliPath,
    };
    delete stampEnvironment.CLAUDE_SESSION_ID;
    delete stampEnvironment.CODEX_THREAD_ID;
    for (const args of [
      ['--phase', 'implement', '--review-id', unavailableId, '--skip', 'No integration base'],
      ['--ticket', 'ABC123-review-branch', '--phase', 'implement', '--skip', 'No integration base'],
      [
        '--ticket',
        'ABC123-review-branch',
        '--phase',
        'plan-implementation',
        '--review-id',
        unavailableId,
        '--skip',
        'No integration base',
      ],
      [
        '--ticket',
        'ABC123-review-branch',
        '--phase',
        'implement',
        '--review-id',
        '00000000-0000-4000-8000-000000000000',
        '--skip',
        'No integration base',
      ],
    ]) {
      const incomplete = spawnSync('bun', [writeReviewStampPath, ...args], {
        cwd: project,
        encoding: 'utf8',
        env: stampEnvironment,
      });
      expect(incomplete.status).toBe(1);
      expect(incomplete.stdout).toContain('missing run identity');
    }
    const stamped = spawnSync(
      'bun',
      [
        writeReviewStampPath,
        '--ticket',
        'ABC123-review-branch',
        '--phase',
        'implement',
        '--review-id',
        unavailableId,
        '--skip',
        'No integration base can be reached for this review.',
      ],
      { cwd: project, encoding: 'utf8', env: stampEnvironment },
    );
    expect(stamped.status, stamped.stdout).toBe(0);
  } else {
    writeFileSync(
      nodePath.join(project, '.project', 'skill-invocations.log'),
      `review:ABC123-review-branch:phase@implement review-id:${unavailableId} skip:No integration base can be reached for this review.\n`,
    );
  }
  const unavailableExit = attemptExit();
  expect(unavailableExit.stdout).toContain('No branch changes were reviewed');
  expect(unavailableExit.stdout).toContain('exact branch path list unavailable');
  writeFileSync(nodePath.join(project, 'new-work.txt'), 'new work after empty review\n');
  expectHookDeny(attemptExit(), 'stale');
  return {
    current,
    stale,
    changedGoalBlocked,
    emptyBlocked,
    skippedExit,
    noChangesReport,
    stopProof,
  };
}

const gateProofs = new Map<string, ReturnType<typeof gatherGateProof>>();
function gateProof(hostCase: string): ReturnType<typeof gatherGateProof> {
  const existing = gateProofs.get(hostCase);
  if (existing) return existing;
  const promise = gatherGateProof(hostCase);
  gateProofs.set(hostCase, promise);
  return promise;
}

it.each([
  'Claude Code / committed',
  'Claude Code / left uncommitted',
  'OpenAI Codex / committed',
  'OpenAI Codex / left uncommitted',
  'Cursor / committed',
  'Cursor / left uncommitted',
  'OpenCode CLI / committed',
  'OpenCode CLI / left uncommitted',
])('exercises branch review exit in %s', async hostCase => {
  const proof = await gateProof(hostCase);
  expectHookAllow(proof.current);
});

it('lets a complete current review finish implementation', async () => {
  const proof = await gateProof('Claude Code / committed');
  expectHookAllow(proof.current);
});

it('rejects a verification code fix until it is reviewed again', async () => {
  const proof = await gateProof('Claude Code / committed');
  expectHookDeny(proof.stale, 'stale');
});

it('rejects changed ticket goals until they are reviewed again', async () => {
  const proof = await gateProof('Claude Code / committed');
  expectHookDeny(proof.changedGoalBlocked, 'stale');
});

it('Claude Stop retains the owed done gate after authored work changes', async () => {
  const proof = await gateProof('Claude Code / committed');
  expect(proof.stopProof?.claude.stdout).toContain('stale');
  expect(proof.stopProof?.owedAfter).toContain('ABC123');
  expect(proof.stopProof?.claudeTicket).toContain('status: done');
});

it('Codex Stop refuses to complete after authored work changes', async () => {
  const proof = await gateProof('Claude Code / committed');
  expect(proof.stopProof?.codex.stdout).toContain('stale');
  expect(proof.stopProof?.codexTicket).toContain('status: in_progress');
});

it('refuses an empty branch as a completed review but allows its reasoned skip', async () => {
  const proof = await gateProof('Claude Code / committed');
  expect(proof.noChangesReport.data?.coverage).toBe('none');
  expectHookDeny(proof.emptyBlocked, 'No branch changes were reviewed');
  expect(proof.emptyBlocked.stdout).toContain('--review-id');
  expectHookAllow(proof.skippedExit);
});
