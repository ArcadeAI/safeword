/**
 * GEPA metric entry — score a candidate review-spec prompt over named fixtures
 * and emit per-fixture `{ score, feedback }` JSON for the Python GEPA adapter.
 *
 *   ANTHROPIC_API_KEY=... bun gepa-eval.ts --candidate <promptFile> --fixtures a,b,c
 *   ANTHROPIC_API_KEY=... bun gepa-eval.ts --candidate <promptFile> --split train
 *
 * The TS side owns the model call (createAnthropicRunner) AND the metric
 * (scoreFixture) so the evaluator stays the single source of truth — the Python
 * adapter only orchestrates GEPA's loop and the reflection LM.
 *
 * The objective encodes the figure-it-out decision: a hard recall floor (any
 * missed must-fix → 0, catastrophic) with precision (false-alarm) reduction as
 * the optimization gradient above it. The per-fixture `feedback` is GEPA's
 * reflective signal — it names every false alarm and tells the reflector the
 * boundary to sharpen.
 */
import { readFileSync } from 'node:fs';

import { loadFixtures, testSplit, trainSplit } from './src/dataset';
import { scoreFixture, type FixtureScore } from './src/evaluator';
import { createAnthropicRunner } from './src/task';
import type { Fixture } from './src/types';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Per-fixture objective (higher is better). The recall floor is HARD: a missed
 * must-fix scores a large negative, so a candidate with ANY miss is strictly
 * worse than every miss-free candidate regardless of how clean it is elsewhere.
 * (A per-fixture `0` would NOT do this — a single miss averages away under GEPA's
 * minibatch mean, letting a candidate trade a recall miss for false-alarm gains;
 * caught in quality-review.) Above the floor, each false alarm costs 0.1 (floored
 * at 0.4) so precision is the gradient GEPA climbs. Final acceptance ALSO requires
 * aggregate must-fix recall == 1.0 (the Phase-5 gate), independent of this score.
 */
function objective(s: FixtureScore): number {
  if (s.falseNegatives.length > 0) return -1000 * s.falseNegatives.length;
  return Math.max(0.4, 1 - 0.1 * s.falseAlarms.length);
}

function feedback(s: FixtureScore, fx: Fixture): string {
  // NOTE: this text is shown to the GEPA reflection LM. Keep it to per-finding
  // corrections — never reveal the corpus's structure (e.g. "exactly one seeded
  // defect", "certified-clean base"). Telling the reflector the eval's shape is a
  // gaming accelerant: an earlier version leaked it and GEPA promptly wrote a
  // "be skeptical of a second defect" rule that games the eval (quality-review).
  const lines: string[] = [`Review of feature "${fx.name}":`];
  for (const d of s.truePositives) {
    lines.push(`  GOOD — you correctly flagged "${d.scenarioId}" as ${d.defectType}.`);
  }
  for (const e of s.falseNegatives) {
    const where = e.scope === 'fixture' ? '<set-level>' : (e.scenarioId ?? '?');
    lines.push(
      `  MISS (must catch) — "${where}" has a seeded ${e.defectType}${e.note ? `: ${e.note}` : ''}. You failed to report it. Missing a real defect is the worst outcome.`,
    );
  }
  for (const d of s.falseAlarms) {
    lines.push(
      `  FALSE ALARM — you flagged "${d.scenarioId}" as a must-fix ${d.defectType}, but this scenario is CLEAN. Re-read its Then: it asserts a concrete value or an externally observable outcome, which is NOT vacuous/structural. Only raise a vacuous must-fix when a do-nothing implementation would satisfy the Then; judge the scenario in the context of the whole feature, not in isolation.`,
    );
  }
  if (s.truePositives.length === 0 && s.falseNegatives.length === 0 && s.falseAlarms.length === 0) {
    lines.push('  PERFECT — no seeded defect to catch and no false alarm raised.');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const candidatePath = arg('candidate');
  if (!candidatePath) throw new Error('--candidate <promptFile> is required');
  const candidate = readFileSync(candidatePath, 'utf8');

  const all = loadFixtures();
  const split = arg('split');
  let fixtures: Fixture[];
  if (split === 'train') fixtures = trainSplit(all);
  else if (split === 'test') fixtures = testSplit(all);
  else {
    const names = (arg('fixtures') ?? '').split(',').filter(Boolean);
    const byName = new Map(all.map(f => [f.name, f]));
    fixtures = names.map(n => byName.get(n)).filter((f): f is Fixture => f !== undefined);
  }

  const runner = createAnthropicRunner({ model: process.env.SAFEWORD_EVAL_MODEL });
  const results = [];
  for (const fx of fixtures) {
    try {
      const out = await runner.run(candidate, fx.featureSource);
      const s = scoreFixture(fx.name, out.detections, fx.expected, fx.certifiedClean);
      results.push({
        name: fx.name,
        score: objective(s),
        recall: s.recall,
        caught: s.truePositives.length,
        missed: s.falseNegatives.length,
        falseAlarms: s.falseAlarms.length,
        feedback: feedback(s, fx),
      });
    } catch (error) {
      // Never fail the whole batch on one fixture (GEPA contract): score 0.
      results.push({
        name: fx.name,
        score: 0,
        recall: 0,
        caught: 0,
        missed: -1,
        falseAlarms: -1,
        feedback: `ERROR evaluating "${fx.name}": ${(error as Error).message}`,
      });
    }
  }
  process.stdout.write(JSON.stringify(results));
}

void main();
