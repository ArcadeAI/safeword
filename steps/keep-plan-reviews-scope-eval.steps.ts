import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { planningContractCases } from '../packages/cli/tests/fixtures/planning-contracts-eval.js';
import type { SafewordWorld } from './world.js';

const root = path.resolve(import.meta.dirname, '..');
const hostClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const cases = {
  'omits authorization behavior': 'r13-in-scope-omission',
  'includes automatic account migration': 'r13-out-of-scope-addition',
  'decides authorization and excludes account migration': 'r13-conforming-boundary',
} as const;

interface EvalRun {
  reviewer: { verdict: string; findings: string[]; scope_expanded: boolean };
  judge: { correct: boolean };
}

interface EvalReport {
  selected_case: string;
  complete: boolean;
  results: { case_id: string; status: string; runs: EvalRun[] }[];
}

interface ScopeState {
  caseId: string;
  reportDirectory: string;
  reportPath: string;
  output?: ReturnType<typeof spawnSync>;
  report?: EvalReport;
}

const states = new WeakMap<SafewordWorld, ScopeState>();

Given(
  /^an accepted boundary requires authorization and excludes automatic account migration and the plan (.+)$/,
  function (this: SafewordWorld, planState: keyof typeof cases) {
    const caseId = cases[planState];
    assert.ok(caseId, `Unknown R13 plan state: ${planState}`);
    const evaluationCase = planningContractCases.find(item => item.id === caseId);
    assert.ok(evaluationCase, `Missing judged case ${caseId}`);
    assert.match(evaluationCase.accepted_boundary, /explicit user authorization/u);
    assert.match(evaluationCase.accepted_boundary, /no automatic account migration/u);
    const reportDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-r13-eval-'));
    states.set(this, {
      caseId,
      reportDirectory,
      reportPath: path.join(reportDirectory, 'result.json'),
    });
  },
);

When(
  'a judged semantic reviewer evaluation applies the canonical bidirectional scope-completeness rubric to the plan',
  { timeout: 240_000 },
  function (this: SafewordWorld) {
    const state = states.get(this);
    assert.ok(state, 'The R13 case must be selected first.');
    const environment = {
      ...process.env,
      SAFEWORD_PLANNING_EVAL_CASE: state.caseId,
      SAFEWORD_PLANNING_EVAL_OUTPUT: state.reportPath,
    };
    delete environment.NODE_OPTIONS;
    if (hostClaudeConfigDir === undefined) delete environment.CLAUDE_CONFIG_DIR;
    else environment.CLAUDE_CONFIG_DIR = hostClaudeConfigDir;
    state.output = spawnSync(
      'scripts/dev',
      ['bun', 'packages/cli/scripts/planning-contracts-eval.ts'],
      {
        cwd: root,
        env: environment,
        encoding: 'utf8',
        timeout: 210_000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (state.output.status === 0)
      state.report = JSON.parse(readFileSync(state.reportPath, 'utf8')) as EvalReport;
  },
);

function assertJudgedResult(
  world: SafewordWorld,
  verdict: 'approve' | 'request_changes',
  requiredFinding?: RegExp,
): void {
  const state = states.get(world);
  assert.ok(state?.output, 'The judged evaluation must run first.');
  assert.equal(
    state.output.status,
    0,
    `Judged evaluation failed: ${state.output.error?.message ?? state.output.stderr}`,
  );
  const report = state.report;
  assert.ok(report?.complete && report.selected_case === state.caseId);
  assert.equal(report.results.length, 1);
  const result = report.results[0];
  assert.equal(result?.case_id, state.caseId);
  assert.equal(result.status, 'pass');
  const matching = result.runs.filter(
    run =>
      run.reviewer.verdict === verdict &&
      !run.reviewer.scope_expanded &&
      run.judge.correct &&
      (requiredFinding === undefined || requiredFinding.test(run.reviewer.findings.join(' '))),
  );
  assert.ok(
    matching.length >= 2,
    `Only ${matching.length}/3 judged runs supported the R13 result.`,
  );
}

Then('approval is blocked with the in-scope omission named', function (this: SafewordWorld) {
  assertJudgedResult(this, 'request_changes', /authoriz/iu);
});

Then('approval is blocked with the out-of-scope proposal named', function (this: SafewordWorld) {
  assertJudgedResult(this, 'request_changes', /automatic.{0,20}migrat/iu);
});

Then('scope completeness does not block approval', function (this: SafewordWorld) {
  assertJudgedResult(this, 'approve');
});

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) rmSync(state.reportDirectory, { recursive: true, force: true });
  states.delete(this);
});
