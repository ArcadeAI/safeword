import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { expectHookAllow, expectHookDeny, runCli, testCliPath, TIMEOUT_QUICK } from '../helpers.js';
import { createTrustedReviewerDirectory } from '../review-fixtures.js';

const roots: string[] = [];
const hookPath = nodePath.resolve(import.meta.dirname, '../../templates/hooks/pre-tool-quality.ts');
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

it('requires an authenticated acknowledgement and the exact omission disclosure', async () => {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-branch-ack-'));
  roots.push(root);
  const remote = nodePath.join(root, 'remote.git');
  const project = nodePath.join(root, 'project');
  mkdirSync(project);
  git(root, 'init', '--bare', remote);
  git(project, 'init', '-b', 'main');
  git(project, 'config', 'user.name', 'Test Builder');
  git(project, 'config', 'user.email', 'builder@example.test');
  git(project, 'remote', 'add', 'origin', remote);
  const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'ABC123-review-branch');
  mkdirSync(ticketDirectory, { recursive: true });
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  writeFileSync(
    ticketPath,
    '---\nid: ABC123\ntype: feature\nphase: implement\n---\n# Review branch\n',
  );
  mkdirSync(nodePath.join(project, '.safeword'));
  writeFileSync(nodePath.join(project, '.safeword', 'SAFEWORD.md'), '# enrolled\n');
  writeFileSync(nodePath.join(project, '.safeword', 'config.json'), '{"reviewGate":false}\n');
  writeFileSync(nodePath.join(project, '.gitignore'), '.safeword/state/\n');
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'seed');
  git(project, 'push', '-u', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(project, 'checkout', '-b', 'topic');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(nodePath.join(project, 'binary.dat'), Buffer.from([0x80]));
  writeFileSync(nodePath.join(project, 'large-generated.txt'), 'x'.repeat(300_000));
  git(project, 'add', '.');
  git(project, 'commit', '-m', 'feature');

  const reviewerBin = nodePath.join(createTrustedReviewerDirectory('branch-ack-'), 'bin');
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
printf '{"schema_version":1,"dispatch_id":"%s","reviewer_agent":"claude","verdict":"approve","summary":"Reviewed source","findings":[]}\\n' "$dispatch_id"
`,
    { mode: 0o755 },
  );
  chmodSync(reviewer, 0o755);
  const review = await runCli(['review', 'branch', 'ABC123', '--json'], {
    cwd: project,
    env: {
      PATH: `${reviewerBin}:${process.env.PATH ?? ''}`,
      SAFEWORD_AGENT_RUNTIME: 'codex',
      SAFEWORD_NO_UPDATE_CHECK: '1',
    },
  });
  const report = JSON.parse(review.stdout) as {
    data: { review_id: string; coverage: string; omitted_paths: { path: string }[] };
  };
  expect(report.data.coverage).toBe('partial');
  expect(report.data.omitted_paths.map(entry => entry.path)).toEqual([
    'binary.dat',
    'large-generated.txt',
  ]);

  const attemptExit = () => {
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
      timeout: TIMEOUT_QUICK,
      env: hookEnvironment,
      input: JSON.stringify({
        session_id: 'branch-ack',
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: {
          file_path: ticketPath,
          old_string: 'phase: implement',
          new_string: 'phase: verify',
        },
      }),
    });
  };
  expectHookDeny(attemptExit(), 'incomplete');
  const ack = await runCli(
    [
      'review',
      'branch-ack',
      'ABC123',
      report.data.review_id,
      '--reason',
      'Continue with the generated file omitted',
      '--json',
    ],
    { cwd: project },
  );
  const ackResult = JSON.parse(ack.stdout) as { data?: { command?: string; disclosure?: string } };
  const disclosure = ackResult.data?.disclosure;
  expect(typeof disclosure).toBe('string');
  if (disclosure === undefined) throw new Error('acknowledgement did not generate disclosure');
  expect(ack.exitCode).toBe(0);
  expect(ackResult.data?.command).toBe('review branch-ack');
  expect(disclosure).toContain('large-generated.txt');
  expect(disclosure).toMatch(/partial/iu);
  const ticketContent = readFileSync(ticketPath, 'utf8');
  expect(ticketContent.slice(ticketContent.indexOf('## Work Log'))).toContain(disclosure);
  const allowed = attemptExit();
  expect(allowed.stdout).not.toContain('"permissionDecision":"deny"');
  expectHookAllow(allowed);
  expect(allowed.stdout).toContain(disclosure);
  writeFileSync(ticketPath, readFileSync(ticketPath, 'utf8').replace(`- ${disclosure}`, ''));
  expectHookDeny(attemptExit(), 'disclosure');
  const repaired = await runCli(
    [
      'review',
      'branch-ack',
      'ABC123',
      report.data.review_id,
      '--reason',
      'Continue with the generated file omitted',
      '--json',
    ],
    { cwd: project },
  );
  expect(repaired.exitCode).toBe(0);
  expectHookAllow(attemptExit());
  writeFileSync(ticketPath, readFileSync(ticketPath, 'utf8').replace(`- ${disclosure}`, ''));
  expectHookDeny(attemptExit(), 'disclosure');
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 2;\n');
  const stale = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  const staleReport = JSON.parse(stale.stdout);
  expect(staleReport.data?.freshness).toBe('stale');
  expect(staleReport.data?.coverage).toBe('partial');
  expect(staleReport.data?.omitted_paths).toContainEqual({
    path: 'large-generated.txt',
    reason: 'file exceeds reviewer packet limit',
  });
  writeFileSync(nodePath.join(project, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(nodePath.join(project, 'binary.dat'), Buffer.from([0x81]));
  const changedBinary = await runCli(['review', 'branch-check', 'ABC123', 'implement', '--json'], {
    cwd: project,
  });
  expect(JSON.parse(changedBinary.stdout).data?.freshness).toBe('stale');
});
