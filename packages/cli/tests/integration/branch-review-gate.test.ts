import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { expectHookAllow, expectHookDeny, runCli, testCliPath, TIMEOUT_QUICK } from '../helpers.js';
import { claudeReviewerShellPrelude, createTrustedReviewerDirectory } from '../review-fixtures.js';

const roots: string[] = [];
const hookPath = nodePath.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts');
const codexHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/codex/pre-tool-quality.ts',
);
const cursorHookPath = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/cursor/pre-tool-quality.ts',
);
const openCodeDispatcherPath = nodePath.resolve(
  import.meta.dirname,
  '../../dist/opencode/dispatcher.js',
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
  writeFileSync(
    planPath,
    plan.replace('| open | missing | | |', '| done | real_boundary | | passed |'),
  );
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'record verification progress');
  const check = await checkReview();
  expectCurrentBranchCheck(check.stdout);
  const ticketPath = nodePath.join(ticket, 'ticket.md');
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
});

it.each(['Claude Code', 'OpenAI Codex', 'Cursor', 'OpenCode CLI'])(
  'accepts the reviewed snapshot and refuses later authored changes in %s',
  async host => {
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
      '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
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
    const ticketPath = nodePath.join(ticket, 'ticket.md');
    const attemptExit = (from = 'implement', to = 'verify') => {
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
        timeout: TIMEOUT_QUICK,
        input: JSON.stringify({
          session_id: 'branch-review-gate',
          hook_event_name: 'PreToolUse',
          tool_name: 'Edit',
          tool_input: {
            file_path: ticketPath,
            old_string: `phase: ${from}`,
            new_string: `phase: ${to}`,
          },
        }),
      });
    };
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
    expect(readFileSync(ticketPath, 'utf8')).toContain(
      `branch_review_exit_id: ${firstReview.data?.review_id}`,
    );
    const markerRemoval = spawnSync('bun', [hookPath], {
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
        session_id: 'branch-marker',
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketPath,
          old_string: `branch_review_exit_id: ${firstReview.data?.review_id}\n`,
          new_string: '',
        },
      }),
    });
    expectHookDeny(markerRemoval, 'review marker');
    const assertLocalHostsBlock = (from: 'implement' | 'verify', to: 'verify' | 'done') => {
      const edit = {
        file_path: ticketPath,
        old_string: `phase: ${from}`,
        new_string: `phase: ${to}`,
      };
      const hookEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        SAFEWORD_PLUGIN_CLI: testCliPath,
      };
      delete hookEnvironment.CODEX_HOME;
      delete hookEnvironment.CLAUDE_PLUGIN_ROOT;
      if (host === 'Claude Code') {
        expectHookDeny(attemptExit(from, to), 'stale');
        return;
      }
      if (host === 'OpenAI Codex') {
        const codex = spawnSync('bun', [codexHookPath], {
          cwd: project,
          encoding: 'utf8',
          env: hookEnvironment,
          timeout: TIMEOUT_QUICK,
          input: JSON.stringify({
            session_id: 'branch-codex',
            tool_name: 'Edit',
            tool_input: edit,
          }),
        });
        expectHookDeny(codex, 'stale');
        return;
      }
      if (host === 'Cursor') {
        const cursor = spawnSync('bun', [cursorHookPath], {
          cwd: project,
          encoding: 'utf8',
          env: hookEnvironment,
          timeout: TIMEOUT_QUICK,
          input: JSON.stringify({
            conversation_id: 'branch-cursor',
            workspace_roots: [project],
            tool_name: 'Write',
            tool_input: {
              file_path: ticketPath,
              content: readFileSync(ticketPath, 'utf8')
                .split(`phase: ${from}`)
                .join(`phase: ${to}`),
            },
          }),
        });
        expect(cursor.stdout).toContain('stale');
        expect(JSON.parse(cursor.stdout).permission).toBe('deny');
        return;
      }
      const openCode = spawnSync('bun', [openCodeDispatcherPath], {
        cwd: project,
        encoding: 'utf8',
        env: hookEnvironment,
        timeout: TIMEOUT_QUICK,
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          session_id: 'branch-opencode',
          tool_name: 'Edit',
          tool_input: edit,
        }),
      });
      expect(openCode.status).toBe(2);
      expect(openCode.stderr).toContain('stale');
    };
    const current = attemptExit();
    expectHookAllow(current);
    writeFileSync(
      ledgerPath,
      ledger
        .replace('- [ ] RED', '- [x] RED abc1234')
        .replace('- [ ] GREEN', '- [x] GREEN def5678')
        .replace('- [ ] REFACTOR', '- [x] REFACTOR skip: no change needed')
        .replace('- [ ] cross-scenario', '- [x] cross-scenario fed1234')
        .replace('- [ ] VERIFIED', '- [x] VERIFIED abcdef1'),
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
    git(project, 'commit', '--allow-empty', '-m', 'same reviewed correction');
    expectHookAllow(attemptExit('verify', 'done'));
    writeFileSync(auditSource, 'export const audit = 2;\n');
    expectHookDeny(attemptExit('verify', 'done'), 'stale');
    writeFileSync(auditSource, 'export const audit = 1;\n');
    expectHookAllow(attemptExit('verify', 'done'));
    writeFileSync(
      ticketPath,
      readFileSync(ticketPath, 'utf8').replace('# Review branch', '# Change the goal'),
    );
    expectHookDeny(attemptExit('verify', 'done'), 'stale');
    assertLocalHostsBlock('verify', 'done');

    git(project, 'reset', '--hard', 'main');
    git(project, 'clean', '-fd');
    const noChanges = await runCli(['review', 'branch', 'ABC123', '--json'], { cwd: project, env });
    expect(JSON.parse(noChanges.stdout).data?.coverage).toBe('none');
    expectHookDeny(attemptExit(), 'No branch changes were reviewed');
    writeFileSync(
      nodePath.join(project, '.project', 'skill-invocations.log'),
      'review:ABC123-review-branch:phase@implement skip:No branch changes exist at this implementation exit.\n',
    );
    expect(attemptExit().stdout).toContain('Reasoned skip: No branch changes exist');
    git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/missing');
    const unavailable = await runCli(['review', 'branch', 'ABC123', '--json'], {
      cwd: project,
      env,
    });
    expect(JSON.parse(unavailable.stdout).data?.coverage).toBe('none');
    expect(JSON.parse(unavailable.stdout).data?.freshness).toBe('current');
    expect(attemptExit().stdout).toContain('Reasoned skip: No branch changes exist');
    writeFileSync(nodePath.join(project, 'new-work.txt'), 'new work after empty review\n');
    expectHookDeny(attemptExit(), 'stale');
  },
);
