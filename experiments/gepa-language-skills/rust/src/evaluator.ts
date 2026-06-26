import type { OracleKind, RustTask } from './dataset';

export type RustModelFamily = 'claude-opus' | 'gpt-codex';

export interface RustCommandResult {
  kind: OracleKind;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  required?: boolean;
}

export interface RustSecondaryMetrics {
  diffLines: number;
  durationMs: number;
  lintWarnings: number;
  testQuality: number;
}

export interface RustEvaluationTimings {
  totalMs: number;
  commandMs: number;
}

export interface RustTaskRun {
  task: RustTask;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  agentTrace: string;
  patchSummary: string;
  commandResults: RustCommandResult[];
  timings: RustEvaluationTimings;
  diagnostics: string[];
  secondaryMetrics: RustSecondaryMetrics;
}

export interface RustScoreBreakdown {
  correctness: number;
  diffSize: number;
  speed: number;
  lint: number;
  testQuality: number;
}

export interface RustEvaluationSideInfo {
  task: {
    id: string;
    prompt: string;
    repository: RustTask['repository'];
    split: RustTask['split'];
  };
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  agentTrace: string;
  patchSummary: string;
  timings: RustEvaluationTimings;
  diagnostics: string[];
}

export interface RustTaskEvaluation {
  score: number;
  acceptable: boolean;
  passedCorrectness: boolean;
  failureReasons: string[];
  scoreBreakdown: RustScoreBreakdown;
  commandResults: RustCommandResult[];
  sideInfo: RustEvaluationSideInfo;
}

export function scoreRustTaskRun(run: RustTaskRun): RustTaskEvaluation {
  const requiredResults = run.commandResults.filter(
    result =>
      result.required === true ||
      result.command === run.task.oracle.command ||
      result.kind === run.task.oracle.kind,
  );
  const failedRequired = requiredResults.filter(result => result.exitCode !== 0);
  const failureReasons = failedRequired.map(result => `required oracle failed: ${result.command}`);

  if (requiredResults.length === 0) {
    failureReasons.push(`required oracle missing: ${run.task.oracle.command}`);
  }

  const passedCorrectness = failureReasons.length === 0;
  const scoreBreakdown = buildScoreBreakdown(run.secondaryMetrics, passedCorrectness);
  const score = passedCorrectness ? weightedScore(scoreBreakdown) : 0;

  return {
    score,
    acceptable: passedCorrectness && score >= 0.7,
    passedCorrectness,
    failureReasons,
    scoreBreakdown,
    commandResults: run.commandResults,
    sideInfo: {
      task: {
        id: run.task.id,
        prompt: run.task.prompt,
        repository: run.task.repository,
        split: run.task.split,
      },
      modelFamily: run.modelFamily,
      candidateSkillId: run.candidateSkillId,
      agentTrace: run.agentTrace,
      patchSummary: run.patchSummary,
      timings: run.timings,
      diagnostics: run.diagnostics,
    },
  };
}

export function feedbackForGepa(evaluation: RustTaskEvaluation): string {
  const lines: string[] = [];
  for (const result of evaluation.commandResults) {
    if (result.exitCode === 0) continue;
    lines.push(`${result.command} failed with exit ${result.exitCode}`);
    const diagnosticOutput = [result.stderr, result.stdout].map(text => text.trim()).find(Boolean);
    if (diagnosticOutput) {
      lines.push(diagnosticOutput);
    }
  }

  lines.push(...evaluation.sideInfo.diagnostics);

  return lines
    .map(redactEvalShape)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function buildScoreBreakdown(
  metrics: RustSecondaryMetrics,
  passedCorrectness: boolean,
): RustScoreBreakdown {
  return {
    correctness: passedCorrectness ? 1 : 0,
    diffSize: lowerIsBetter(metrics.diffLines, 200),
    speed: lowerIsBetter(metrics.durationMs, 120_000),
    lint: lowerIsBetter(metrics.lintWarnings, 20),
    testQuality: clamp(metrics.testQuality),
  };
}

function weightedScore(breakdown: RustScoreBreakdown): number {
  return roundScore(
    breakdown.correctness * 0.7 +
      breakdown.diffSize * 0.1 +
      breakdown.speed * 0.1 +
      breakdown.lint * 0.05 +
      breakdown.testQuality * 0.05,
  );
}

function lowerIsBetter(value: number, ceiling: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return roundScore(1 - Math.min(value, ceiling) / ceiling);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return roundScore(Math.max(0, Math.min(value, 1)));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function redactEvalShape(raw: string): string {
  return raw
    .replace(/\b(train|validation|heldout)\b/gi, '[split]')
    .replace(/expected defect counts?\s*[:=]?\s*\d*/gi, '[expected counts omitted]')
    .replace(/fixture regularity/gi, '[fixture pattern omitted]')
    .replace(
      /\b(GEPA|optimizer|optimization|mutation|Pareto|evolutionary)\b/gi,
      '[search detail omitted]',
    );
}
