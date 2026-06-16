/**
 * Render a test/build plan as an eval-able shell script for bash consumers
 * (e.g. the /verify skill: `eval "$(safeword test-plan --format sh)"`).
 *
 * - `set -e` (only when there's something to run) so the eval exits non-zero on
 *   the first failing suite — preserving the done-gate's block-on-red behavior.
 * - one `( cd "<cwd>" && <command> )` per available entry (cd-scoped so nested
 *   modules run in their own directory).
 * - one `echo "⏭️ Skipped — <runner> not installed"` per unavailable entry, so a
 *   missing toolchain is visible, never a silently-dropped or failing command.
 * - an empty plan renders to the empty string — a clean no-op under `eval`.
 */

import type { PlanEntry } from './resolve.js';

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

export function renderShellPlan(entries: PlanEntry[]): string {
  if (entries.length === 0) return '';
  const lines = ['set -e'];
  for (const entry of entries) {
    // `entry.cwd` is data → single-quoted. `entry.command` is safeword's own
    // trusted output (and may legitimately contain `$(go list …)`) → left as-is.
    lines.push(
      entry.available
        ? `( cd ${shellQuote(entry.cwd)} && ${entry.command} )`
        : `echo "⏭️ Skipped — ${entry.runner} not installed"`,
    );
  }
  return `${lines.join('\n')}\n`;
}
