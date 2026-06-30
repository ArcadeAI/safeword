/**
 * `safeword architecture` — refresh the generated architecture state document(s)
 * (ticket QD5DTT, Slice 1; FPV0E4, Slice 2; XG9SFP, Slice 3).
 *
 * Default mode is a thin CLI entry over `selfHealProject`: re-extracts the
 * skeleton and reconciles prose markers for every node — one doc for a
 * single-repo, or a derived root index plus colocated per-package leaf docs for a
 * monorepo. The SessionStart hook shells out to it so the heal logic lives in one
 * place.
 *
 * `--check` is the CI backstop: a dry-run that writes nothing and exits non-zero
 * when ANY node is stale (a would-change action), so a silently-wrong doc cannot
 * reach the main branch.
 *
 * `--stage` is the commit-time auto-fix: regenerate every stale node via
 * `selfHealProject` and `git add` each into the in-flight commit, so the commit
 * lands fresh. Never blocks (always exits zero). Both gated surfaces honor the
 * per-project opt-out (`architectureDocEnforcement: false`).
 */

import { execFileSync } from 'node:child_process';
import nodePath from 'node:path';
import process from 'node:process';

import {
  isWouldChangeAction,
  planSelfHealProject,
  selfHealProject,
  type SelfHealResult,
} from '../utils/architecture-document.js';
import { discoverUnreadableWorkspaces } from '../utils/architecture-monorepo.js';
import { isArchitectureDocumentEnforcementEnabled } from '../utils/configured-paths.js';
import { error, success, warn } from '../utils/output.js';

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

  const results = selfHealProject(cwd);
  for (const result of results) {
    success(`Architecture state document ${result.action}: ${result.path}`);
  }
  warnUnreadableWorkspaces(cwd);
  return Promise.resolve();
}

/**
 * Print a non-blocking warning for each workspace manager that is present at the root but
 * unparseable (ticket UWP4XK, GitHub #558) — a malformed `go.work`, an unreadable Cargo
 * `[workspace] members`, a flow-style `pnpm-workspace.yaml`. Advisory only: it never
 * changes a command's exit code. Surfaced in every mode (default/`--check`/`--stage`),
 * independent of `architectureDocEnforcement`, because coverage honesty is not enforcement
 * — the architecture map silently omitting a whole language is wrong regardless of opt-out.
 */
function warnUnreadableWorkspaces(cwd: string): void {
  for (const workspace of discoverUnreadableWorkspaces(cwd)) {
    warn(
      `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}). Its packages may be missing from the architecture doc — fix the config and re-run \`safeword architecture\`. (Advisory; nothing is blocked.)`,
    );
  }
}

/**
 * Commit-time auto-fix. Regenerates every stale node and stages it into the
 * in-flight commit; leaves current/`noop`/foreign nodes untouched. Never blocks
 * — git failures are swallowed so the commit always proceeds.
 */
function architectureStage(cwd: string): Promise<void> {
  warnUnreadableWorkspaces(cwd);
  if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
    success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
    return Promise.resolve();
  }

  const changed = selfHealProject(cwd).filter(result => isWouldChangeAction(result.action));
  if (changed.length === 0) {
    success('Architecture docs need no change.');
    return Promise.resolve();
  }

  for (const result of changed) {
    stageDocument(cwd, result);
    success(`Architecture doc ${result.action} and staged: ${result.path}`);
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
 * CI staleness backstop. Exits non-zero when ANY node is stale (would change),
 * passes when every node is current/`noop`/foreign or when enforcement is opted
 * out. Writes nothing — the fix is the human running `safeword architecture`.
 */
function architectureCheck(cwd: string): Promise<void> {
  warnUnreadableWorkspaces(cwd);
  if (!isArchitectureDocumentEnforcementEnabled(cwd)) {
    success('Architecture doc enforcement is opted out (architectureDocEnforcement: false).');
    return Promise.resolve();
  }

  const stale = planSelfHealProject(cwd).filter(action => isWouldChangeAction(action));
  if (stale.length > 0) {
    error(
      `Architecture docs are stale (${stale.join(', ')}). Run \`safeword architecture\` to regenerate, then commit the result.`,
    );
    process.exit(1);
  }

  success('Architecture docs are current.');
  return Promise.resolve();
}
