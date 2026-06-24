/**
 * HARNESS — composes DATASET x TASK x EVALUATOR into one score.
 *
 * Platform-agnostic: this is the piece a LangSmith or Phoenix adapter
 * re-implements using its own runner loop, while reusing `dataset`,
 * `task`, and `evaluator` unchanged. GEPA's adapter calls `runEval` directly
 * with each candidate prompt and reads `AggregateScore` back.
 */

import { aggregate, scoreFixture, type AggregateScore, type FixtureScore } from './evaluator';
import type { Fixture, RunOutput, SkillRunner } from './types';

/** One fixture's run + score, kept together for trace inspection / debugging. */
export interface FixtureTrace {
  name: string;
  output: RunOutput;
  score: FixtureScore;
}

/**
 * Run a candidate prompt over a set of fixtures, scoring each and keeping its
 * raw output. This is the workhorse; `runEval` is the score-only convenience.
 * The traces are what the baseline prints for a human read and what a GEPA
 * adapter reads as the reflective trace (raw response + per-defect diff).
 */
export async function runEvalWithTraces(
  skillPrompt: string,
  fixtures: Fixture[],
  runner: SkillRunner,
): Promise<{ score: AggregateScore; traces: FixtureTrace[] }> {
  const traces: FixtureTrace[] = [];
  for (const fx of fixtures) {
    const output = await runner.run(skillPrompt, fx.featureSource);
    traces.push({
      name: fx.name,
      output,
      score: scoreFixture(fx.name, output.detections, fx.expected, fx.certifiedClean),
    });
  }
  return { score: aggregate(traces.map(t => t.score)), traces };
}

/** Run a candidate prompt over a set of fixtures and score it. */
export async function runEval(
  skillPrompt: string,
  fixtures: Fixture[],
  runner: SkillRunner,
): Promise<AggregateScore> {
  return (await runEvalWithTraces(skillPrompt, fixtures, runner)).score;
}

/** Compact, human-readable report for the CLI baseline. */
export function formatReport(score: AggregateScore): string {
  const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [
    // Recall (primary) and false alarms (guard) are reported SEPARATELY — there
    // is no single F1, by design (see evaluator.ts).
    `RECALL ${pct(score.recall)}  (caught ${score.seededCaught}/${score.seededTotal} seeded` +
      `  ·  must-fix ${pct(score.mustFix.recall)} ${score.mustFix.tp}/${score.mustFix.tp + score.mustFix.fn}` +
      `  ·  should-strengthen ${pct(score.shouldStrengthen.recall)} ${score.shouldStrengthen.tp}/${score.shouldStrengthen.tp + score.shouldStrengthen.fn})`,
    `FALSE ALARMS ${score.falseAlarms} on ${score.cleanFixtures} certified-clean fixture(s)` +
      ` (rate ${score.falseAlarmRate.toFixed(2)}/fixture)  ·  unlabeled (not penalized) ${score.unlabeled}`,
    '',
    'Per fixture:',
    ...score.perFixture.map(
      f =>
        `  ${f.name.padEnd(22)} recall ${pct(f.recall)}` +
        `  (tp ${f.truePositives.length} fn ${f.falseNegatives.length}` +
        ` · FA ${f.falseAlarms.length}${f.certifiedClean ? '' : ' n/a'} · unlabeled ${f.unlabeled.length})`,
    ),
    '',
    'Per defect type (ASI — where it misses / false-alarms):',
    ...score.perDefect.map(
      d =>
        `  ${d.defectType.padEnd(24)} ${d.severity.padEnd(17)} recall ${pct(d.recall)}` +
        `  (tp ${d.tp} fn ${d.fn} · FA ${d.falseAlarms})`,
    ),
  ];
  return lines.join('\n');
}
