/**
 * Phase 3 entry point — score the CURRENT review-spec skill against the corpus.
 *
 * Run (needs a key, spends tokens):
 *   ANTHROPIC_API_KEY=sk-... bun experiments/gepa-review-spec/src/baseline.ts
 *
 * Prints the baseline F1 + per-defect breakdown. That number is the bar any
 * GEPA-evolved candidate must beat on the held-out split.
 *
 * Set SAFEWORD_EVAL_TRACE=1 to also print each fixture's raw model response and
 * its true/false-positive/false-negative diff — the human-read verification that
 * the auto-score matches what the model actually said (Phase 3b).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadFixtures, testSplit, trainSplit } from './dataset';
import { formatReport, runEvalWithTraces, type FixtureTrace } from './harness';
import { createAnthropicRunner } from './task';
import type { Fixture } from './types';

const SKILL_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '.claude',
  'skills',
  'review-spec',
  'SKILL.md',
);

const TRACE = process.env.SAFEWORD_EVAL_TRACE === '1';

/** Per-fixture human-read trace: raw response + the scored diff. */
function formatTrace(trace: FixtureTrace, fixtures: Fixture[]): string {
  const fx = fixtures.find(f => f.name === trace.name);
  const { score, output } = trace;
  const det = (d: { scenarioId: string; defectType: string }): string =>
    `${d.defectType} @ "${d.scenarioId}"`;
  const lines: string[] = [
    `\n${'='.repeat(72)}`,
    `FIXTURE: ${trace.name}  (${fx?.split ?? '?'} split)`,
    `${'='.repeat(72)}`,
    '--- RAW MODEL RESPONSE ---',
    output.raw ?? '(no raw captured)',
    '--- PARSED DETECTIONS ---',
    output.detections.length
      ? output.detections.map(d => `  • ${det(d)}`).join('\n')
      : '  (none parsed)',
    `--- DIFF (f1 ${(score.f1 * 100).toFixed(1)}%  tp ${score.truePositives.length} fp ${score.falsePositives.length} fn ${score.falseNegatives.length}) ---`,
    `  TP (correctly caught):`,
    ...(score.truePositives.length
      ? score.truePositives.map(d => `    ✓ ${det(d)}`)
      : ['    (none)']),
    `  FP (false alarms — hurt precision):`,
    ...(score.falsePositives.length
      ? score.falsePositives.map(d => `    ✗ ${det(d)}`)
      : ['    (none)']),
    `  FN (seeded but missed — hurt recall):`,
    ...(score.falseNegatives.length
      ? score.falseNegatives.map(
          e =>
            `    ! ${e.defectType} @ "${e.scope === 'fixture' ? '*' : (e.scenarioId ?? '?')}"${e.note ? ` — ${e.note}` : ''}`,
        )
      : ['    (none)']),
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the baseline (it spends tokens).');
    process.exit(1);
  }
  const skillPrompt = readFileSync(SKILL_PATH, 'utf8');
  const fixtures = loadFixtures();
  const model = process.env.SAFEWORD_EVAL_MODEL;
  const runner = createAnthropicRunner({ model });

  console.log(
    `Corpus: ${fixtures.length} fixtures (${trainSplit(fixtures).length} train, ${testSplit(fixtures).length} test)`,
  );
  console.log(`Model:  ${model ?? 'claude-sonnet-4-6 (default)'}  temp 0\n`);

  for (const [label, split] of [
    ['TRAIN', trainSplit(fixtures)],
    ['TEST (held-out)', testSplit(fixtures)],
  ] as const) {
    const { score, traces } = await runEvalWithTraces(skillPrompt, split, runner);
    console.log(`=== ${label} ===`);
    console.log(formatReport(score));
    if (TRACE) for (const t of traces) console.log(formatTrace(t, fixtures));
    console.log('');
  }
}

void main();
