/**
 * TEMP: re-score a saved SAFEWORD_EVAL_TRACE=1 baseline trace with the CURRENT
 * evaluator, without spending tokens. Isolates a metric change from run-to-run
 * model variance by replaying the exact same raw responses.
 *   bun rescore.ts /tmp/gepa-baseline-20.txt
 */
import { readFileSync } from 'node:fs';

import { loadFixtures, trainSplit, testSplit } from './src/dataset';
import { aggregate, scoreFixture } from './src/evaluator';
import { formatReport } from './src/harness';
import { parseDetections } from './src/task';
import type { Fixture } from './src/types';

const tracePath = process.argv[2] ?? '/tmp/gepa-baseline-20.txt';
const trace = readFileSync(tracePath, 'utf8');

const rawByName = new Map<string, string>();
for (const block of trace.split(/FIXTURE: /).slice(1)) {
  const name = block.slice(0, block.indexOf('(')).trim();
  const m = block.match(/--- RAW MODEL RESPONSE ---\n([\s\S]*?)\n--- PARSED DETECTIONS ---/);
  if (m) rawByName.set(name, m[1]);
}

const scoreSplit = (split: Fixture[]) =>
  aggregate(
    split.map(fx =>
      scoreFixture(
        fx.name,
        parseDetections(rawByName.get(fx.name) ?? ''),
        fx.expected,
        fx.certifiedClean,
      ),
    ),
  );

const fixtures = loadFixtures();
console.log(`Re-scored from ${tracePath} (${rawByName.size} cached responses)\n`);
console.log('=== TRAIN (family matching) ===');
console.log(formatReport(scoreSplit(trainSplit(fixtures))));
console.log('\n=== TEST / held-out (family matching) ===');
console.log(formatReport(scoreSplit(testSplit(fixtures))));
