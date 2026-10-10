import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { After, Given, Status, Then, When } from '@cucumber/cucumber';

import { planningJudgePrompt } from '../packages/cli/scripts/lib/planning-contracts-eval.js';
import { callClaude } from '../packages/cli/scripts/lib/planning-eval-provider.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';
import type { ReviewerOutput } from '../packages/cli/src/review/contract.js';
import { runCliWithLiteralArguments } from '../packages/cli/tests/helpers.js';
import { planningContractCases } from '../packages/cli/tests/fixtures/planning-contracts-eval.js';
import {
  completeNativeScopeProject,
  createScopeContextProject,
} from './support/planning-scope-project.js';
import type { SafewordWorld } from './world.js';

const hostClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const hostCodexHome = process.env.CODEX_HOME;
const folder = 'CTX123-current-context';
const states = new WeakMap<SafewordWorld, NativeScopeState>();

interface NativeScopeState {
  roots: string[];
  project: ReturnType<typeof createScopeContextProject>;
  caseId: string;
  runs: { output: ReviewerOutput; correct: boolean; gate: string; stampStatus: number | null }[];
}

function environment(root: string): Record<string, string> {
  return {
    NODE_ENV: 'test',
    XDG_STATE_HOME: path.join(root, '.review-keys'),
    CLAUDE_PROJECT_DIR: root,
    // The author/session boundary is the only simulated collaborator. The
    // coordinator launches a real, independently qualified Sol reviewer.
    SAFEWORD_AGENT_RUNTIME: 'claude',
    SAFEWORD_AUTHOR_MODEL: 'claude-opus-5',
    SAFEWORD_NO_UPDATE_CHECK: '1',
    PATH: process.env.PATH ?? '',
    ...(hostClaudeConfigDir === undefined ? {} : { CLAUDE_CONFIG_DIR: hostClaudeConfigDir }),
  };
}

