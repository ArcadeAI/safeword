// Safeword: shared done-gate evidence checks.
//
// The done gate is the "you may close this ticket" chokepoint. On Claude Code it
// runs inside the blocking Stop hook (stop-quality.ts). Cursor's `stop` cannot
// block, so the same enforcement is applied one layer earlier — at the edit that
// flips `ticket.md` to `status: done` (the Cursor preToolUse adapter). Both paths
// MUST agree on what counts as evidence, so the shared logic lives here:
//
//   - `checkVerifyArtifact` is the exact PR-scope check the Stop hook uses (it
//     imports this function — there is no second copy to drift).
//   - `evaluateDoneEvidence` is the composite the Cursor edit gate calls. It runs
//     the same dependency -> tests -> verify.md -> scenarios sequence the Stop
//     hook performs inline, returning a plain verdict instead of exiting.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { formatDependencyRecovery, getDependencyReadiness } from './dependency-readiness.js';
import { analyzeScenarioFormat } from './scenario-format.js';
import { runTests } from './test-runner.js';

/** A single line of verify.md that records whether the closing diff stayed in scope. */
const PR_SCOPE_LINE_PATTERN = /^\*\*PR Scope:\*\*\s*(?<status>.+)$/im;

export interface VerifyArtifactStatus {
  ok: boolean;
  reason?: string;
}

/**
 * Validate the PR-scope evidence inside verify.md. The /verify skill records a
 * `**PR Scope:**` line stating whether the closing diff matched the ticket; a
 * missing line or a failed/❌ status blocks done so unrelated work can't ride
 * along in the closing change. Shared verbatim with the Claude Stop gate.
 */
export function checkVerifyArtifact(content: string): VerifyArtifactStatus {
  const prScopeMatch = PR_SCOPE_LINE_PATTERN.exec(content);
  if (!prScopeMatch?.groups?.status) {
    return {
      ok: false,
      reason:
        'verify.md is missing PR scope evidence. Run /verify again so it records `**PR Scope:**` before marking done.',
    };
  }

  const status = prScopeMatch.groups.status;
  if (/❌|piggybacked changes/i.test(status)) {
    return {
      ok: false,
      reason:
        'verify.md says PR scope failed. Revert or split the piggybacked work, or explicitly accept the scope change in the ticket artifacts before marking done.',
    };
  }

  return { ok: true };
}

export interface DoneEvidenceParams {
  /** Project root — where dependencies and the test suite live. */
  projectDir: string;
  /** Absolute path to the ticket folder being closed (holds verify.md, test-definitions.md). */
  ticketDir: string;
  /** The ticket's `type` frontmatter ('feature' | 'task' | ...); features also need scenarios. */
  ticketType: string | undefined;
}

export interface DoneEvidenceVerdict {
  /** True when every applicable check passed and the ticket may be closed. */
  ok: boolean;
  /** Human-readable explanation of the first failing check (undefined when ok). */
  reason?: string;
}

/**
 * Evaluate whether a ticket has the evidence required to be marked done.
 *
 * Mirrors the Claude Stop gate's done sequence — dependencies ready, tests green,
 * verify.md present and in-scope, and (for features) all scenarios complete — but
 * returns a verdict instead of blocking, so the Cursor edit gate can translate it
 * into a `deny` decision. Tests run here ("full" enforcement, ticket AKNWZK): the
 * test suite is the one piece of evidence prose can't fake.
 *
 * Cursor divergence: where the Claude gate falls back to scanning the agent's last
 * message for "X/X tests pass" on a task with no test command, this requires a
 * valid verify.md instead — Cursor's preToolUse payload has no transcript to scan,
 * and verify.md is the stronger artifact anyway.
 */
export function evaluateDoneEvidence(params: DoneEvidenceParams): DoneEvidenceVerdict {
  const { projectDir, ticketDir, ticketType } = params;

  // 1. Dependencies must be installed, or a missing toolchain masquerades as a
  //    test failure (the runner exits 127). A verification gate that cannot run
  //    its check must not pass — fail closed with the install recovery.
  const readiness = getDependencyReadiness(projectDir);
  if (readiness.status === 'missing' || readiness.status === 'stale') {
    return { ok: false, reason: formatDependencyRecovery(readiness) };
  }

  // 2. Tests are the authoritative external gate — they can't be gamed by prose.
  //    skipped=true means no test command exists; verify.md (step 3) carries the
  //    evidence in that case.
  const testResult = runTests(projectDir);
  if (!testResult.skipped && !testResult.passed) {
    if (testResult.toolchainMissing) {
      return {
        ok: false,
        reason: `Test toolchain not found — dependencies are likely not installed. Install them, then retry.\n\n${testResult.output}`,
      };
    }
    return {
      ok: false,
      reason: `Tests failed. Fix failures before marking done.\n\n${testResult.output}`,
    };
  }

  // 3. verify.md — written by /verify when all checks pass, including the PR-scope
  //    evidence that keeps unrelated work out of the closing change.
  const verifyPath = nodePath.join(ticketDir, 'verify.md');
  const verifyContent = existsSync(verifyPath) ? readFileSync(verifyPath, 'utf8') : '';
  if (verifyContent.trim().length === 0) {
    return {
      ok: false,
      reason:
        'No valid verify.md found in the ticket folder. Run /verify to generate evidence before marking done.',
    };
  }
  const verifyStatus = checkVerifyArtifact(verifyContent);
  if (!verifyStatus.ok) {
    return { ok: false, reason: verifyStatus.reason };
  }

  // 4. Features must have every scenario checked off in test-definitions.md.
  if (ticketType === 'feature') {
    const scenarioVerdict = checkFeatureScenarios(ticketDir);
    if (!scenarioVerdict.ok) return scenarioVerdict;
  }

  return { ok: true };
}

/** Require test-definitions.md to exist and have all GFM scenario checkboxes ticked. */
function checkFeatureScenarios(ticketDir: string): DoneEvidenceVerdict {
  const testDefsPath = nodePath.join(ticketDir, 'test-definitions.md');
  if (!existsSync(testDefsPath)) {
    return {
      ok: false,
      reason:
        'Feature done requires test-definitions.md with at least one scenario. Create it before marking done.',
    };
  }

  const { checked, unchecked, isUnrecognized } = analyzeScenarioFormat(
    readFileSync(testDefsPath, 'utf8'),
  );
  if (isUnrecognized) {
    return {
      ok: false,
      reason:
        'test-definitions.md has content but no GFM checkboxes (- [ ] / - [x]). Convert scenarios to GFM task-list items.',
    };
  }
  const total = checked + unchecked;
  if (total === 0 || unchecked > 0) {
    return {
      ok: false,
      reason:
        'Not all scenarios are complete in test-definitions.md. Mark every scenario checkbox [x] before marking done.',
    };
  }

  return { ok: true };
}
