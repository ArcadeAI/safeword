// Deriving the verdict, and assembling what the reader sees
// (ticket 36EEMY, Rules TB2.R2 and NTB1.R4).
//
// The verdict IS the product. A team reviewing 96% of pull requests and
// requesting changes on 0.5% does not need more to read; it needs to know which
// three of ten to open. So the verdict routes scarce human attention, and it is
// derived from what is unresolved — never from how big the diff is.
//
// Size is deliberately absent from the inputs. Review here is triaged by size
// today (<100 lines draw a human comment 18% of the time, 500+ draw 62%), and
// 11 of 14 small pull requests touching auth or infra drew none at all. That
// heuristic is rational and it has a systematic blind spot; reproducing it would
// rebuild the gap this feature exists to close.

import { type Decision, renderFinding, type ReviewFinding, type Verdict } from './verdict.js';

// `Decision` is owned by verdict.ts and imported, never redeclared: two copies of
// the same closed set are two things to keep in step, and they drift silently the
// first time the set grows.

export interface VerdictInput {
  findings: ReviewFinding[];
  /**
   * An open question the reviewer could not settle — including one it raised
   * about a sensitive surface (auth, permissions, migrations, public API, CI
   * credentials). Distinct from a finding: a question asserts nothing.
   */
  hasUnresolvedQuestion: boolean;
  /** Accepted, recorded, and never read. See the note above. */
  changedLines?: number;
}

/**
 * Route the pull request.
 *
 * An unresolved question routes to a human even with zero findings — which is
 * the rule R9 alone would miss, since R9 keys on whether findings exist. A
 * two-line authorization change the reviewer has an open question about is
 * exactly the case that gets waved through today.
 */
export function deriveVerdict(input: VerdictInput): Verdict {
  if (input.findings.length > 0 || input.hasUnresolvedQuestion) return 'needs-a-human';
  return 'reviewed';
}

export interface ReviewBodyInput {
  findings: ReviewFinding[];
  decision?: Decision;
}

/**
 * Assemble the posted body: the findings, then one routing decision last.
 *
 * Last because a wall of evidence anchors and a one-line stake orients — the
 * reader should be able to stop at the final line and still know what to do.
 * After rather than instead: strip the findings and the decision becomes an
 * assertion the reader cannot check.
 */
export function assembleReviewBody(input: ReviewBodyInput): string {
  if (input.findings.length === 0) return '';

  // Renders through `renderFinding`, NOT `finding.consequence` raw: the raw
  // field omits R14's contested/unchecked annotation, so a body built from it
  // would silently drop the adversary's down-weighting the moment this becomes
  // the wired delivery path.
  const sections = input.findings.map(finding => renderFinding(finding));
  if (input.decision !== undefined) sections.push(`→ ${input.decision}`);
  return sections.join('\n\n');
}

export { type Decision } from './verdict.js';
