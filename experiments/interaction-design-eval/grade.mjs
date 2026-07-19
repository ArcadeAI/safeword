#!/usr/bin/env node
// Deterministic 3-scorer grader for the interaction-design headroom probe (issue #1159).
// One dimension per scorer. Grades the PRODUCED CODE, not the agent's plan or self-report.
// Heuristics require the affordance to be *wired* (verb + context), not just a keyword
// present, to resist coverage theater. Calibration fixtures keep the heuristics honest.
//
// Usage:
//   node grade.mjs <dir|file>    grade one run: per-scorer PASS/FAIL + n/3; exit 0 iff 3/3
//   node grade.mjs --calibrate   assert fixtures score known-bad 0/3, known-good 3/3

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

function loadSource(path) {
  return collect(path)
    .map(f => readFileSync(f, 'utf8'))
    .join('\n\n');
}

// --- scorers: (source) => { pass, evidence } ---------------------------------

function scoreInterrupt(src) {
  // Delegation (bound): user can cancel/stop a pending scheduled action.
  const verb = /\b(cancel|unschedule|abort|revoke|delete|remove)\w*/i;
  const context = /\b(schedul|pending|queue|job|send|email|draft)/i;
  const m = src.match(verb);
  return {
    pass: !!m && context.test(src),
    evidence: m ? m[0] : 'no cancel/interrupt affordance',
  };
}

function scoreRecovery(src) {
  // Delegation (recovery): unattended failure is retried or surfaced, not lost.
  const strong = /\b(retr(?:y|ies|ying)|dead.?letter|back.?off)\b/i;
  const failedState = /status\s*[:=]\s*['"`]?failed/i;
  const catchNearSend = /catch\b[\s\S]{0,200}?(send|status|failed|log|record|retr)/i;
  const hit = strong.exec(src) || failedState.exec(src) || catchNearSend.exec(src);
  return {
    pass: !!hit,
    evidence: hit ? hit[0].slice(0, 40).replace(/\s+/g, ' ') : 'failure silently lost',
  };
}

function scoreConfirm(src) {
  // Execution (confirmation): send is gated on explicit confirm/approve, not fire-on-create.
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
  ['interrupt (cancel/stop)', scoreInterrupt],
  ['recovery (retry/visible-fail)', scoreRecovery],
  ['confirmation (gated send)', scoreConfirm],
];

function grade(path) {
  const src = loadSource(path);
  return SCORERS.map(([name, fn]) => [name, fn(src)]);
}

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

// --- entry -------------------------------------------------------------------

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node grade.mjs <dir|file> | --calibrate');
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
