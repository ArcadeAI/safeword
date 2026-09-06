import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { generateClaudePluginAssets } from '../../src/claude-plugin/catalogue.js';
import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { VERSION } from '../../src/version.js';
import { readFreshCloseoutBinding } from '../../templates/hooks/lib/closeout-binding.ts';
import {
  draftSpoolPath,
  readSpooledDrafts,
  recordFiledAck,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.ts';
import {
  assertTestCliFresh,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  repoRoot,
  sealedRetroDraft,
  setupOrThrow,
  testCliPath,
} from '../helpers.js';
import { blockChildren } from '../helpers/io-failure.js';

const temporaryProjects: string[] = [];

beforeAll(assertTestCliFresh);

function runOrThrow(
  command: string,
  arguments_: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = spawnSync(command, arguments_, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout.trim();
}

function executable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

interface DeliveryFixture {
  bare: string;
  bin: string;
  main: string;
  topic: string;
  oid: string;
}

function verificationReceiptPath(fixture: DeliveryFixture): string {
  return nodePath.join(fixture.main, '.git', 'safeword', 'closeout-verification.json');
}

function cleanStateHash(oid: string): string {
  return createHash('sha256').update(`${oid}\0`).digest('hex');
}

function deliveryFixture(): DeliveryFixture {
  const sandbox = createTemporaryDirectory();
  temporaryProjects.push(sandbox);
  const bare = nodePath.join(sandbox, 'remote.git');
  const main = nodePath.join(sandbox, 'main');
  const topic = nodePath.join(sandbox, 'topic');
  const bin = nodePath.join(sandbox, 'bin');
  mkdirSync(bin);
  runOrThrow('git', ['init', '--bare', bare], sandbox);
  runOrThrow('git', ['init', '--initial-branch=main', main], sandbox);
  runOrThrow('git', ['config', 'user.email', 'closeout@example.test'], main);
  runOrThrow('git', ['config', 'user.name', 'Closeout Test'], main);
  mkdirSync(nodePath.join(main, '.safeword/scripts'), { recursive: true });
  mkdirSync(nodePath.join(main, '.safeword/hooks'), { recursive: true });
  writeFileSync(nodePath.join(main, '.safeword/SAFEWORD.md'), '# SafeWord\n');
  writeFileSync(nodePath.join(main, '.gitignore'), '.project/\n.safeword/retro-drafts/\n');
  copyFileSync(
    nodePath.join(repoRoot, 'packages/cli/templates/scripts/closeout-cleanup.ts'),
    nodePath.join(main, '.safeword/scripts/closeout-cleanup.ts'),
  );
  cpSync(
    nodePath.join(repoRoot, 'packages/cli/templates/hooks/lib'),
    nodePath.join(main, '.safeword/hooks/lib'),
    { recursive: true },
  );
  runOrThrow('git', ['add', '.'], main);
  runOrThrow('git', ['commit', '-m', 'main'], main);
  runOrThrow('git', ['remote', 'add', 'origin', 'git@github.com:acme/widget.git'], main);

  const ssh = nodePath.join(bin, 'ssh');
  executable(
    ssh,
    `#!/bin/sh
case "$*" in
  *git-upload-pack*) exec git-upload-pack "$SAFEWORD_TEST_BARE" ;;
  *git-receive-pack*) exec git-receive-pack "$SAFEWORD_TEST_BARE" ;;
esac
exit 1
`,
  );
  const gitEnvironment = { ...process.env, GIT_SSH_COMMAND: ssh, SAFEWORD_TEST_BARE: bare };
  runOrThrow('git', ['push', '-u', 'origin', 'main'], main, gitEnvironment);
  runOrThrow('git', ['worktree', 'add', '-b', 'feature/closeout', topic], main);
  writeFileSync(nodePath.join(topic, 'feature.txt'), 'feature\n');
  runOrThrow('git', ['add', 'feature.txt'], topic);
  runOrThrow('git', ['commit', '-m', 'feature'], topic);
  runOrThrow('git', ['push', '-u', 'origin', 'feature/closeout'], topic, gitEnvironment);
  return { bare, bin, main, topic, oid: runOrThrow('git', ['rev-parse', 'HEAD'], topic) };
}

function installBoundaryFakes(
  fixture: DeliveryFixture,
  requiredChecksGreen = true,
  rollup: 'green' | 'failed' | 'pending' | 'missing' = requiredChecksGreen ? 'green' : 'missing',
): void {
  let statusCheckRollup;
  switch (rollup) {
    case 'green': {
      statusCheckRollup = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
      break;
    }
    case 'failed': {
      statusCheckRollup = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
      break;
    }
    case 'pending': {
      statusCheckRollup = [{ __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' }];
      break;
    }
    case 'missing': {
      break;
    }
  }
  const pullRequestJson = JSON.stringify({
    url: 'https://github.com/acme/widget/pull/42',
    state: 'MERGED',
    headRefName: 'feature/closeout',
    headRefOid: fixture.oid,
    headRepositoryOwner: { login: 'acme' },
    headRepository: { name: 'widget', nameWithOwner: 'acme/widget' },
    ...(statusCheckRollup && { statusCheckRollup }),
  });
  const requiredChecksJson = JSON.stringify(
    requiredChecksGreen ? [{ bucket: 'pass', state: 'SUCCESS' }] : [],
  );
  executable(
    nodePath.join(fixture.bin, 'gh'),
    String.raw`#!/bin/sh
case "$1 $2" in
  "pr view") printf '%s\n' '${pullRequestJson}' ;;
  "pr checks") printf '%s\n' '${requiredChecksJson}' ;;
  "repo view") printf '%s\n' '{"defaultBranchRef":{"name":"main"}}' ;;
  "auth token") printf '%s\n' 'test-token' ;;
  "api repos/acme/widget/branches/feature%2Fcloseout") printf '%s\n' '{"protected":false}' ;;
  *) exit 1 ;;
esac
`,
  );
  executable(
    nodePath.join(fixture.bin, 'claude'),
    String.raw`#!/bin/sh
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"[]"}'
`,
  );
  executable(
    nodePath.join(fixture.bin, 'cursor-agent'),
    String.raw`#!/bin/sh
test -f .cursor/cli.json || exit 9
test -f .cursor/sandbox.json || exit 10
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"[]"}'
`,
  );
  executable(
    nodePath.join(fixture.bin, 'codex'),
    String.raw`#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; output="$1"; fi
  shift
done
test -n "$output" || exit 11
printf '%s\n' '{"findings":[]}' > "$output"
`,
  );
  executable(
    nodePath.join(fixture.bin, 'safeword'),
    `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') {
  console.log(JSON.stringify([{ cwd: process.cwd(), command: 'true', available: true }]));
} else if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false }, errors: [] }));
} else process.exit(1);
`,
  );
}

function boundarySafewordCli(fixture: DeliveryFixture): string {
  return nodePath.join(fixture.bin, 'safeword');
}

interface BindHostSessionInput {
  runtime: 'claude' | 'codex' | 'cursor';
  fixture: DeliveryFixture;
  environment: NodeJS.ProcessEnv;
  id: string;
  transcript: string;
  guardArguments?: string;
}

function bindHostSession(input_: BindHostSessionInput): void {
  const { runtime, fixture, environment, id, transcript } = input_;
  const guardArguments = input_.guardArguments ?? '--pr 42';
  const guard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');
  const command = `bun "${guard}" ${guardArguments}`;
  let hook: string[];
  let hookInput: Record<string, unknown>;
  if (runtime === 'claude') {
    hook = ['bun', nodePath.join(repoRoot, 'packages/cli/templates/hooks/pre-tool-quality.ts')];
    hookInput = {
      session_id: id,
      transcript_path: transcript,
      tool_name: 'Bash',
      tool_input: { command },
    };
  } else if (runtime === 'codex') {
    hook = [process.execPath, testCliPath, 'hook', 'codex', 'pre-tool-use'];
    hookInput = { session_id: id, tool_name: 'Bash', tool_input: { command } };
  } else {
    hook = [
      'bun',
      nodePath.join(repoRoot, 'packages/cli/templates/hooks/cursor/before-shell-execution.ts'),
    ];
    hookInput = {
      workspace_roots: [fixture.topic],
      conversation_id: id,
      transcript_path: transcript,
      command,
    };
  }
  const [hookCommand, ...hookArguments] = hook;
  if (!hookCommand) throw new Error('host hook command is missing');
  const result = spawnSync(hookCommand, hookArguments, {
    cwd: fixture.topic,
    env: environment,
    input: JSON.stringify(hookInput),
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

interface BindClaudeSessionAtInput {
  fixture: DeliveryFixture;
  environment: NodeJS.ProcessEnv;
  cwd: string;
  id: string;
  transcript: string;
  guardArguments: string;
}

function bindClaudeSessionAt(input_: BindClaudeSessionAtInput): void {
  const { fixture, environment, cwd, id, transcript, guardArguments } = input_;
  const guard = nodePath.join(cwd, '.safeword/scripts/closeout-cleanup.ts');
  const result = spawnSync(
    'bun',
    [nodePath.join(repoRoot, 'packages/cli/templates/hooks/pre-tool-quality.ts')],
    {
      cwd,
      env: { ...environment, CLAUDE_PROJECT_DIR: cwd },
      input: JSON.stringify({
        session_id: id,
        transcript_path: transcript,
        tool_name: 'Bash',
        tool_input: { command: `bun "${guard}" ${guardArguments}` },
      }),
      encoding: 'utf8',
    },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(fixture.main)).toBe(true);
}

function project(): string {
  const directory = createTemporaryDirectory();
  temporaryProjects.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'));
  writeFileSync(nodePath.join(directory, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');
  return directory;
}

afterEach(() => {
  for (const directory of temporaryProjects) removeTemporaryDirectory(directory);
  temporaryProjects.length = 0;
});

function closeoutCommand(directory: string): string {
  return `bun "${directory}/.safeword/scripts/closeout-cleanup.ts" --pr 42`;
}

/**
 * Strips Claude's identity from an environment that means to present a CODEX
 * host.
 *
 * Run identity resolves Claude before Codex deliberately — see
 * templates/hooks/lib/run-identity.ts: "Keep this after Claude detection so an
 * explicit Claude environment never adopts a Codex runtime accidentally." So a
 * fixture that inherits `process.env` while running inside a Claude Code
 * session hands the child its own CLAUDE_CODE_SESSION_ID, the child resolves
 * runtime `claude`, and the Codex binding under test never resolves.
 *
 * CI has no agent session, so leaving these in place passes there and fails
 * for anyone running the suite from Claude Code.
 */
function codexHostEnvironment<T extends Record<string, string | undefined>>(environment: T): T {
  const scrubbed = { ...environment };
  delete scrubbed.CLAUDE_SESSION_ID;
  delete scrubbed.CLAUDE_CODE_SESSION_ID;
  return scrubbed;
}

describe('closeout production host adapters (93C14D TBU1.R4)', () => {
  it('completes freshly verified cleanup without a host session binding', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const codexHome = nodePath.join(nodePath.dirname(fixture.bare), 'codex-home');
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CODEX_HOME: codexHome,
      CODEX_THREAD_ID: '',
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    const guard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');
    const preview = spawnSync('bun', [guard, '--pr', '42'], {
      cwd: fixture.topic,
      env: environment,
      encoding: 'utf8',
    });
    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
    const previewResult = JSON.parse(preview.stdout) as {
      digest: string;
      plan: { blockers: string[]; advisories: string[] };
    };
    expect(previewResult.plan.blockers).toEqual([]);
    expect(previewResult.plan.advisories).toContain(
      'the current host session binding is missing or expired',
    );
    const handoffDirectory = nodePath.join(codexHome, 'safeword', 'closeout-handoff-v1');
    expect(existsSync(handoffDirectory)).toBe(false);

    const apply = spawnSync('bun', [guard, '--pr', '42', '--yes', '--plan', previewResult.digest], {
      cwd: fixture.topic,
      env: environment,
      encoding: 'utf8',
    });
    expect(apply.status, `${apply.stderr}\n${apply.stdout}`).toBe(0);
    expect(existsSync(fixture.topic)).toBe(false);
  });

  it('binds the authenticated Codex Desktop task across linked worktrees without a hook bridge', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'codex-linked-bootstrap';
    const codexHome = nodePath.join(sandbox, 'codex-home');
    const transcriptDirectory = nodePath.join(codexHome, 'sessions');
    const transcript = nodePath.join(transcriptDirectory, `rollout-${id}.jsonl`);
    mkdirSync(transcriptDirectory, { recursive: true });
    writeFileSync(
      transcript,
      `${JSON.stringify({ type: 'session_meta', payload: { id, cwd: fixture.main } })}\n`,
    );
    const environment = codexHostEnvironment({
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CODEX_HOME: codexHome,
      CODEX_THREAD_ID: id,
      CLAUDE_PROJECT_DIR: fixture.topic,
    });

    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );

    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
    const receiptPath = nodePath.join(fixture.main, '.git', 'safeword', 'closeout-retro.json');
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
      runtime: string;
      id: string;
      snapshot: { path: string };
    };
    expect(receipt).toMatchObject({
      runtime: 'codex',
      id,
      snapshot: { path: realpathSync(transcript) },
    });
  }, 30_000);

  it('reports a post-preview fallback spool without blocking cleanup', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-cross-worktree-fallback';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    const cli = nodePath.join(fixture.bin, 'filing-needed-safeword.ts');
    const retroCounter = nodePath.join(sandbox, 'retro-count.txt');
    const draft = sealedRetroDraft('retro:crossworktree', 'Cross-worktree fallback');
    const unrelated = sealedRetroDraft('retro:unrelated0000', 'Unrelated spool');
    const unrelatedId = 'unrelated-session';
    writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: fixture.topic })}\n`);
    executable(
      cli,
      `#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') {
  console.log(JSON.stringify([{ cwd: process.cwd(), command: 'true', available: true }]));
} else if (args[0] === 'retro' && args[1] === 'run') {
  const count = existsSync(process.env.SAFEWORD_RETRO_COUNTER)
    ? Number(readFileSync(process.env.SAFEWORD_RETRO_COUNTER, 'utf8'))
    : 0;
  writeFileSync(process.env.SAFEWORD_RETRO_COUNTER, String(count + 1));
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: count > 0 } }));
} else process.exit(1);
`,
    );
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: cli,
      SAFEWORD_RETRO_COUNTER: retroCounter,
      CLAUDE_PROJECT_DIR: fixture.topic,
    };

    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );
    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
    writeFileSync(transcript, `${JSON.stringify({ role: 'assistant', text: 'late finding' })}\n`, {
      flag: 'a',
    });
    spoolDrafts(fixture.topic, id, [draft]);
    spoolDrafts(fixture.topic, unrelatedId, [unrelated]);
    const unrelatedPath = draftSpoolPath(fixture.topic, unrelatedId);
    const unrelatedBefore = readFileSync(unrelatedPath);
    bindHostSession({
      runtime: 'claude',
      fixture,
      environment,
      id,
      transcript,
      guardArguments: '--pr 42',
    });
    const apply = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );

    expect(apply.status, `${apply.stderr}\n${apply.stdout}`).toBe(0);
    expect(apply.stdout, apply.stderr).not.toBe('');
    const refreshed = JSON.parse(apply.stdout) as {
      digest: string;
      plan: { retro?: { spoolPath?: string; durableSpoolPath?: string } };
    };
    const plan = refreshed.plan;
    const continuation = plan.retro?.spoolPath;
    const durableContinuation = plan.retro?.durableSpoolPath;
    expect(continuation).toBe(realpathSync(draftSpoolPath(fixture.topic, id)));
    if (!continuation || !durableContinuation) {
      throw new Error('closeout did not expose its filing continuation');
    }
    expect(existsSync(durableContinuation)).toBe(false);
    expect(existsSync(fixture.topic)).toBe(true);
    expect(
      runOrThrow(
        'git',
        ['ls-remote', '--refs', 'origin', 'refs/heads/feature/closeout'],
        fixture.topic,
        environment,
      ),
    ).toContain(fixture.oid);

    const lateDraft = sealedRetroDraft('retro:latecrosswork', 'Late cross-worktree fallback');
    spoolDrafts(fixture.topic, id, [lateDraft]);
    bindHostSession({
      runtime: 'claude',
      fixture,
      environment,
      id,
      transcript,
      guardArguments: '--pr 42',
    });

    const applied = spawnSync(
      'bun',
      [
        nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'),
        '--pr',
        '42',
        '--yes',
        '--plan',
        refreshed.digest,
      ],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );
    expect(applied.status, `${applied.stderr}\n${applied.stdout}`).toBe(0);
    expect(existsSync(fixture.topic)).toBe(false);
    expect(existsSync(durableContinuation)).toBe(true);
    expect(runOrThrow('git', ['status', '--porcelain'], fixture.main, environment)).toBe('');
    const durableUnrelatedPath = nodePath.join(
      fixture.main,
      '.safeword/retro-drafts',
      nodePath.basename(unrelatedPath),
    );
    expect(readFileSync(durableUnrelatedPath)).toEqual(unrelatedBefore);

    const validation = spawnSync(
      'bun',
      [
        nodePath.join(fixture.main, '.safeword/hooks/lib/drain-retro-spool.ts'),
        durableContinuation,
        '--validated-jsonl',
      ],
      { cwd: fixture.main, encoding: 'utf8' },
    );
    expect(validation.status, validation.stderr).toBe(0);
    expect(
      validation.stdout
        .trim()
        .split('\n')
        .map(line => JSON.parse(line)),
    ).toEqual([draft, lateDraft]);

    expect(recordFiledAck(fixture.main, id, { signature: draft.signature, issue: 1942 })).toBe(
      true,
    );
    expect(recordFiledAck(fixture.main, id, { signature: lateDraft.signature, issue: 1943 })).toBe(
      true,
    );
    const drain = spawnSync(
      'bun',
      [
        nodePath.join(fixture.main, '.safeword/hooks/lib/drain-retro-spool.ts'),
        durableContinuation,
      ],
      { cwd: fixture.main, encoding: 'utf8' },
    );
    expect(drain.status, drain.stderr).toBe(0);
    expect(readSpooledDrafts(fixture.main, id)).toEqual([]);
  }, 30_000);

  it('fails closed when a mandatory local verification lane has no commands', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture, false);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-empty-verification-plan';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    const cli = nodePath.join(fixture.bin, 'empty-plan-safeword.ts');
    writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: fixture.topic })}\n`);
    executable(
      cli,
      `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') console.log('[]');
else if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }));
} else process.exit(1);
`,
    );
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: cli,
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );

    expect(preview.status).toBe(2);
    expect(
      (JSON.parse(preview.stdout) as { plan: { blockers: string[] } }).plan.blockers,
    ).toContain('local verification failed');
    expect(existsSync(verificationReceiptPath(fixture))).toBe(false);
  }, 30_000);

  it.each([true, false])(
    'trusts a green hosted rollup only with required checks (required checks: %s)',
    requiredChecks => {
      const fixture = deliveryFixture();
      installBoundaryFakes(fixture, requiredChecks, 'green');
      const sandbox = nodePath.dirname(fixture.bare);
      const id = 'claude-green-ci';
      const transcript = nodePath.join(sandbox, `${id}.jsonl`);
      const localPlanMarker = nodePath.join(sandbox, 'local-plan-ran');
      const cli = nodePath.join(fixture.bin, 'green-ci-safeword.ts');
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: fixture.topic })}\n`);
      executable(
        cli,
        `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') {
  writeFileSync(process.env.SAFEWORD_LOCAL_PLAN_MARKER, 'ran');
  process.exit(1);
}
if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }));
} else process.exit(1);
`,
      );
      const environment = {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
        SAFEWORD_TEST_BARE: fixture.bare,
        SAFEWORD_CLI: cli,
        SAFEWORD_LOCAL_PLAN_MARKER: localPlanMarker,
        CLAUDE_PROJECT_DIR: fixture.topic,
      };
      bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
      const preview = spawnSync(
        'bun',
        [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
        { cwd: fixture.topic, env: environment, encoding: 'utf8' },
      );

      expect(preview.status).toBe(requiredChecks ? 0 : 2);
      expect(existsSync(localPlanMarker)).toBe(!requiredChecks);
      expect(existsSync(verificationReceiptPath(fixture))).toBe(requiredChecks);
    },
    30_000,
  );

  it('blocks cleanup when the effective push repository differs from the pull request head', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    runOrThrow(
      'git',
      ['remote', 'set-url', '--push', 'origin', 'git@github.com:other/widget.git'],
      fixture.topic,
    );
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-mismatched-push-repository';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    const cli = nodePath.join(fixture.bin, 'push-repository-safeword.ts');
    writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: fixture.topic })}\n`);
    executable(
      cli,
      `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }));
} else process.exit(1);
`,
    );
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: cli,
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );

    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(2);
    expect(
      (JSON.parse(preview.stdout) as { plan: { blockers: string[] } }).plan.blockers,
    ).toContain('the pull request head repository does not map to exactly one git remote');
    expect(
      runOrThrow(
        'git',
        ['ls-remote', '--refs', 'origin', 'refs/heads/feature/closeout'],
        fixture.topic,
        environment,
      ),
    ).toContain(fixture.oid);
  }, 30_000);

  it.each(['failed', 'pending'] as const)(
    'falls back to local verification when a non-required hosted check is %s',
    rollup => {
      const fixture = deliveryFixture();
      installBoundaryFakes(fixture, true, rollup);
      const sandbox = nodePath.dirname(fixture.bare);
      const id = `claude-${rollup}-optional-check`;
      const transcript = nodePath.join(sandbox, `${id}.jsonl`);
      const localPlanMarker = nodePath.join(sandbox, 'local-plan-ran');
      const cli = nodePath.join(fixture.bin, 'hosted-rollup-fallback-safeword.ts');
      writeFileSync(transcript, `${JSON.stringify({ session_id: id, cwd: fixture.topic })}\n`);
      executable(
        cli,
        `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') {
  writeFileSync(process.env.SAFEWORD_LOCAL_PLAN_MARKER, 'ran');
  console.log(JSON.stringify([{ cwd: process.env.CLAUDE_PROJECT_DIR, command: 'true', available: true }]));
} else if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }));
} else process.exit(1);
`,
      );
      const environment = {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
        SAFEWORD_TEST_BARE: fixture.bare,
        SAFEWORD_CLI: cli,
        SAFEWORD_LOCAL_PLAN_MARKER: localPlanMarker,
        CLAUDE_PROJECT_DIR: fixture.topic,
      };
      bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
      const preview = spawnSync(
        'bun',
        [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
        { cwd: fixture.topic, env: environment, encoding: 'utf8' },
      );

      expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
      expect(readFileSync(localPlanMarker, 'utf8')).toBe('ran');
      expect(existsSync(verificationReceiptPath(fixture))).toBe(true);
    },
    30_000,
  );

  it.each(['claude', 'codex', 'cursor'] as const)(
    'drives the installed %s hook through the actual guard and real Git cleanup',
    runtime => {
      const fixture = deliveryFixture();
      installBoundaryFakes(fixture);
      const sandbox = nodePath.dirname(fixture.bare);
      const id = `${runtime}-closeout-e2e`;
      let transcript: string;
      const codexHome = nodePath.join(sandbox, 'codex-home');
      if (runtime === 'codex') {
        mkdirSync(nodePath.join(codexHome, 'sessions'), { recursive: true });
        transcript = nodePath.join(codexHome, 'sessions', `rollout-${id}.jsonl`);
        writeFileSync(
          transcript,
          [
            JSON.stringify({
              type: 'session_meta',
              payload: { id, session_id: id, cwd: fixture.topic },
            }),
            JSON.stringify({
              type: 'response_item',
              payload: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: 'close this session' }],
              },
            }),
          ].join('\n'),
        );
      } else if (runtime === 'cursor') {
        const transcriptDirectory = nodePath.join(sandbox, 'agent-transcripts', id);
        mkdirSync(transcriptDirectory, { recursive: true });
        transcript = nodePath.join(transcriptDirectory, `${id}.jsonl`);
        writeFileSync(
          transcript,
          `${JSON.stringify({
            role: 'user',
            message: { content: [{ type: 'text', text: 'close this session' }] },
          })}\n`,
        );
      } else {
        transcript = nodePath.join(sandbox, `${id}.jsonl`);
        writeFileSync(
          transcript,
          [
            JSON.stringify({ type: 'session_meta', sessionId: id, cwd: fixture.topic }),
            JSON.stringify({
              message: { role: 'user', content: [{ type: 'text', text: 'close this session' }] },
            }),
          ].join('\n'),
        );
      }

      const baseEnvironment = {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
        SAFEWORD_TEST_BARE: fixture.bare,
        SAFEWORD_CLI: boundarySafewordCli(fixture),
        CODEX_HOME: codexHome,
        ...(runtime === 'codex' && { CODEX_THREAD_ID: id }),
        CLAUDE_PROJECT_DIR: fixture.topic,
      };
      const environment =
        runtime === 'codex' ? codexHostEnvironment(baseEnvironment) : baseEnvironment;
      const guard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');

      bindHostSession({ runtime, fixture, environment, id, transcript });
      const preview = spawnSync('bun', [guard, '--pr', '42'], {
        cwd: fixture.topic,
        env: environment,
        encoding: 'utf8',
      });
      expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
      expect((JSON.parse(preview.stdout) as { digest: string }).digest).not.toBe('');

      bindHostSession({ runtime, fixture, environment, id, transcript });
      const stablePreview = spawnSync('bun', [guard, '--pr', '42'], {
        cwd: fixture.topic,
        env: environment,
        encoding: 'utf8',
      });
      const statusAfterRetro = runOrThrow('git', ['status', '--short'], fixture.topic);
      expect(
        stablePreview.status,
        `${stablePreview.stderr}\n${stablePreview.stdout}\ngit status:\n${statusAfterRetro}`,
      ).toBe(0);
      const digest = (JSON.parse(stablePreview.stdout) as { digest: string }).digest;

      bindHostSession({
        runtime,
        fixture,
        environment,
        id,
        transcript,
        guardArguments: `--pr 42 --yes --plan ${digest}`,
      });
      const applied = spawnSync('bun', [guard, '--pr', '42', '--yes', '--plan', digest], {
        cwd: fixture.topic,
        env: environment,
        encoding: 'utf8',
      });
      expect(applied.status, applied.stderr).toBe(0);
      expect((JSON.parse(applied.stdout) as { result: { applied: boolean } }).result.applied).toBe(
        true,
      );
      expect(existsSync(fixture.topic)).toBe(false);
      expect(
        spawnSync('git', ['show-ref', '--verify', 'refs/heads/feature/closeout'], {
          cwd: fixture.main,
        }).status,
      ).not.toBe(0);
      expect(
        runOrThrow(
          'git',
          ['for-each-ref', '--format=%(refname)', 'refs/heads/feature/closeout'],
          fixture.bare,
        ),
      ).toBe('');
    },
    30_000,
  );

  it('rejects a fresh Codex hook binding that conflicts with the authenticated current task', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const codexHome = nodePath.join(sandbox, 'codex-home');
    const bridgedId = 'codex-bridged-task';
    const authenticatedId = 'codex-authenticated-task';
    mkdirSync(nodePath.join(codexHome, 'sessions'), { recursive: true });
    const transcript = nodePath.join(codexHome, 'sessions', `rollout-${bridgedId}.jsonl`);
    writeFileSync(
      transcript,
      `${JSON.stringify({
        type: 'session_meta',
        payload: { id: bridgedId, cwd: fixture.topic },
      })}\n`,
    );
    const environment = codexHostEnvironment({
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CODEX_HOME: codexHome,
      CODEX_THREAD_ID: authenticatedId,
      CLAUDE_PROJECT_DIR: fixture.topic,
    });

    bindHostSession({
      runtime: 'codex',
      fixture,
      environment,
      id: bridgedId,
      transcript,
    });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );

    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
    const plan = (
      JSON.parse(preview.stdout) as {
        plan: { blockers: string[]; advisories: string[] };
      }
    ).plan;
    expect(plan.blockers).toEqual([]);
    expect(plan.advisories).toContain('the current host session binding is missing or expired');
    expect(existsSync(verificationReceiptPath(fixture))).toBe(true);
    expect(existsSync(fixture.topic)).toBe(true);
  }, 30_000);

  it('reuses one exact-head verification and retrospective snapshot from preview through apply', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture, false);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-closeout-snapshot';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    const counter = nodePath.join(sandbox, 'safeword-invocations.txt');
    const cli = nodePath.join(fixture.bin, 'counting-safeword.ts');
    writeFileSync(
      transcript,
      [
        JSON.stringify({ type: 'session_meta', sessionId: id, cwd: fixture.topic }),
        JSON.stringify({
          message: { role: 'user', content: [{ type: 'text', text: 'close this delivery' }] },
        }),
      ].join('\n'),
    );
    executable(
      cli,
      String.raw`#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
const counter = process.env.SAFEWORD_COUNTER;
if (!counter) process.exit(2);
const args = process.argv.slice(2);
appendFileSync(counter, JSON.stringify(args) + '\n');
if (args[0] === 'project' && args[1] === 'test-plan') {
  console.log(JSON.stringify([{ cwd: process.cwd(), command: 'true', available: true }]));
} else if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false } }));
} else process.exit(1);
`,
    );
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: cli,
      SAFEWORD_COUNTER: counter,
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    const guard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');

    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync('bun', [guard, '--pr', '42'], {
      cwd: fixture.topic,
      env: environment,
      encoding: 'utf8',
    });
    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
    const digest = (JSON.parse(preview.stdout) as { digest: string }).digest;
    const invocationSnapshot = readFileSync(counter, 'utf8');
    expect(invocationSnapshot).toContain('["project","test-plan"');
    expect(invocationSnapshot).toContain('["retro","run"');

    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const replay = spawnSync('bun', [guard, '--pr', '42'], {
      cwd: fixture.topic,
      env: environment,
      encoding: 'utf8',
    });
    expect(replay.status, `${replay.stderr}\n${replay.stdout}`).toBe(0);

    bindHostSession({
      runtime: 'claude',
      fixture,
      environment,
      id,
      transcript,
      guardArguments: `--pr 42 --yes --plan ${digest}`,
    });
    const applied = spawnSync('bun', [guard, '--pr', '42', '--yes', '--plan', digest], {
      cwd: fixture.topic,
      env: environment,
      encoding: 'utf8',
    });

    expect(applied.status, `${applied.stderr}\n${applied.stdout}`).toBe(0);
    expect(readFileSync(counter, 'utf8')).toBe(invocationSnapshot);
  }, 30_000);

  it.each([
    {
      state: 'the topic worktree is already absent',
      removeRemote: false,
      removeLocal: false,
      operations: ['delete-remote-ref', 'delete-local-ref'],
    },
    {
      state: 'the worktree and remote branch are already absent',
      removeRemote: true,
      removeLocal: false,
      operations: ['delete-local-ref'],
    },
    {
      state: 'every exact cleanup target is already absent',
      removeRemote: true,
      removeLocal: true,
      operations: [],
    },
  ])(
    'resumes from a surviving worktree when $state',
    testCase => {
      const fixture = deliveryFixture();
      installBoundaryFakes(fixture);
      const sandbox = nodePath.dirname(fixture.bare);
      const environment = {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
        GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
        SAFEWORD_TEST_BARE: fixture.bare,
        SAFEWORD_CLI: boundarySafewordCli(fixture),
      };
      const initialId = 'claude-closeout-before-interruption';
      const initialTranscript = nodePath.join(sandbox, `${initialId}.jsonl`);
      writeFileSync(
        initialTranscript,
        [
          JSON.stringify({ type: 'session_meta', sessionId: initialId, cwd: fixture.topic }),
          JSON.stringify({
            message: {
              role: 'user',
              content: [{ type: 'text', text: 'close this interrupted session' }],
            },
          }),
        ].join('\n'),
      );
      bindHostSession({
        runtime: 'claude',
        fixture,
        environment,
        id: initialId,
        transcript: initialTranscript,
      });
      const topicGuard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');
      const initialPreview = spawnSync('bun', [topicGuard, '--pr', '42'], {
        cwd: fixture.topic,
        env: { ...environment, CLAUDE_PROJECT_DIR: fixture.topic },
        encoding: 'utf8',
      });
      expect(initialPreview.status, `${initialPreview.stderr}\n${initialPreview.stdout}`).toBe(0);
      const receiptPath = verificationReceiptPath(fixture);
      expect(statSync(receiptPath).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(receiptPath, 'utf8'))).toMatchObject({
        version: 1,
        headOid: fixture.oid,
        stateHash: cleanStateHash(fixture.oid),
      });

      runOrThrow('git', ['worktree', 'remove', fixture.topic], fixture.main);
      if (testCase.removeRemote) {
        runOrThrow('git', ['push', 'origin', ':feature/closeout'], fixture.main, environment);
      }
      if (testCase.removeLocal) {
        runOrThrow(
          'git',
          ['update-ref', '-d', 'refs/heads/feature/closeout', fixture.oid],
          fixture.main,
        );
      }

      const resumedId = `claude-resume-${testCase.operations.length}`;
      const resumedTranscript = nodePath.join(sandbox, `${resumedId}.jsonl`);
      writeFileSync(
        resumedTranscript,
        [
          JSON.stringify({ type: 'session_meta', sessionId: resumedId, cwd: fixture.main }),
          JSON.stringify({
            message: {
              role: 'user',
              content: [{ type: 'text', text: 'resume the interrupted closeout' }],
            },
          }),
        ].join('\n'),
      );
      bindClaudeSessionAt({
        fixture,
        environment,
        cwd: fixture.main,
        id: resumedId,
        transcript: resumedTranscript,
        guardArguments: '--pr 42',
      });
      const mainGuard = nodePath.join(fixture.main, '.safeword/scripts/closeout-cleanup.ts');
      const preview = spawnSync('bun', [mainGuard, '--pr', '42'], {
        cwd: fixture.main,
        env: { ...environment, CLAUDE_PROJECT_DIR: fixture.main },
        encoding: 'utf8',
      });
      expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(0);
      const parsed = JSON.parse(preview.stdout) as {
        digest: string;
        plan: { blockers: string[]; operations: { kind: string }[] };
      };
      expect(parsed.plan.blockers).toEqual([]);
      expect(parsed.plan.operations.map(operation => operation.kind)).toEqual(testCase.operations);

      bindClaudeSessionAt({
        fixture,
        environment,
        cwd: fixture.main,
        id: resumedId,
        transcript: resumedTranscript,
        guardArguments: `--pr 42 --yes --plan ${parsed.digest}`,
      });
      const applied = spawnSync(
        'bun',
        [mainGuard, '--pr', '42', '--yes', '--plan', parsed.digest],
        {
          cwd: fixture.main,
          env: { ...environment, CLAUDE_PROJECT_DIR: fixture.main },
          encoding: 'utf8',
        },
      );
      expect(applied.status, `${applied.stderr}\n${applied.stdout}`).toBe(0);
      expect((JSON.parse(applied.stdout) as { result: { applied: boolean } }).result.applied).toBe(
        true,
      );
    },
    30_000,
  );

  it('rejects missing, malformed, stale, future, wrong-head, and invalid-hash receipts', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
    };
    runOrThrow('git', ['worktree', 'remove', fixture.topic], fixture.main);
    const receiptPath = verificationReceiptPath(fixture);
    mkdirSync(nodePath.dirname(receiptPath), { recursive: true });
    const valid = {
      version: 1,
      headOid: fixture.oid,
      stateHash: cleanStateHash(fixture.oid),
      recordedAt: new Date().toISOString(),
    };
    const invalidReceipts: [string, string | undefined][] = [
      ['missing', undefined],
      ['malformed JSON', '{'],
      ['wrong version', JSON.stringify({ ...valid, version: 2 })],
      ['wrong head', JSON.stringify({ ...valid, headOid: 'f'.repeat(40) })],
      [
        'expired timestamp',
        JSON.stringify({ ...valid, recordedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }),
      ],
      [
        'future timestamp',
        JSON.stringify({ ...valid, recordedAt: new Date(Date.now() + 60 * 1000) }),
      ],
      ['blank state hash', JSON.stringify({ ...valid, stateHash: '' })],
      ['whitespace state hash', JSON.stringify({ ...valid, stateHash: ' '.repeat(3) })],
      ['non-clean state hash', JSON.stringify({ ...valid, stateHash: 'a'.repeat(64) })],
    ];

    for (const [index, [name, content]] of invalidReceipts.entries()) {
      if (content === undefined) rmSync(receiptPath, { force: true });
      else writeFileSync(receiptPath, content);
      const id = `claude-invalid-receipt-${index}`;
      const transcript = nodePath.join(sandbox, `${id}.jsonl`);
      writeFileSync(
        transcript,
        [
          JSON.stringify({ type: 'session_meta', sessionId: id, cwd: fixture.main }),
          JSON.stringify({
            message: { role: 'user', content: [{ type: 'text', text: `resume: ${name}` }] },
          }),
        ].join('\n'),
      );
      bindClaudeSessionAt({
        fixture,
        environment,
        cwd: fixture.main,
        id,
        transcript,
        guardArguments: '--pr 42',
      });
      const preview = spawnSync(
        'bun',
        [nodePath.join(fixture.main, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
        {
          cwd: fixture.main,
          env: { ...environment, CLAUDE_PROJECT_DIR: fixture.main },
          encoding: 'utf8',
        },
      );
      expect(preview.status, name).toBe(2);
      const plan = (JSON.parse(preview.stdout) as { plan: { blockers: string[]; operations: [] } })
        .plan;
      expect(plan.blockers, name).toEqual(
        expect.arrayContaining(['local verification is stale', 'local verification failed']),
      );
      expect(plan.operations, name).toEqual([]);
    }
  }, 30_000);

  it('does not mint a reusable receipt for a dirty exact-head worktree', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-dirty-verification';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    writeFileSync(
      transcript,
      [
        JSON.stringify({ type: 'session_meta', sessionId: id, cwd: fixture.topic }),
        JSON.stringify({
          message: { role: 'user', content: [{ type: 'text', text: 'close dirty worktree' }] },
        }),
      ].join('\n'),
    );
    writeFileSync(nodePath.join(fixture.topic, 'uncommitted.txt'), 'dirty\n');
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );
    expect(preview.status).toBe(2);
    expect(existsSync(verificationReceiptPath(fixture))).toBe(false);
  }, 30_000);

  it('blocks every cleanup operation when durable receipt publication fails', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const id = 'claude-receipt-publication-failure';
    const transcript = nodePath.join(sandbox, `${id}.jsonl`);
    writeFileSync(
      transcript,
      [
        JSON.stringify({ type: 'session_meta', sessionId: id, cwd: fixture.topic }),
        JSON.stringify({
          message: { role: 'user', content: [{ type: 'text', text: 'close this delivery' }] },
        }),
      ].join('\n'),
    );
    const receiptDirectory = nodePath.dirname(verificationReceiptPath(fixture));
    blockChildren(receiptDirectory);
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    bindHostSession({ runtime: 'claude', fixture, environment, id, transcript });
    const preview = spawnSync(
      'bun',
      [nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      { cwd: fixture.topic, env: environment, encoding: 'utf8' },
    );
    expect(preview.status, `${preview.stderr}\n${preview.stdout}`).toBe(2);
    const plan = (
      JSON.parse(preview.stdout) as {
        plan: { blockers: string[]; operations: unknown[] };
      }
    ).plan;
    expect(plan.blockers).toContain('local verification failed');
    expect(plan.operations).toEqual([]);
    expect(existsSync(fixture.topic)).toBe(true);
  }, 30_000);

  it('invalidates an earlier receipt before a later exact-head verification fails', () => {
    const fixture = deliveryFixture();
    installBoundaryFakes(fixture);
    const sandbox = nodePath.dirname(fixture.bare);
    const environment = {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
      GIT_SSH_COMMAND: nodePath.join(fixture.bin, 'ssh'),
      SAFEWORD_TEST_BARE: fixture.bare,
      SAFEWORD_CLI: boundarySafewordCli(fixture),
      CLAUDE_PROJECT_DIR: fixture.topic,
    };
    const transcriptFor = (id: string, cwd: string): string => {
      const transcript = nodePath.join(sandbox, `${id}.jsonl`);
      writeFileSync(
        transcript,
        [
          JSON.stringify({ type: 'session_meta', sessionId: id, cwd }),
          JSON.stringify({
            message: { role: 'user', content: [{ type: 'text', text: 'resume closeout' }] },
          }),
        ].join('\n'),
      );
      return transcript;
    };
    const firstId = 'claude-receipt-success';
    const topicGuard = nodePath.join(fixture.topic, '.safeword/scripts/closeout-cleanup.ts');
    bindHostSession({
      runtime: 'claude',
      fixture,
      environment,
      id: firstId,
      transcript: transcriptFor(firstId, fixture.topic),
    });
    expect(
      spawnSync('bun', [topicGuard, '--pr', '42'], {
        cwd: fixture.topic,
        env: environment,
        encoding: 'utf8',
      }).status,
    ).toBe(0);
    expect(existsSync(verificationReceiptPath(fixture))).toBe(true);

    // A cached receipt is only reusable for the exact clean state it covered.
    // Make the later invocation meaningfully different so it must re-run its plan.
    const dirtyPath = nodePath.join(fixture.topic, 'uncommitted-closeout-change.txt');
    writeFileSync(dirtyPath, 'requires a new verification\n');

    const failingCli = nodePath.join(fixture.bin, 'failing-safeword.ts');
    executable(
      failingCli,
      `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args[0] === 'project' && args[1] === 'test-plan') {
  console.log(JSON.stringify([{ cwd: process.cwd(), command: 'exit 1', available: true }]));
} else if (args[0] === 'retro' && args[1] === 'run') {
  console.log(JSON.stringify({ state: 'healthy', data: { agent_filing_needed: false }, errors: [] }));
} else process.exit(1);
`,
    );
    const failingEnvironment = { ...environment, SAFEWORD_CLI: failingCli };
    const failedId = 'claude-receipt-later-failure';
    bindHostSession({
      runtime: 'claude',
      fixture,
      environment: failingEnvironment,
      id: failedId,
      transcript: transcriptFor(failedId, fixture.topic),
    });
    expect(
      spawnSync('bun', [topicGuard, '--pr', '42'], {
        cwd: fixture.topic,
        env: failingEnvironment,
        encoding: 'utf8',
      }).status,
    ).toBe(2);
    expect(existsSync(verificationReceiptPath(fixture))).toBe(false);

    rmSync(dirtyPath, { force: true });
    runOrThrow('git', ['worktree', 'remove', fixture.topic], fixture.main);
    const resumedId = 'claude-receipt-after-failure';
    const resumedTranscript = transcriptFor(resumedId, fixture.main);
    bindClaudeSessionAt({
      fixture,
      environment,
      cwd: fixture.main,
      id: resumedId,
      transcript: resumedTranscript,
      guardArguments: '--pr 42',
    });
    const resumed = spawnSync(
      'bun',
      [nodePath.join(fixture.main, '.safeword/scripts/closeout-cleanup.ts'), '--pr', '42'],
      {
        cwd: fixture.main,
        env: { ...environment, CLAUDE_PROJECT_DIR: fixture.main },
        encoding: 'utf8',
      },
    );
    expect(resumed.status).toBe(2);
    expect((JSON.parse(resumed.stdout) as { plan: { blockers: string[] } }).plan.blockers).toEqual(
      expect.arrayContaining(['local verification is stale', 'local verification failed']),
    );
  }, 30_000);

  it('packages the closeout workflow and its runtime dependencies in the native Claude plugin', () => {
    const assets = generateClaudePluginAssets({
      cliBundle: 'export {};\n',
      sourceRoot: nodePath.join(repoRoot, 'packages/cli/src'),
      templatesRoot: nodePath.join(repoRoot, 'packages/cli/templates'),
      version: '0.0.0',
    });
    const byPath = new Map(assets.map(asset => [asset.relativePath, asset.content]));

    expect(byPath.get('skills/closeout/SKILL.md')).toContain(
      '"${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts',
    );
    expect(byPath.get('resources/scripts/closeout-cleanup.ts')).toContain(
      "from '../../runtime/hooks/lib/closeout-binding.ts'",
    );
    expect(byPath.get('resources/scripts/closeout-cleanup.ts')).toContain(
      "from '../../runtime/hooks/lib/retro-draft-spool.ts'",
    );
    expect(byPath.has('runtime/hooks/lib/closeout-binding.ts')).toBe(true);
    expect(byPath.has('runtime/hooks/lib/retro-draft-spool.ts')).toBe(true);

    const pluginRoot = createTemporaryDirectory();
    try {
      for (const asset of assets) {
        const target = nodePath.join(pluginRoot, asset.relativePath);
        mkdirSync(nodePath.dirname(target), { recursive: true });
        writeFileSync(target, asset.content);
      }
      const projectRoot = createTemporaryDirectory();
      temporaryProjects.push(projectRoot);
      const execution = spawnSync(
        'bun',
        [
          '-e',
          `import { safewordCliCommand } from './resources/scripts/closeout-cleanup.ts'; console.log(JSON.stringify(safewordCliCommand(${JSON.stringify(projectRoot)})));`,
        ],
        {
          cwd: pluginRoot,
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
          encoding: 'utf8',
        },
      );

      expect(execution.status, execution.stderr).toBe(0);
      expect(JSON.parse(execution.stdout)).toEqual([
        'bun',
        nodePath.join(pluginRoot, 'runtime/cli.js'),
      ]);

      const bindingExecution = spawnSync(
        'bun',
        [
          '-e',
          `import { commandInvokesCloseoutCleanup } from './runtime/hooks/lib/closeout-binding.ts'; console.log(commandInvokesCloseoutCleanup('bun "\${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts --pr 42'));`,
        ],
        {
          cwd: pluginRoot,
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
          encoding: 'utf8',
        },
      );
      expect(bindingExecution.status, bindingExecution.stderr).toBe(0);
      expect(bindingExecution.stdout.trim()).toBe('true');
    } finally {
      removeTemporaryDirectory(pluginRoot);
    }
  });

  it.each(['installed', 'upgraded'] as const)(
    '%s Safeword resolves project-host entry points to the shared guard',
    async change => {
      const directory = createTemporaryDirectory();
      try {
        createTypeScriptPackageJson(directory);
        initGitRepo(directory);
        await setupOrThrow(directory, ['setup', '--yes', '--agents', 'cursor'], {
          env: INSTALL_DEPENDENCIES_ENV,
        });
        if (change === 'upgraded') {
          await setupOrThrow(directory, ['setup', '--yes', '--agents', 'cursor'], {
            env: INSTALL_DEPENDENCIES_ENV,
          });
        }

        const cursorCommand = readFileSync(
          nodePath.join(directory, '.cursor/commands/closeout.md'),
          'utf8',
        );
        const cursorSharedSkill = readFileSync(
          nodePath.join(directory, '.safeword/skills/closeout/SKILL.md'),
          'utf8',
        );
        const installedGuard = nodePath.join(directory, '.safeword/scripts/closeout-cleanup.ts');
        const codexProfile = nodePath.join(directory, 'codex-profile/plugins/cache/safeword/0.0.0');
        const canonicalSkills = nodePath.join(repoRoot, 'packages/cli/templates/skills');
        for (const asset of generateCodexPluginAssets(canonicalSkills, VERSION)) {
          const target = nodePath.join(codexProfile, asset.relativePath);
          mkdirSync(nodePath.dirname(target), { recursive: true });
          writeFileSync(target, asset.content);
        }
        const codexSkill = readFileSync(
          nodePath.join(codexProfile, 'skills/closeout/SKILL.md'),
          'utf8',
        );

        expect(cursorCommand).toContain('.safeword/skills/closeout/SKILL.md');
        expect(cursorSharedSkill).toContain('bun .safeword/scripts/closeout-cleanup.ts');
        expect(codexSkill).toContain('project runtime closeout-cleanup');
        expect(codexSkill).not.toContain('.safeword/scripts/closeout-cleanup.ts');
        expect(readFileSync(installedGuard, 'utf8')).toContain('executeCleanupOperation');
        const nominatedCodexHome = nodePath.join(directory, 'caller-codex-home');
        const nominatedTranscript = nodePath.join(
          nominatedCodexHome,
          'sessions',
          'rollout-caller-thread.jsonl',
        );
        mkdirSync(nodePath.dirname(nominatedTranscript), { recursive: true });
        writeFileSync(
          nominatedTranscript,
          `${JSON.stringify({ type: 'session_meta', payload: { id: 'caller-thread' } })}\n`,
        );
        const execution = spawnSync('bun', [installedGuard, '--pr', '42'], {
          cwd: directory,
          env: codexHostEnvironment({
            ...process.env,
            CODEX_HOME: nominatedCodexHome,
            CODEX_THREAD_ID: 'caller-thread',
          }),
          encoding: 'utf8',
        });
        expect(execution.status).toBe(2);
        expect(execution.stderr).not.toContain('a fresh host session binding are required');
        expect(execution.stdout).toContain('"blockers"');
      } finally {
        removeTemporaryDirectory(directory);
      }
    },
    60_000,
  );

  it('binds the exact Claude session and transcript through the shipped pre-tool hook', () => {
    const directory = project();
    const transcript = nodePath.join(directory, 'claude.jsonl');
    const result = spawnSync(
      'bun',
      [nodePath.join(repoRoot, 'packages/cli/templates/hooks/pre-tool-quality.ts')],
      {
        cwd: directory,
        env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
        input: JSON.stringify({
          session_id: 'claude-closeout-42',
          transcript_path: transcript,
          tool_name: 'Bash',
          tool_input: { command: closeoutCommand(directory) },
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'claude',
      id: 'claude-closeout-42',
      projectRoot: realpathSync(directory),
      transcriptPath: transcript,
    });
  });

  it('binds the exact Codex session through the shipped pre-tool hook', () => {
    const directory = project();
    const result = spawnSync(process.execPath, [testCliPath, 'hook', 'codex', 'pre-tool-use'], {
      cwd: directory,
      input: JSON.stringify({
        session_id: 'codex-closeout-42',
        tool_name: 'Bash',
        tool_input: { command: closeoutCommand(directory) },
      }),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'codex',
      id: 'codex-closeout-42',
      projectRoot: realpathSync(directory),
    });
  });

  it('binds the exact Cursor conversation and transcript through the shipped shell hook', () => {
    const directory = project();
    const transcript = nodePath.join(directory, 'cursor.jsonl');
    const result = spawnSync(
      'bun',
      [nodePath.join(repoRoot, 'packages/cli/templates/hooks/cursor/before-shell-execution.ts')],
      {
        cwd: directory,
        input: JSON.stringify({
          workspace_roots: [directory],
          conversation_id: 'cursor-closeout-42',
          transcript_path: transcript,
          command: closeoutCommand(directory),
        }),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ permission: 'allow' });
    expect(readFreshCloseoutBinding({ projectDirectory: directory })).toEqual({
      runtime: 'cursor',
      id: 'cursor-closeout-42',
      projectRoot: realpathSync(directory),
      transcriptPath: transcript,
    });
  });
});
