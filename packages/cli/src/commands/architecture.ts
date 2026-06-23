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
 * silently-wrong doc cannot reach the main branch.
 *
 * `--stage` is the commit-time auto-fix: regenerate a stale doc via `selfHeal`
 * and `git add` it into the in-flight commit, so the commit lands fresh. Never
 * blocks (always exits zero). Both gated surfaces honor the per-project opt-out
 * (`architectureDocEnforcement: false`).
 */

import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import {
  isWouldChangeAction,
  planSelfHeal,
  selfHeal,
  type SelfHealResult,
} from '../utils/architecture-document.js';
import { isArchitectureDocumentEnforcementEnabled } from '../utils/configured-paths.js';
import { error, success } from '../utils/output.js';

export function architecture(
  cwd: string = process.cwd(),
  options: { check?: boolean; stage?: boolean } = {},
): Promise<void> {
  if (options.check) {
    return architectureCheck(cwd);
  }
  if (options.stage) {
    return architectureStage(cwd);
  }

  const result = selfHeal(cwd);
  success(`Architecture state document ${result.action}: ${result.path}`);
  return Promise.resolve();
}

/**
 * Commit-time auto-fix. Regenerates a stale doc and stages it into the in-flight
 * commit; leaves a current/`noop`/foreign doc untouched. Never blocks — git
 * failures are swallowed so the commit always proceeds.
 */
function architectureStage(cwd: string): Promise<void> {
  if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
    success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
    return Promise.resolve();
  }

  const result = selfHeal(cwd);
  if (isWouldChangeAction(result.action)) {
    stageDocument(cwd, result);
    success(`Architecture doc ${result.action} and staged.`);
  } else {
    success(`Architecture doc needs no change (${result.action}).`);
  }
  return Promise.resolve();
}

/** `git add` the regenerated doc; best-effort — a git failure never blocks the commit. */
function stageDocument(cwd: string, result: SelfHealResult): void {
  try {
    const relativePath = nodePath.relative(cwd, result.path);
    execFileSync('git', ['add', '--', relativePath], { cwd, stdio: 'ignore' });
  } catch {
    // Outside a git repo, or git unavailable: nothing to stage, never block.
  }
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
