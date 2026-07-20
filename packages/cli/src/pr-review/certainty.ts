// Never claiming more certainty than the source supports (ticket 36EEMY, R7).
//
// Intent conformance has two directions and only one of them is safe under a
// granularity mismatch:
//
//   SCOPE        (PR → ticket: "did it do something unsanctioned?") cannot
//                false-positive when the ticket is broader — a subset is still
//                sanctioned — so it always runs at full severity.
//   COMPLETENESS (ticket → PR: "did it do everything?") false-positives
//                whenever the ticket is broader than this PR, which is the
//                common case for epic-granularity tickets.
//
// Measured on the trial corpus: the two PRs that produced false gaps were
// exactly the two whose ticket spanned several PRs. Binding completeness to
// cardinality suppressed both and cost nothing elsewhere.

export type CompletenessSeverity =
  /** Asserted: the ticket is 1:1 with this PR, so a missing item really is missing. */
  | 'finding'
  /** Raised without asserting: the ticket may be broader than this PR. */
  | 'question';

/**
 * Cap a completeness report by how many pull requests reference the ticket.
 *
 * Exactly one means this PR is the ticket's whole implementation, so an
 * unimplemented item is a real gap. Anything else — several PRs, or a count the
 * detector could not establish — means the ticket may legitimately extend
 * beyond this diff, and the report drops to a question.
 *
 * Zero is deliberately treated as unsafe rather than as 1:1. Zero does not mean
 * "no other PRs exist", it means the detector saw nothing; asserting a gap on
 * that is asserting on exactly the evidence we lack.
 */
export function boundCompletenessSeverity(referencingPullRequests: number): CompletenessSeverity {
  return referencingPullRequests === 1 ? 'finding' : 'question';
}
