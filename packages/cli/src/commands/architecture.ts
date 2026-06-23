/**
 * `safeword architecture` — refresh the generated architecture state document
 * (ticket QD5DTT, Slice 1) and, with `--check`, enforce its freshness in CI
 * (ticket FPV0E4, Slice 2).
 *
 * Default mode is a thin CLI entry over `selfHeal`: re-extracts the skeleton and
 * reconciles prose markers at the generated `.project/architecture.generated.md`.
 * The SessionStart hook shells out to it so the heal logic lives in one place.
 *
 * `--check` is the CI backstop: a dry-run of `selfHeal` that writes nothing and
 * exits non-zero when the committed doc is stale (a would-change action), so a
 * silently-wrong doc cannot reach the main branch. Honors the per-project
 * opt-out (`architectureDocEnforcement: false`).
 */

import process from 'node:process';

import { isWouldChangeAction, planSelfHeal, selfHeal } from '../utils/architecture-document.js';
import { isArchitectureDocumentEnforcementEnabled } from '../utils/configured-paths.js';
import { error, success } from '../utils/output.js';

export function architecture(
  cwd: string = process.cwd(),
  options: { check?: boolean } = {},
): Promise<void> {
  if (options.check) {
    return architectureCheck(cwd);
  }

  const result = selfHeal(cwd);
  success(`Architecture state document ${result.action}: ${result.path}`);
  return Promise.resolve();
}

/**
 * CI staleness backstop. Exits non-zero when the doc is stale (would change),
 * passes when it is current/`noop`/foreign or when enforcement is opted out.
 * Writes nothing — the fix is the human running `safeword architecture`.
 */
function architectureCheck(cwd: string): Promise<void> {
  if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
    success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
    return Promise.resolve();
  }

  const action = planSelfHeal(cwd);
  if (isWouldChangeAction(action)) {
    error(
      `Architecture doc is stale (${action}). Run \`safeword architecture\` to regenerate it, then commit the result.`,
    );
    process.exit(1);
  }

  success('Architecture doc is current.');
  return Promise.resolve();
}
