import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import {
  admitThroughInstalledCli,
  featureFixture,
  installedReviewCli,
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

Given(
  /^a planning phase on (Claude Code|OpenAI Codex|Cursor) has an approving receipt invalidated by a changed accepted scenario$/,
  { timeout: 120_000 },
  async function (this: SafewordWorld, host: string) {
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

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) {
    rmSync(state.root, { recursive: true, force: true });
    cleanupTrustedReviewerDirectories();
  }
  states.delete(this);
});
