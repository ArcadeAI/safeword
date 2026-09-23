/**
 * Render a test/build plan as an eval-able shell script for bash consumers.
 * The /verify skill first captures the generator output and checks its exit
 * status, then evaluates this script only when generation succeeded.
 *
 * - every lane runs, while a subshell-scoped accumulator preserves the first
 *   failure even in conditional eval contexts without leaking shell state.
 * - one `( cd "<cwd>" && <command> )` per available entry (cd-scoped so nested
 *   modules run in their own directory).
 * - one failing subshell per unavailable entry, so a missing toolchain is visible
 *   and can never make an eval-based verification consumer report false green.
 * - an empty plan renders to the empty string — a clean no-op under `eval`.
 */

import type { Language, PlanEntry, PlanKind } from './resolve.js';

export const PLAN_LANE_NAMES: Readonly<Record<PlanKind, string>> = {
  test: 'test',
  build: 'build',
  verify: 'verification',
  typecheck: 'typecheck',
  deps: 'dependency',
  bdd: 'acceptance',
};

const PLAN_LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
};

/**
 * POSIX single-quote a string so the shell treats it as a literal — no `$()`,
 * backtick, or variable expansion. Critical for `cwd`, which is filesystem data
 * (a directory could be maliciously named e.g. `$(rm -rf ~)`); the script is
 * eval'd by consumers, so an unescaped path would be a command-injection vector.
 */
function shellQuote(value: string): string {
  const escaped = value.replaceAll("'", String.raw`'\''`);
  return `'${escaped}'`;
}

export function unavailablePlanMessage(entry: PlanEntry, kind: PlanKind): string {
  return `${PLAN_LANGUAGE_NAMES[entry.language]} ${PLAN_LANE_NAMES[kind]} lane skipped: ${entry.runner} is not installed.`;
}

export function renderShellPlan(entries: PlanEntry[], kind: PlanKind = 'test'): string {
  if (entries.length === 0) return '';
  const lanes: string[] = [];
  for (const entry of entries) {
    // `entry.cwd` is data → single-quoted. `entry.command` is safeword's own
    // trusted output (and may legitimately contain `$(go list …)`) → left as-is.
    const unavailableMessage = shellQuote(unavailablePlanMessage(entry, kind));
    lanes.push(
      entry.available
        ? `( cd ${shellQuote(entry.cwd)} && ${entry.command} )`
        : String.raw`( printf '%s\n' ${unavailableMessage} >&2; false )`,
    );
  }
  const guardedLanes = lanes.map(
    lane =>
      `  ${lane} || { safeword_lane_status=$?; [ "$safeword_plan_status" -ne 0 ] || safeword_plan_status=$safeword_lane_status; }`,
  );
  return `(\n  safeword_plan_status=0\n${guardedLanes.join('\n')}\n  exit "$safeword_plan_status"\n)\n`;
}
