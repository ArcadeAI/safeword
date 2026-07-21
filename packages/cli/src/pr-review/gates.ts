// The two gates that EXECUTE code (ticket 36EEMY, Rules TB1.R12 and TB1.R13).
//
// Both mechanize a rule that previously lived in prose and failed in a live
// trial. R12: a true, verified defect was posted on a pull request that merely
// touched the file, and the maintainer called it noise. R13: a true finding
// shipped with a patch that would have made a failure counter unable to
// increment and turned a shipped test red.
//
// They fail in OPPOSITE directions, which is the important thing about them:
//
//   base-repro  fails OPEN  — an unverified finding is merely noisy, and a
//                             dropped one is invisible. Keep it.
//   fix gate    fails CLOSED — an unvalidated patch is the dangerous artifact.
//                             Code blocks are the strongest predictor that a
//                             comment gets applied, so a wrong one LANDS.
//
// Both run sequentially rather than in parallel. Each one builds or tests a
// repository; running twenty at once would put a CI runner under exactly the
// machine overload this project has already been bitten by.

import type { ExecutionTier } from './execution.js';
import type { ReviewFinding } from './verdict.js';

export interface BaseReproGateDependencies {
  /** Does this defect reproduce unchanged on the base branch? */
  reproducesOnBase: (finding: ReviewFinding) => Promise<boolean>;
}

/**
 * Drop findings that are equally true without this pull request.
 *
 * "Would this be just as true if the PR didn't exist?" stops being a judgment
 * the model applies and becomes a check the runner performs.
 */
export async function applyBaseReproGate(
  findings: ReviewFinding[],
  dependencies: BaseReproGateDependencies,
): Promise<ReviewFinding[]> {
  const kept: ReviewFinding[] = [];

  for (const finding of findings) {
    if (!(await reproducesOnBase(finding, dependencies))) kept.push(finding);
  }

  return kept;
}

export interface FixGateDependencies {
  /** Run the tests this patch could break. */
  runAffectedTests: (finding: ReviewFinding) => Promise<{ passed: boolean }>;
  /**
   * Whether executing this pull request's code is permitted at all. `degrade`
   * (a fork) means the gate never runs — see SM1.R3.
   */
  executionTier?: ExecutionTier;
}

/**
 * Withhold any suggested fix that has not been proven harmless.
 *
 * The FINDING always survives — only the patch is at stake. A finding without a
 * fix is still worth a human's attention; a finding with a broken fix actively
 * damages the codebase and the reviewer's credibility at once.
 */
export async function applyFixGate(
  findings: ReviewFinding[],
  dependencies: FixGateDependencies,
): Promise<ReviewFinding[]> {
  const gated: ReviewFinding[] = [];

  for (const finding of findings) {
    // Bounded cost: only a finding that actually carries a patch is worth
    // spinning up a test run for, and most findings carry none.
    if (finding.suggestedFix === undefined) {
      gated.push(finding);
      continue;
    }

    if (dependencies.executionTier === 'degrade') {
      gated.push(withheld(finding, 'fork'));
      continue;
    }

    const passed = await fixSurvivesTests(finding, dependencies);
    gated.push(passed ? finding : withheld(finding, 'failed'));
  }

  return gated;
}

/**
 * Fail OPEN: an infrastructure failure must not silently delete a real finding.
 * Keeping it costs noise; dropping it costs the whole point of having found it.
 */
async function reproducesOnBase(
  finding: ReviewFinding,
  dependencies: BaseReproGateDependencies,
): Promise<boolean> {
  try {
    return await dependencies.reproducesOnBase(finding);
  } catch {
    return false;
  }
}

/**
 * Fail CLOSED: an errored run proves nothing, and "unproven" must never
 * collapse into "safe" for something that will be applied.
 */
async function fixSurvivesTests(
  finding: ReviewFinding,
  dependencies: FixGateDependencies,
): Promise<boolean> {
  try {
    const result = await dependencies.runAffectedTests(finding);
    return result.passed;
  } catch {
    return false;
  }
}

/** Strip the patch and record WHY, so its absence reads as a decision. */
function withheld(finding: ReviewFinding, reason: 'fork' | 'failed'): ReviewFinding {
  const stripped: ReviewFinding = { ...finding, fixWithheld: reason };
  delete stripped.suggestedFix;
  return stripped;
}
