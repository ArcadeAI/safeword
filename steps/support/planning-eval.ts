import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After } from '@cucumber/cucumber';

import { planningContractCases } from '../../packages/cli/tests/fixtures/planning-contracts-eval.js';
import type { SafewordWorld } from '../world.js';

const root = path.resolve(import.meta.dirname, '../..');
const hostClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

interface EvalRun {
  reviewer: { verdict: string; findings: string[]; scope_expanded: boolean };
  judge: { correct: boolean };
}

interface EvalReport {
  selected_case: string;
  complete: boolean;
  results: { case_id: string; status: string; runs: EvalRun[] }[];
}

interface EvalState {
  caseId: string;
  reportDirectory: string;
  reportPath: string;
  output?: ReturnType<typeof spawnSync>;
  report?: EvalReport;
}

const states = new WeakMap<SafewordWorld, EvalState>();

export function selectPlanningEval(world: SafewordWorld, caseId: string) {
  const evaluationCase = planningContractCases.find(item => item.id === caseId);
  assert.ok(evaluationCase, `Missing judged case ${caseId}`);
  const reportDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-planning-eval-'));
  states.set(world, {
    caseId,
    reportDirectory,
    reportPath: path.join(reportDirectory, 'result.json'),
  });
  return evaluationCase;
}

export function selectedPlanningEval(world: SafewordWorld) {
  const state = states.get(world);
  assert.ok(state, 'A judged evaluation case must be selected first.');
  const evaluationCase = planningContractCases.find(item => item.id === state.caseId);
  assert.ok(evaluationCase);
  return evaluationCase;
}

export function runPlanningEval(world: SafewordWorld): void {
  const state = states.get(world);
  assert.ok(state, 'A judged evaluation case must be selected first.');
  const environment: NodeJS.ProcessEnv = {
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
}

export function assertPlanningEval(
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
    `Only ${matching.length}/3 judged runs supported ${state.caseId}.`,
  );
}

After(function (this: SafewordWorld) {
  const state = states.get(this);
  if (state) rmSync(state.reportDirectory, { recursive: true, force: true });
  states.delete(this);
});
