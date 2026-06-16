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

export function renderShellPlan(entries: PlanEntry[]): string {
  if (entries.length === 0) return '';
  const lines = ['set -e'];
  for (const entry of entries) {
    lines.push(
      entry.available
        ? `( cd "${entry.cwd}" && ${entry.command} )`
        : `echo "⏭️ Skipped — ${entry.runner} not installed"`,
    );
  }
  return `${lines.join('\n')}\n`;
}
