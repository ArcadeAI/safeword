/**
 * Multi-run accept gate (ticket 21RAT9). Compares a candidate review-spec prompt
 * against the shipped seed on a split, N times, and decides ACCEPT/REJECT on a
 * CONSENSUS basis — because a single run is too noisy to gate on. The runner sends
 * no temperature, so default-sampling variance makes even the baseline miss a
 * protected seed ~1/3 of runs; a one-run gate therefore spuriously rejects good
 * candidates (measured: the GEPA winner breaches a one-run floor 2/3 of runs yet
 * holds it on consensus). The floor is the HARD gate: a candidate is REJECTED iff
 * it misses a protected seed on a ⌈2N/3⌉ consensus — the floor's own supermajority
 * basis (see src/protected.ts). False-alarm rate (precision) is reported as the
 * improvement signal. Recall over UNPROTECTED seeds (e.g. determinism-order) is
 * measured but never gates. Spends tokens: 2 candidates x N x |split|. Wrap with op.
 *
 *   ANTHROPIC_API_KEY=... bun validate-skill.ts [candidate=gepa/winner.md] [runs=5] [split=test|train|all]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadFixtures, testSplit, trainSplit } from './src/dataset';
import { scoreFixture } from './src/evaluator';
import {
  consensusFloorBreaches,
  loadProtectedSet,
  seedKey,
  type BaselineRunCatches,
  type ConsensusBreach,
  type ProtectedSet,
} from './src/protected';
import { createRunnerFromEnv } from './src/task';
import { DEFAULT_SEVERITY, type Fixture, type RunOutput, type SkillRunner } from './src/types';

const SEED = join(import.meta.dirname, '..', '..', '.claude', 'skills', 'review-spec', 'SKILL.md');

/** Retry a transient failure; a persistent one aborts the gate LOUD (never a
 * partial run masquerading as a verdict — see stability.ts's drop-guard rationale). */
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

interface CandidateResult {
  perRunFalseAlarms: number[];
  meanFalseAlarms: number;
  breaches: ConsensusBreach[];
}

async function evaluateCandidate(
  runner: SkillRunner,
  skillPath: string,
  fixtures: Fixture[],
  runs: number,
  manifest: ProtectedSet,
): Promise<CandidateResult> {
  const skill = readFileSync(skillPath, 'utf8');
  const candidateRuns: BaselineRunCatches[][] = [];
  const perRunFalseAlarms: number[] = [];
  for (let round = 0; round < runs; round += 1) {
    const perFixture: BaselineRunCatches[] = [];
    let falseAlarms = 0;
    for (const fixture of fixtures) {
      const out = await runWithRetry(runner, skill, fixture.featureSource);
      const score = scoreFixture(
        fixture.name,
        out.detections,
        fixture.expected,
        fixture.certifiedClean,
      );
      // Protect MUST-FIX seeds only — the same filter compute-protected applies, so
      // the candidate's "reliably caught" set is derived exactly like the floor.
      perFixture.push({
        name: fixture.name,
        caughtKeys: score.caughtSeeds
          .filter(e => DEFAULT_SEVERITY[e.defectType] === 'must-fix')
          .map(seedKey),
      });
      falseAlarms += score.falseAlarms.length;
    }
    candidateRuns.push(perFixture);
    perRunFalseAlarms.push(falseAlarms);
  }
  return {
    perRunFalseAlarms,
    meanFalseAlarms: perRunFalseAlarms.reduce((a, b) => a + b, 0) / runs,
    breaches: consensusFloorBreaches(
      candidateRuns,
      manifest,
      fixtures.map(f => f.name),
    ),
  };
}

function report(label: string, r: CandidateResult): void {
  process.stdout.write(
    `  ${label.padEnd(9)} FA/run [${r.perRunFalseAlarms.join(', ')}]  mean ${r.meanFalseAlarms.toFixed(1)}  consensus-breaches ${r.breaches.length}\n`,
  );
  for (const b of r.breaches) {
    process.stdout.write(
      `      BREACH  ${b.fixture} :: ${b.key}  — caught ${b.caughtRuns}/${b.runs}\n`,
    );
  }
}

async function main(): Promise<void> {
  const candidatePath = process.argv[2] ?? 'gepa/winner.md';
  const runs = Number(process.argv[3] ?? 5);
  const splitArg = process.argv[4] ?? 'test';
  const all = loadFixtures();
  const splits: [string, Fixture[]][] =
    splitArg === 'all'
      ? [
          ['train', trainSplit(all)],
          ['test', testSplit(all)],
        ]
      : splitArg === 'train'
        ? [['train', trainSplit(all)]]
        : [['test', testSplit(all)]];

  const manifestPath = join(import.meta.dirname, 'baseline-protected.json');
  const manifest = loadProtectedSet(() =>
    existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null,
  );
  if (manifest === null) {
    throw new Error('baseline-protected.json missing — the accept gate needs the protected floor');
  }
  const runner = createRunnerFromEnv();

  let accept = true;
  for (const [splitName, fixtures] of splits) {
    process.stdout.write(
      `\n=== split: ${splitName} (${fixtures.length} fixtures × ${runs} runs, consensus ⌈2·${runs}/3⌉=${Math.ceil((2 * runs) / 3)}) ===\n`,
    );
    const seed = await evaluateCandidate(runner, SEED, fixtures, runs, manifest);
    const candidate = await evaluateCandidate(runner, candidatePath, fixtures, runs, manifest);
    report('SEED', seed);
    report('CANDIDATE', candidate);
    // Floor is the HARD gate; precision is reported (the seed can breach its own
    // borderline-protected seeds on a fresh draw — that gates nothing, it just
    // flags a manifest seed built at the threshold).
    const floorOk = candidate.breaches.length === 0;
    if (!floorOk) accept = false;
    const precision =
      candidate.meanFalseAlarms < seed.meanFalseAlarms
        ? `improved (${candidate.meanFalseAlarms.toFixed(1)} vs ${seed.meanFalseAlarms.toFixed(1)} FA/run)`
        : `NOT improved (${candidate.meanFalseAlarms.toFixed(1)} vs ${seed.meanFalseAlarms.toFixed(1)} FA/run)`;
    process.stdout.write(
      `  → ${splitName}: floor ${floorOk ? 'OK' : `BREACH (${candidate.breaches.length})`}; precision ${precision}\n`,
    );
  }
  process.stdout.write(
    `\n=== VERDICT: ${accept ? 'ACCEPT' : 'REJECT'} (floor) — candidate ${candidatePath} ===\n`,
  );
}

void main();
