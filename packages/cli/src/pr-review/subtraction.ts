// Reviewing only the gap (ticket 36EEMY, Rule TB1.R1).
//
// The reviewer's value is what a project's own tooling CANNOT tell it. So it
// detects the existing quality surface — linters, types, tests, CI, and peer AI
// reviewers — and subtracts it.
//
// The line is COVERAGE, not mention. A deterministic check that actually
// resolved the concern is coverage. A bot commenting on the same area is not:
// it has neither verified nor resolved anything, and dropping the reviewer's own
// verified, higher-severity version because a noisy bot named it discards the
// strongest signal available — the one most likely to be acted on.

type CoverageState =
  /** A deterministic tooling check resolved it. Real coverage. */
  | 'tooling-resolved'
  /** A code-review bot mentioned it. Not coverage. */
  | 'bot-mentioned'
  /** Nothing else touched it. */
  | 'uncovered';

export interface Concern {
  id: string;
  coverage: CoverageState;
  /**
   * Whether the reviewer's version adds something the covering check did not —
   * verification, or a higher severity. When it does, the concern survives even
   * genuine coverage, because the reviewer is no longer repeating the tool.
   */
  addsNewEvidence: boolean;
}

/**
 * Drop the concerns the project already reports, and keep everything else.
 *
 * A concern is dropped only when BOTH halves hold: the tooling genuinely
 * covered it, and the reviewer has nothing to add. Either half alone keeps it.
 */
export function subtractCoverage<T extends Concern>(concerns: T[]): T[] {
  return concerns.filter(
    concern => concern.coverage !== 'tooling-resolved' || concern.addsNewEvidence,
  );
}
