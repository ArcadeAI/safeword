/**
 * HARNESS — composes DATASET x TASK x EVALUATOR into one score.
 *
 * Platform-agnostic: this is the piece a LangSmith or Phoenix adapter
 * re-implements using its own runner loop, while reusing `dataset`,
 * `task`, and `evaluator` unchanged. GEPA's adapter calls `runEval` directly
 * with each candidate prompt and reads `AggregateScore` back.
 */

import { aggregate, scoreFixture, type AggregateScore } from './evaluator';
import type { Fixture, SkillRunner } from './types';

/** Run a candidate prompt over a set of fixtures and score it. */
export async function runEval(
  skillPrompt: string,
  fixtures: Fixture[],
  runner: SkillRunner,
): Promise<AggregateScore> {
  const perFixture = [];
  for (const fx of fixtures) {
    const out = await runner.run(skillPrompt, fx.featureSource);
    perFixture.push(scoreFixture(fx.name, out.detections, fx.expected));
  }
  return aggregate(perFixture);
}

/** Compact, human-readable report for the CLI baseline. */
export function formatReport(score: AggregateScore): string {
  const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [
    `F1 ${pct(score.f1)}  |  precision ${pct(score.precision)}  recall ${pct(score.recall)}  (tp ${score.tp} fp ${score.fp} fn ${score.fn})`,
    '',
    'Per fixture:',
    ...score.perFixture.map(
      f =>
        `  ${f.name.padEnd(22)} f1 ${pct(f.f1)}  (tp ${f.truePositives.length} fp ${f.falsePositives.length} fn ${f.falseNegatives.length})`,
    ),
    '',
    'Per defect type (ASI — where it misses):',
    ...score.perDefect.map(
      d =>
        `  ${d.defectType.padEnd(24)} recall ${pct(d.recall)}  (tp ${d.tp} fp ${d.fp} fn ${d.fn})`,
    ),
  ];
  return lines.join('\n');
}
