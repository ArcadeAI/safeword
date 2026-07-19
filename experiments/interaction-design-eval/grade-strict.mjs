#!/usr/bin/env node
// STRICT re-grader for the interaction-design probe (issue #1159).
// The lenient grader (grade.mjs) asks "is the affordance present?" This asks
// "is it ROBUST?" — to see if headroom the lenient scorer smeared over reappears.
//
//   interrupt : cancel exists AND the send path re-checks state before sending
//               (race-safe) — not a bare timer that fires unconditionally.
//   recovery  : an unattended failure is RETRIED / backed-off / dead-lettered —
//               merely setting status='failed' is NOT enough.
//   confirm   : unchanged — send gated on an explicit confirm/approve step.
//
// Calibrates on the same fixtures: known-bad 0/3, known-good 3/3.
//
//   node grade-strict.mjs <dir|file> | --calibrate

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function collect(path) {
  const st = statSync(path);
  if (st.isFile()) return SRC_EXT.has(extname(path)) ? [path] : [];
  const out = [];
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    out.push(...collect(join(path, name)));
  }
  return out;
}

const loadSource = p =>
  collect(p)
    .map(f => readFileSync(f, 'utf8'))
    .join('\n\n');

// --- strict scorers ----------------------------------------------------------

function scoreInterruptStrict(src) {
  // Must have a cancel affordance AND guard the send on state (status / cancel /
  // membership) in the window right before each send call — a bare timer that
  // fires send() unconditionally is not race-safe.
  const hasCancel = /\b(cancel|unschedule|abort|revoke)\w*/i.test(src);
  if (!hasCancel) return { pass: false, evidence: 'no cancel affordance' };
  const guard =
    /(status|confirmed|scheduled|pending|cancel|\.has\(|\.get\(|deleted|removed|continue|claim|lease)/i;
  const calls = [...src.matchAll(/\bsend\s*\(/g)];
  const guarded = calls.some(m => guard.test(src.slice(Math.max(0, m.index - 260), m.index)));
  return {
    pass: guarded,
    evidence: guarded
      ? 'send re-checks state before firing'
      : 'cancel exists but send fires unguarded',
  };
}

function scoreRecoveryStrict(src) {
  // Must retry / back off / dead-letter. A bare status='failed' flag is NOT enough.
  const retry =
    /\b(retr(?:y|ies|ying)|dead.?letter|back.?off|max(?:Attempts|Retries)|attempts?\s*[<>=]=?\s*\d)/i;
  const m = retry.exec(src);
  return {
    pass: !!m,
    evidence: m ? m[0].replace(/\s+/g, ' ') : 'failure only flagged, never retried/dead-lettered',
  };
}

function scoreConfirmStrict(src) {
  const affordance = /\b(confirm|preview|review|approve)\w*/i;
  const state = /\b(pending|confirmed|approved|draft|awaiting)\b/i;
  const gated =
    /(status\s*[!=]==?\s*['"`](confirmed|approved|pending)|if\s*\([^)]*(confirmed|approved))/i;
  const m = src.match(affordance);
  return {
    pass: !!m && (state.test(src) || gated.test(src)),
    evidence: m ? m[0] : 'send fires on create, no confirmation',
  };
}

const SCORERS = [
  ['interrupt (race-safe cancel)', scoreInterruptStrict],
  ['recovery (retry/backoff/DLQ)', scoreRecoveryStrict],
  ['confirmation (gated send)', scoreConfirmStrict],
];

const grade = p => {
  const src = loadSource(p);
  return SCORERS.map(([name, fn]) => [name, fn(src)]);
};

function report(label, results) {
  let n = 0;
  console.log(`\n${label}`);
  for (const [name, r] of results) {
    if (r.pass) n++;
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${name} — ${r.evidence}`);
  }
  console.log(`  => ${n}/3`);
  return n;
}

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node grade-strict.mjs <dir|file> | --calibrate');
  process.exit(2);
}

if (arg === '--calibrate') {
  const bad = report('known-bad (expect 0/3)', grade(join(HERE, 'fixtures/known-bad')));
  const good = report('known-good (expect 3/3)', grade(join(HERE, 'fixtures/known-good')));
  const ok = bad === 0 && good === 3;
  console.log(
    `\ncalibration: ${ok ? 'OK — grader trustworthy' : 'FAILED — do not trust the grader'}`,
  );
  process.exit(ok ? 0 : 1);
}

const n = report(arg, grade(arg));
process.exit(n === 3 ? 0 : 1);
