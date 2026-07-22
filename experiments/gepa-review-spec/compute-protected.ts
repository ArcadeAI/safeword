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

async function main(): Promise<void> {
  const runs = Number(process.argv[2] ?? 3);
  const skill = readFileSync(SKILL_PATH, 'utf8');
  const fixtures = loadFixtures();
  const runner = createRunnerFromEnv();

  const allRuns: BaselineRunCatches[][] = [];
  for (let i = 0; i < runs; i += 1) {
    const perFixture: BaselineRunCatches[] = [];
    for (const fx of fixtures) {
      const out = await runner.run(skill, fx.featureSource);
      const s = scoreFixture(fx.name, out.detections, fx.expected, fx.certifiedClean);
      perFixture.push({ name: fx.name, caughtKeys: s.caughtSeeds.map(seedKey) });
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
