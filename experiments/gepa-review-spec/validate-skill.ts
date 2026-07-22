/**
 * Accept-gate harness — compare a candidate review-spec prompt against the
 * shipped one on the corpus. PROTECTED recall must stay 100% (no baseline-caught
 * seed missed — a systematic miss like determinism-order does NOT breach); false
 * alarms should drop. Runs both skills on both splits in one session for a fair
 * before/after (temp-0 has ±1/fixture variance). Spends tokens.
 *
 *   ANTHROPIC_API_KEY=... bun validate-skill.ts [candidatePath]
 */
import { execFileSync } from 'node:child_process';

const bun = process.env.BUN_BIN ?? 'bun';
const SEED = '../../.claude/skills/review-spec/SKILL.md';
const candidate = process.argv[2] ?? 'gepa/candidate-skill.md';

interface Row {
  falseAlarms: number;
  missed: number;
  protectedMissed: number;
  caught: number;
}

function score(
  path: string,
  split: 'train' | 'test',
): { fa: number; missed: number; protectedMissed: number; caught: number } {
  const out = execFileSync(bun, ['gepa-eval.ts', '--candidate', path, '--split', split], {
    encoding: 'utf8',
  });
  const rows = JSON.parse(out) as Row[];
  return rows.reduce(
    (a, r) => ({
      fa: a.fa + r.falseAlarms,
      missed: a.missed + r.missed,
      protectedMissed: a.protectedMissed + r.protectedMissed,
      caught: a.caught + r.caught,
    }),
    { fa: 0, missed: 0, protectedMissed: 0, caught: 0 },
  );
}

for (const [label, path] of [
  ['SEED', SEED],
  ['CANDIDATE', candidate],
] as const) {
  for (const split of ['train', 'test'] as const) {
    const r = score(path, split);
    // The GATE is protected recall (baseline-caught seeds); raw `missed` is shown
    // for transparency but a systematic miss (e.g. determinism-order) does NOT
    // breach the floor. See src/protected.ts.
    const floor = r.protectedMissed === 0 ? 'floor OK' : `FLOOR BREACH ${r.protectedMissed}`;
    console.log(
      `${label.padEnd(9)} ${split.padEnd(5)}  false-alarms ${String(r.fa).padStart(3)}  caught ${r.caught}  missed ${r.missed}  ${floor}`,
    );
  }
}
