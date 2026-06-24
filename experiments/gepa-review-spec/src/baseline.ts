/**
 * Phase 3 entry point — score the CURRENT review-spec skill against the corpus.
 *
 * Run (needs a key, spends tokens):
 *   ANTHROPIC_API_KEY=sk-... bun experiments/gepa-review-spec/src/baseline.ts
 *
 * Prints the baseline F1 + per-defect breakdown. That number is the bar any
 * GEPA-evolved candidate must beat on the held-out split.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadFixtures, testSplit, trainSplit } from './dataset';
import { formatReport, runEval } from './harness';
import { createAnthropicRunner } from './task';

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

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the baseline (it spends tokens).');
    process.exit(1);
  }
  const skillPrompt = readFileSync(SKILL_PATH, 'utf8');
  const fixtures = loadFixtures();
  const runner = createAnthropicRunner({ model: process.env.SAFEWORD_EVAL_MODEL });

  console.log(
    `Corpus: ${fixtures.length} fixtures (${trainSplit(fixtures).length} train, ${testSplit(fixtures).length} test)\n`,
  );
  console.log('=== TRAIN ===');
  console.log(formatReport(await runEval(skillPrompt, trainSplit(fixtures), runner)));
  console.log('\n=== TEST (held-out) ===');
  console.log(formatReport(await runEval(skillPrompt, testSplit(fixtures), runner)));
}

void main();
