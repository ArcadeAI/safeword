// Actual source hook entrypoints with simulated test-plan/acceptance prerequisites.
// This fixture is never an installed-host qualification or live acceptance receipt.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { getDependencyReadiness } from '../../templates/hooks/lib/dependency-readiness.js';
import { fixtureGit, simulatedRecoveryFixture } from '../review/ledger-recovery-fixture.js';

const fixtures: Awaited<ReturnType<typeof simulatedRecoveryFixture>>[] = [];
const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const hooks = nodePath.join(repo, 'packages/cli/templates/hooks');
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  vi.unstubAllEnvs();
});

it('routes honest recovery through Cursor closing, Codex Stop and Claude Stop while OpenCode stays blocked', async () => {
  const fixture = await simulatedRecoveryFixture(root => {
    // Model completed plan reconciliation before signing this simulated candidate.
    const plan = '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/impl-plan.md';
    const absolute = nodePath.join(root, plan);
    const content = readFileSync(absolute, 'utf8');
    if (!content.includes('**Status:** planned')) return;
    writeFileSync(absolute, content.replace('**Status:** planned', '**Status:** implemented'));
    fixtureGit(root, ['add', plan]);
    fixtureGit(root, [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Simulate the completed plan prerequisite',
    ]);
  });
  fixtures.push(fixture);
  const installation = spawnSync('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: fixture.root,
    env: process.env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  expect(installation.status, installation.stdout + installation.stderr).toBe(0);
  expect(getDependencyReadiness(fixture.root).status).toBe('ready');
  const ticket = nodePath.join(
    fixture.root,
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/ticket.md',
  );
  const original = readFileSync(ticket, 'utf8');
  const closing = original.replace(/^phase: implement$/m, 'phase: done');
  expect(closing).not.toBe(original);
  const verify = nodePath.join(nodePath.dirname(ticket), 'verify.md');
  writeFileSync(verify, '# Simulated prerequisite\n\n**PR Scope:** ✅ Diff matches ticket scope\n');
  // Same explicit test-plan stub convention as existing native done-gate fixtures.
  const testPlan = nodePath.join(nodePath.dirname(fixture.root), 'simulated-test-plan.mjs');
  writeFileSync(
    testPlan,
    `process.stdout.write(JSON.stringify({schema_version:1,data:{plan:[{language:'javascript',cwd:${JSON.stringify(fixture.root)},command:'node -e "process.exit(0)"',runner:'node',available:true}]}}));`,
  );
  const environment = {
    ...process.env,
    CLAUDE_PROJECT_DIR: fixture.root,
    SAFEWORD_CLI: testPlan,
    SAFEWORD_PLUGIN_CLI: nodePath.join(repo, 'packages/cli/dist/cli.js'),
    SAFEWORD_RETRO_CHILD: '1',
  };
  const run = (hook: string, payload: unknown, host?: string) =>
    spawnSync('bun', [nodePath.join(hooks, hook)], {
      cwd: fixture.root,
      input: JSON.stringify(payload),
      env: {
        ...environment,
        SAFEWORD_AGENT_RUNTIME: host,
        SAFEWORD_CODEX_DENY_MODE: host === 'opencode' ? 'exit-code' : undefined,
      },
      encoding: 'utf8',
      timeout: 60_000,
    });
  const jobPath = nodePath.join(fixture.root, '.safeword/state/reviews', `${fixture.id}.json`);
  const job = readFileSync(jobPath, 'utf8');
  const ledger = nodePath.join(nodePath.dirname(ticket), 'test-definitions.md');
  const ledgerBytes = readFileSync(ledger, 'utf8');
  const cursorPayload = {
    conversation_id: 'simulated-recovery-cursor',
    tool_name: 'Write',
    tool_input: {
      file_path: ticket,
      content: closing.replace(/^status: in_progress$/m, 'status: done'),
    },
    workspace_roots: [fixture.root],
  };
  const cursor = run('cursor/pre-tool-quality.ts', cursorPayload);
  expect(cursor.status, cursor.stdout + cursor.stderr).toBe(0);
  expect(
    JSON.parse(cursor.stdout).permission,
    `Cursor must accept authenticated recovery: ${cursor.stdout}${cursor.stderr}`,
  ).toBe('allow');
  writeFileSync(jobPath, '{}');
  const deniedCursor = run('cursor/pre-tool-quality.ts', cursorPayload);
  expect(deniedCursor.status).toBe(0);
  expect(JSON.parse(deniedCursor.stdout).permission).toBe('deny');
  writeFileSync(jobPath, job);

  writeFileSync(ticket, closing);
  const codexSession = 'simulated-recovery-codex';
  writeFileSync(
    nodePath.join(fixture.root, `.project/quality-state-codex-${codexSession}.json`),
    JSON.stringify({
      locSinceCommit: 0,
      lastCommitHash: '',
      activeTicket: '5F5ZZA',
      recentFailures: [],
      incrementedPatterns: [],
    }),
  );
  const codexPayload = { session_id: codexSession, cwd: fixture.root };
  writeFileSync(jobPath, '{}');
  const deniedCodex = run('codex/stop.ts', codexPayload, 'codex');
  expect(deniedCodex.status).toBe(0);
  expect(JSON.parse(deniedCodex.stdout).decision).toBe('block');
  expect(readFileSync(ticket, 'utf8')).toMatch(/^status: in_progress$/m);
  writeFileSync(jobPath, job);
  const codex = run('codex/stop.ts', codexPayload, 'codex');
  expect(codex.status, codex.stdout + codex.stderr).toBe(0);
  expect(readFileSync(ticket, 'utf8'), codex.stdout + codex.stderr).toMatch(/^status: done$/m);

  writeFileSync(ticket, closing);
  const claudeSession = 'simulated-recovery-claude';
  writeFileSync(
    nodePath.join(fixture.root, `.project/quality-state-${claudeSession}.json`),
    JSON.stringify({
      locSinceCommit: 0,
      lastCommitHash: '',
      activeTicket: '5F5ZZA',
      recentFailures: [],
      incrementedPatterns: [],
    }),
  );
  for (const skill of ['verify', 'audit', 'quality-review']) {
    const recorded = spawnSync(
      'bun',
      [nodePath.join(hooks, 'record-skill-invocation.ts'), fixture.root, skill, claudeSession],
      { cwd: fixture.root, env: environment, encoding: 'utf8', timeout: 10_000 },
    );
    expect(recorded.status, recorded.stdout + recorded.stderr).toBe(0);
  }
  const transcript = nodePath.join(
    nodePath.dirname(fixture.root),
    'simulated-recovery-transcript.jsonl',
  );
  writeFileSync(
    transcript,
    `${JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'done' },
          { type: 'tool_use', name: 'Edit' },
        ],
      },
    })}\n`,
  );
  const claudePayload = {
    session_id: claudeSession,
    transcript_path: transcript,
    stop_hook_active: false,
  };
  writeFileSync(jobPath, '{}');
  const deniedClaude = run('stop-quality.ts', claudePayload, 'claude');
  expect(deniedClaude.status).toBe(0);
  expect(JSON.parse(deniedClaude.stdout).decision).toBe('block');
  expect(JSON.parse(deniedClaude.stdout).reason).toContain('Not all scenarios are complete');
  writeFileSync(jobPath, job);
  const currentGate = spawnSync(
    process.execPath,
    [
      nodePath.join(repo, 'packages/cli/dist/cli.js'),
      '--json',
      '--no-input',
      '--cwd',
      fixture.root,
      'review',
      'gate',
      'ledger-recovery',
      '--ticket',
      '5F5ZZA',
    ],
    { env: environment, encoding: 'utf8', timeout: 30_000 },
  );
  expect(
    currentGate.status,
    currentGate.stdout + currentGate.stderr + fixtureGit(fixture.root, ['status', '--short']),
  ).toBe(0);
  const claude = run('stop-quality.ts', claudePayload, 'claude');
  expect(claude.status, claude.stdout + claude.stderr).toBe(0);
  expect(
    readFileSync(ticket, 'utf8'),
    `Claude must accept both current completion and the sole historical erratum: ${claude.stdout}${claude.stderr}`,
  ).toMatch(/^status: done$/m);

  const opencodePayload = {
    session_id: 'simulated-recovery-opencode',
    tool_name: 'Write',
    tool_input: {
      file_path: ticket,
      content: closing.replace(/^status: in_progress$/m, 'status: done'),
    },
  };
  const opencode = run('codex/pre-tool-quality.ts', opencodePayload, 'opencode');
  expect(opencode.status, opencode.stdout + opencode.stderr).toBe(3);
  expect(opencode.stderr).toContain('Not all scenarios are complete');
  expect(readFileSync(ledger, 'utf8')).toBe(ledgerBytes);
}, 180_000);
