# Review the reconciled delivery

The user requested Verify, Audit, Refactor, Quality Review, green CI and an
admin merge. This supersedes the earlier Draft-only handoff. No merge has run.

Current main is `31befd189`; merge `511201651` retains both runtime tests from
the overlap and regenerates the plugin integrity carriers. All five generated
surfaces are current. Seven targeted files passed 234 tests with two existing
platform skips after reconciliation. Full verification is still in progress.

Review the current bounded source, not the historical failed-state reports as
if they described today's code. Preserve those reports as evidence. In
particular, independent diagnosis `d2aa3731-513b-4bdd-8ee2-c84d967c479e` showed
the old authorization expectation was confounded: an accepted shared-service
decision was already settled. The bank now separates repair of that settled
decision (Execution Planning) from genuinely missing upstream ownership
(Implementation Planning). Judge both inputs for consistency, hidden answers
and discriminating assertions. Do not accept them merely because they pass.

Other changes guard fixture rewrite anchors, isolate missing proof from the
rest of its baseline, name test-runner versus child exits, make documentation
refactoring concrete, and strengthen rationale/two-purpose findings. Full live
reviewer output is retained alongside boolean results for human inspection.
Acceptance results still cannot qualify a production route. Production corpus,
rubric and admission policy are unchanged by this branch.

Refactor `61001cd97` extracts cache retrieval only; the full supporting-proof
identity, distinct whole-corpus identity, failed exits and proof-hook guard
remain. Its 51 focused tests and binding dry-run passed. Challenge whether any
guard or independent oracle was lost. Do not replace independent category
expectations or pre-call snapshots with producer-derived expectations.

Judge the complete current code and regression boundaries, including malformed
input rejection, unchanged argv/JSON escapes, diagnostic propagation, actual
CLI proof/receipt behavior and honest evidence classifications. Seeded review
state in deterministic fixtures is Given setup; only the separate real-reviewer
lane and public-CLI walkthrough exercise real admission. Missing evidence must
stay missing rather than being inferred from registrations or corpus metadata.