function dispatch(root: string): string {
  const settings = JSON.parse(readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
  const command = settings.hooks.PreToolUse.flatMap(
    (group: { hooks: { command: string }[] }) => group.hooks,
  ).find((hook: { command: string }) => hook.command.includes('pre-tool-quality.ts')).command;
  const result = spawnSync('/bin/sh', ['-c', command], {
    cwd: root,
    env: { ...process.env, ...environment(root) },
    encoding: 'utf8',
    timeout: 60_000,
    input: JSON.stringify({
      cwd: root,
      session_id: 'r12-native-scope',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(root, '.project/tickets', folder, 'ticket.md'),
        old_string: 'phase: plan-implementation',
        new_string: 'phase: plan-execution',
      },
    }),
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

Given(
  /^an Implementation Plan in the installed Claude Code workflow has a review packet that (contains every binding scope source|omits the project non-goals)$/u,
  async function (this: SafewordWorld, context: string) {
    const roots: string[] = [];
    const caseId =
      context === 'contains every binding scope source'
        ? 'r12-complete-scope-context'
        : 'r12-missing-project-non-goals';
    const project = createScopeContextProject(caseId, roots);
    states.set(this, { roots, project, caseId, runs: [] });
    const installed = await runCliWithLiteralArguments(
      ['install', '--agents', 'cursor', '--offline', '--no-input', '--json', '--cwd', project.root],
      { cwd: project.root, env: environment(project.root) },
    );
    assert.equal(installed.exitCode, 0, installed.stdout + installed.stderr);
    mkdirSync(path.join(project.root, '.claude'), { recursive: true });
    writeFileSync(
      path.join(project.root, '.claude/settings.json'),
      JSON.stringify(SAFEWORD_SCHEMA.jsonMerges['.claude/settings.json'].merge({})),
    );
    const configPath = path.join(project.root, '.safeword/config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.crossAgentReviewRoutes = { claude: [{ reviewer: 'codex', model: 'gpt-6.1-sol' }] };
    writeFileSync(configPath, JSON.stringify(config));
    completeNativeScopeProject(project);
    assert.match(dispatch(project.root), /deny/u);
  },
);

When(
  'actual lifecycle dispatch from installed local project hooks runs its judged Implementation Plan review with real configuration and collaborators, mocking only non-reviewer process boundaries',
  { timeout: 240_000 },
  async function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    const { project } = state;
    const original = readFileSync(path.join(project.root, project.planPath), 'utf8');
    const evaluationCase = planningContractCases.find(item => item.id === state.caseId);
    assert.ok(evaluationCase);
    const judgeCase = { ...evaluationCase, ...project.input };
    const judgeEnvironment = { ...process.env };
    if (hostClaudeConfigDir === undefined) delete judgeEnvironment.CLAUDE_CONFIG_DIR;
    else judgeEnvironment.CLAUDE_CONFIG_DIR = hostClaudeConfigDir;
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: { correct: { type: 'boolean' }, reason: { type: 'string' } },
      required: ['correct', 'reason'],
    };
    const calibration = callClaude(
      'claude-sonnet-5',
      planningJudgePrompt(
        judgeCase,
        {
          verdict: evaluationCase.expected_verdict === 'approve' ? 'request_changes' : 'approve',
          summary: 'Require automatic migration outside accepted scope.',
          findings: ['Require automatic migration.'],
        },
        'codex',
      ),
      schema,
      judgeEnvironment,
    ) as { correct: boolean };
    assert.equal(calibration.correct, false, 'The judge must reject known-bad output.');
    for (let index = 0; index < 3; index++) {
      const result = await runCliWithLiteralArguments(
        [
          'review',
          'run',
          'plan-implementation',
          project.planPath,
          '--json',
          '--no-input',
          '--cwd',
          project.root,
        ],
        {
          cwd: project.root,
          env: {
            ...environment(project.root),
            ...(hostCodexHome === undefined ? {} : { CODEX_HOME: hostCodexHome }),
          },
          unsetEnv: [
            ...(hostClaudeConfigDir === undefined ? ['CLAUDE_CONFIG_DIR'] : []),
            ...(hostCodexHome === undefined ? ['CODEX_HOME'] : []),
          ],
          timeout: 120_000,
        },
      );
      const data = JSON.parse(result.stdout).data;
      assert.ok(data.reviewer_output, result.stdout + result.stderr);
      assert.equal(data.actual_reviewer, 'codex');
      assert.equal(data.reviewer_model, 'gpt-6.1-sol');
      assert.deepEqual(data.confirmed_reviewer_model, { provider: 'openai', model: 'gpt-6.1-sol' });
      assert.equal(data.independence, 'cross-agent');
      const grade = callClaude(
        'claude-sonnet-5',
        planningJudgePrompt(judgeCase, data.reviewer_output, 'codex'),
        schema,
        judgeEnvironment,
      ) as { correct: boolean; reason: string };
      assert.equal(typeof grade.correct, 'boolean');
      assert.equal(typeof grade.reason, 'string');
      const stamped = spawnSync(
        'bun',
        [
          path.join(project.root, '.safeword/hooks/write-review-stamp.ts'),
          '--ticket',
          folder,
          '--phase',
          'plan-implementation',
          '--review-id',
          data.review_id,
          '--author-agent',
          data.author_agent,
          '--reviewer-agent',
          data.actual_reviewer,
          '--independence',
          data.independence,
        ],
        {
          cwd: project.root,
          env: { ...process.env, ...environment(project.root) },
          encoding: 'utf8',
          timeout: 60_000,
        },
      );
      assert.equal(stamped.error, undefined, stamped.error?.message);
      state.runs.push({
        output: data.reviewer_output,
        correct: grade.correct,
        gate: dispatch(project.root),
        stampStatus: stamped.status,
      });
      assert.equal(readFileSync(path.join(project.root, project.planPath), 'utf8'), original);
    }
  },
);

Then('Implementation Plan review dispatch proceeds', function (this: SafewordWorld) {
  const state = states.get(this);
  assert.ok(state);
  assert.ok(
    state.runs.filter(
      run =>
        run.correct && run.output.verdict === 'approve' && run.output.reviewer_agent === 'codex',
    ).length >= 2,
    JSON.stringify(state.runs),
  );
});

Then(
  'Implementation Plan approval remains blocked with the missing project boundary named',
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state);
    assert.ok(
      state.runs.filter(
        run =>
          run.correct &&
          run.output.verdict === 'request_changes' &&
          run.stampStatus !== 0 &&
          /deny/u.test(run.gate) &&
          run.output.findings.some(finding => /project non.goals?/iu.test(finding.message)),
      ).length >= 2,
      JSON.stringify(state.runs),
    );
  },
);

After(function (this: SafewordWorld, { result }) {
  const state = states.get(this);
  if (state && result?.status === Status.FAILED)
    console.error(`Native scope diagnostic fixture retained: ${state.project.root}`);
  else if (state) for (const root of state.roots) rmSync(root, { recursive: true, force: true });
  states.delete(this);
});
