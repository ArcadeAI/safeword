# Resolve inherited verification attempts without claiming child completion

## Root cause

Ready-triggered CI 38914065503 failed its `Ticket closure rides ready PR` step,
before ordinary lint. The unchanged guard treats a changed canonical verify.md
as completion evidence and requires that ticket to be done. It names 7CAMAD,
D1BKYA and G1C9PP; X47AWV's normal closure is not the failing condition.
Draft CI skipped this step, so the earlier exact-head success did not test it.

Ruled out: a lint regression (lint never ran); stale X47AWV closure (the current
receipt is valid and the violation list names only the three inherited reports).
The failing CI log is preserved as
evidence/historical-verification/ready-only-closure-failure.log.gz; its archive
path and decompressed hash are recorded in MANIFEST.json.

## Smallest proposed disposition

Do not mark the three child tickets done. Their reports explicitly retain failed
or incomplete aggregate, scope, installed-runtime or sibling prerequisites.
Completing their full contracts would expand this delivery into unfinished work.

Remove these inherited attempts from the candidate's canonical completion paths,
preserving their exact bytes under this task's evidence/historical-verification/
with a manifest of original path, source commit, SHA-256 and reason. Keep all
child ticket states and behavior ledgers unchanged. X47AWV's current verify.md
remains canonical for this bounded integration delivery; retain all failed-run
links, warnings and the 33 accepted-case deferrals in it and the PR description.

This is acceptable only if it truthfully separates historical attempts from
current completion evidence. It must not become a filename trick to evade an
unmet completion obligation. Independently challenge that distinction before
making the move; if the child reports are required current completion artifacts,
reject archival and report that the landing cannot become Ready within its scope.

The guard, workflow, authorization policy, production code and tests remain
unchanged. Validate the full PR changed-file list through the existing guard,
its regression tests, preservation hashes and normal independent closure review.

## Independent challenge and boundary checks

Claude Opus review b05403de-2eee-4b9c-b874-910c95f3fa4a approved the proposed
distinction, with conditions checked here before archival. The PR base is
d5885e58771cd87f8108196ce67986f7725a1974; all three canonical reports are additions
relative to it, not existing main records being deleted.

7CAMAD remains in verify; D1BKYA and G1C9PP remain in implement. No child phase,
status, accepted behavior or ledger checkbox changes. resolve-verify-ticket.ts
and active-ticket.ts resolve the ticket from its record/session/diff, not from
verify.md. Stop's verify-phase checks require the implemented plan and scenario
ledger, not a successful verify.md. The done gate still requires a new valid
canonical verify.md before any of these children can close. For 7CAMAD, its
current PR Scope failure already prevents closure; absence of that failed report
does not enable a transition. Record an explicit archive link and outstanding
verification obligation in each child ticket so no current failure disappears.

This candidate owns only the integration archive. Original branches retain their
reports, including D1BKYA's diagnostic associated with acceptance-repair PR #4989;
no sibling branch is changed. Future integration must reconcile those reports
under the same unchanged closure guard. Retain the Ready-only failure log with
the archive and name the archive in X47AWV's scope evidence.
