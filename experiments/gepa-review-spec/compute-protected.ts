/**
 * Compute the baseline protected-set (ticket 21RAT9). Runs the SHIPPED
 * review-spec skill over the corpus k times, majority-votes which seeds it
 * reliably catches, and writes baseline-protected.json — the reference for the
 * relative recall floor (see src/protected.ts). The set is model- and
 * corpus-specific: RE-RUN whenever the scoring model or the corpus changes.
 *
 *   SAFEWORD_EVAL_MODEL=claude-sonnet-5 bun compute-protected.ts [runs=3]
 *
 * Keys come from the environment (wrap with op). Spends tokens: k x corpus.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadFixtures } from './src/dataset';
import { scoreFixture } from './src/evaluator';
import {
  computeProtectedSet,
  seedKey,
  serializeProtectedSet,
  type BaselineRunCatches,
} from './src/protected';
import { createRunnerFromEnv } from './src/task';
import type { RunOutput, SkillRunner } from './src/types';

const SKILL_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  '.claude',
  'skills',
  'review-spec',
  'SKILL.md',
);
const OUT_PATH = join(import.meta.dirname, 'baseline-protected.json');

/** Retry a transient runner failure (e.g. a fetch timeout) before giving up — a
 * long paid batch must not die on one hiccup (gepa-eval.ts already does this). */
async function runWithRetry(
  runner: SkillRunner,
  skill: string,
  feature: string,
): Promise<RunOutput> {
  const attempts = 4;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await runner.run(skill, feature);
    } catch (error) {
      if (i === attempts - 1) throw error;
      process.stderr.write(`    retry ${i + 1}: ${(error as Error).message}\n`);
    }
  }
  throw new Error('unreachable');
}

async function main(): Promise<void> {
  const runs = Number(process.argv[2] ?? 3);
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const fixtures = loadFixtures();
  const runner = createRunnerFromEnv();

  const allRuns: BaselineRunCatches[][] = [];
  for (let i = 0; i < runs; i += 1) {
    const perFixture: BaselineRunCatches[] = [];
    for (const fx of fixtures) {
      try {
        const out = await runWithRetry(runner, skill, fx.featureSource);
        const s = scoreFixture(fx.name, out.detections, fx.expected, fx.certifiedClean);
        perFixture.push({ name: fx.name, caughtKeys: s.caughtSeeds.map(seedKey) });
      } catch (error) {
        process.stderr.write(
          `    ${fx.name}: FAILED after retries (${(error as Error).message}) — no catches counted this run\n`,
        );
        perFixture.push({ name: fx.name, caughtKeys: [] });
      }
    }
    allRuns.push(perFixture);
    process.stderr.write(`run ${i + 1}/${runs} done\n`);
  }

  const protectedSet = computeProtectedSet(allRuns);
  writeFileSync(OUT_PATH, `${JSON.stringify(serializeProtectedSet(protectedSet), null, 2)}\n`);

  const total = [...protectedSet.values()].reduce((n, s) => n + s.size, 0);
  process.stderr.write(
    `wrote ${OUT_PATH}: ${total} protected seeds across ${protectedSet.size} fixtures (threshold ceil(2*${runs}/3))\n`,
  );
}

void main();
