/**
 * Stability harness (ticket 21RAT9). The held-out validate-skill.ts run is a
 * SINGLE draw per cell, and the run carries ±1-2/fixture sampling variance (the
 * runner sends no `temperature` — Sonnet 5 rejects it — so this is the model's
 * default-sampling nondeterminism, not temp-0) — the SEED even dipped below its
 * own majority-voted floor once (a spurious "FLOOR BREACH 1").
 * This re-runs SEED vs winner on the TEST split N times to answer two questions a
 * single draw can't:
 *   1. Does the winner RELIABLY hold the floor + its recall/precision gain, or
 *      was the held-out result a lucky draw?
 *   2. Is the recall gain GENUINE detection — which seeds flip to caught (esp.
 *      determinism-order, the type the baseline systematically misses) — and does
 *      the winner ever false-alarm determinism on a CLEAN fixture (the residual
 *      gaming vector: liberal flagging that only "lands" on seeded fixtures)?
 *
 * Interleaves the two candidates per round so both see similar API conditions.
 * Spends tokens: 2 candidates x N x |test|. Wrap with op.
 *
 *   ANTHROPIC_API_KEY=... bun stability.ts [runs=3]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadFixtures, testSplit } from './src/dataset';
import { scoreFixture, type FixtureScore } from './src/evaluator';
import { loadProtectedSet, protectedMisses } from './src/protected';
import { createRunnerFromEnv } from './src/task';
import { DEFAULT_SEVERITY, type RunOutput, type SkillRunner } from './src/types';

const CANDIDATES = [
  ['SEED', join(import.meta.dirname, '..', '..', '.claude', 'skills', 'review-spec', 'SKILL.md')],
  ['WINNER', join(import.meta.dirname, 'gepa', 'winner.md')],
] as const;

/** Survive a transient timeout before giving up — a long paid batch must not die
 * on one hiccup (mirrors compute-protected.ts / gepa-eval.ts). */
async function runWithRetry(
  runner: SkillRunner,
  skill: string,
  feature: string,
): Promise<RunOutput> {
  for (let index = 0; index < 4; index += 1) {
    try {
      return await runner.run(skill, feature);
    } catch (error) {
      if (index === 3) throw error;
      process.stderr.write(`    retry ${index + 1}: ${(error as Error).message}\n`);
    }
  }
  throw new Error('unreachable');
}

interface Cell {
  falseAlarms: number;
  caught: number;
  missed: number;
  protectedMissed: number;
  missedTypes: string[];
  falseAlarmTypes: string[];
}

async function main(): Promise<void> {
  const runs = Number(process.argv[2] ?? 3);
  const fixtures = testSplit(loadFixtures());
  const protectedPath = join(import.meta.dirname, 'baseline-protected.json');
  const protectedSet = loadProtectedSet(() => readFileSync(protectedPath, 'utf8'));
  const runner = createRunnerFromEnv();

  // label -> fixtureName -> one Cell per run
  const data = new Map<string, Map<string, Cell[]>>();
  for (const [label] of CANDIDATES) data.set(label, new Map(fixtures.map(f => [f.name, []])));

  for (let round = 0; round < runs; round += 1) {
    for (const [label, path] of CANDIDATES) {
      const skill = readFileSync(path, 'utf8');
      let falseAlarms = 0;
      let caught = 0;
      let missed = 0;
      let protectedMissed = 0;
      let dropped = 0;
      for (const fixture of fixtures) {
        let score: FixtureScore;
        try {
          const out = await runWithRetry(runner, skill, fixture.featureSource);
          score = scoreFixture(
            fixture.name,
            out.detections,
            fixture.expected,
            fixture.certifiedClean,
          );
        } catch (error) {
          // A dropped fixture would SILENTLY bias the run totals downward (fewer
          // misses/FA) — surface the count on STDOUT (the analysis reads stdout,
          // not the stderr line) so a partial run can never masquerade as clean.
          dropped += 1;
          process.stderr.write(
            `    ${label} ${fixture.name}: FAILED after retries (${(error as Error).message})\n`,
          );
          continue;
        }
        const cell: Cell = {
          falseAlarms: score.falseAlarms.length,
          caught: score.truePositives.length,
          missed: score.falseNegatives.length,
          protectedMissed: protectedMisses(score, protectedSet).length,
          missedTypes: score.falseNegatives.map(e => e.defectType),
          falseAlarmTypes: score.falseAlarms.map(d => d.defectType),
        };
        data.get(label)?.get(fixture.name)?.push(cell);
        falseAlarms += cell.falseAlarms;
        caught += cell.caught;
        missed += cell.missed;
        protectedMissed += cell.protectedMissed;
      }
      process.stdout.write(
        `${label.padEnd(7)} run ${round + 1}/${runs}  FA=${String(falseAlarms).padStart(3)}  caught=${caught}  missed=${missed}  protectedMissed=${protectedMissed}` +
          (dropped > 0 ? `  ⚠️ DROPPED=${dropped} (totals undercounted — rerun)` : '') +
          '\n',
      );
    }
  }

  for (const [label] of CANDIDATES) {
    process.stdout.write(`\n=== ${label} — per-fixture over ${runs} runs (test split) ===\n`);
    let floorBreachFixtures = 0;
    for (const fixture of fixtures) {
      const cells = data.get(label)?.get(fixture.name) ?? [];
      const seeds = fixture.expected
        .filter(e => DEFAULT_SEVERITY[e.defectType] === 'must-fix')
        .map(e => e.defectType);
      // `missed === 0` counts ALL severities; equals "all must-fix seeds caught"
      // only because the test split carries no should-strengthen seeds. Revisit if
      // that changes (filter c.missedTypes by DEFAULT_SEVERITY).
      const fullyCaught = cells.filter(c => c.missed === 0).length;
      const protectedMissRuns = cells.filter(c => c.protectedMissed > 0).length;
      const falseAlarmRuns = cells.filter(c => c.falseAlarms > 0).length;
      if (protectedMissRuns > 0) floorBreachFixtures += 1;
      // Skip fixtures that are clean AND never false-alarmed — pure noise.
      if (seeds.length === 0 && falseAlarmRuns === 0) continue;
      const missedTypes = [...new Set(cells.flatMap(c => c.missedTypes))];
      const falseAlarmTypes = [...new Set(cells.flatMap(c => c.falseAlarmTypes))];
      process.stdout.write(
        `  ${fixture.name.padEnd(36)} seeds=[${seeds.join(',')}]  caught ${fullyCaught}/${runs}` +
          (missedTypes.length > 0 ? `  missed=[${missedTypes.join(',')}]` : '') +
          (protectedMissRuns > 0 ? `  PROTECTED-MISS ${protectedMissRuns}/${runs}` : '') +
          (falseAlarmTypes.length > 0
            ? `  FA ${falseAlarmRuns}/${runs} [${falseAlarmTypes.join(',')}]`
            : '') +
          '\n',
      );
    }
    process.stdout.write(
      `  FLOOR: fixtures with a protected miss in ANY run: ${floorBreachFixtures}\n`,
    );
  }
}

void main();
