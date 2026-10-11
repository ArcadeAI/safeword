# Recovery investigation

Decision: find the smallest recovery contract that corrects mistaken annotations and verifies existing behavior without rewriting historical proof or certifying deferred work.

## Investigation plan

- Evidence semantics: what distinguishes a correction, present verification, and genuine historical RED? Inspect ledger parsers and completion checks.
- Authorization and audit: which existing authenticated artifacts can authorize an exact change, and what binds them to the original content? Inspect retrospective receipts and history checks; research append-only correction patterns.
- Delivery and scope: can existing retrospective proof be parameterized without changing CKWE2D's authority? Identify the minimum call sites and retained deferral behavior.
- Recovery ergonomics and cost: compare an exact-ticket extension with a reusable recovery contract and a plain ledger rewrite. Identify stale/replayed approval and accidental blanket-waiver failure modes.

Options to investigate: (1) exact-ticket recovery added alongside existing migration certification; (2) bounded reusable recovery contract with append-only corrections and distinct current-verification proof; (3) direct replacement of checked ledger rows under approval.

No production changes or evidence corrections are authorized by this research document alone.

## Findings and option debate

Direct replacement is the shortest edit and Git would retain a prior commit. However, it conflicts with the installed historical-evidence guard and makes the live ledger stop displaying the mistake. Rejected: recovery must not silently reinterpret checked history.

A reusable recovery framework would avoid another ticket-specific exception. However, the existing retrospective implementation is deliberately fixed to CKWE2D in history, gate, proof, closing proof and authenticated review identity. Turning it into an arbitrary-ticket policy is a larger trust change than #4200 needs. Rejected for this delivery: no universal eligibility engine or freely chosen cutoff.

Recommend an exact-ticket recovery profile for 5F5ZZA, reusing existing authenticated review and proof primitives while leaving CKWE2D's fixed authority intact. This is a proposed contract, not permission to treat 5F5ZZA as CKWE2D. A single trusted profile would bind the exact ticket, ledger, feature, accepted scope and baseline; caller-supplied paths or a ticket frontmatter flag alone cannot grant authority.

Research supports the design principle, not a wholesale framework migration: Microsoft's [event-sourcing guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) recommends compensating records to preserve original events, but warns of substantial architectural complexity. Use that correction principle in a small record, not a new event-sourcing platform. [SLSA verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts) checks trusted identity and subject provenance; by analogy, recovery approval must match the exact scenario and evidence contents rather than a plausible review ID.

## Proposed bounded contract

1. **Annotation correction:** retain the original same-SHA REFACTOR row unchanged. Append one authenticated correction bound to the exact ticket, unique scenario, original row bytes and proposed skip reason. The validated completion view applies that erratum; the display retains both the original and correction. This grants no new RED or GREEN proof.
2. **Current certification:** retain existing RED/GREEN/REFACTOR rows. Approve a distinct VERIFIED claim only after independent eligibility and proof review with an actual passing test and a discriminating negative proof. Label this as current certification, never historical RED. Reuse existing receipt authentication and stale-input rejection.
3. **Accepted deferrals:** retain unchecked entries and original scenario text. A reviewed exact mapping to FC33HK, DRD65E, KKP2R3 and MCWV4B can exclude only the user-deferred cases from the current scope's completion denominator. Report them as deferred and unverified, not checked or certified. A scope/heading/body mismatch blocks closing. This is the additional completion-policy decision that annotation correction alone cannot resolve.
4. **Closing:** evaluate only authenticated corrections, current certifications and exact accepted exclusions; all other unchecked entries continue to block. Keep dependency, verify-artifact, current tests and PR-scope checks. This grants no merge or Draft-to-Ready authority.

## Implementation boundary and discriminating tests

Minimum integration surfaces to evaluate before coding: trusted retrospective profile resolution; existing history/proof/gate/close consumers; a correction-record validator; the shared ledger-validation and done views. Pre-tool historical-row rewrite denial remains intact. Schema registration and all generated surfaces apply if a new shipped helper is needed. Do not reuse the broader delivery approval ledger unless its existing event schema genuinely fits; its authorityRef string is not by itself human authentication.

Tests must distinguish: an approved exact erratum versus changed original bytes/wrong scenario/unauthenticated receipt; current passing characterization versus an unrelated negative failure; accepted exact deferral versus a newly excluded active case; fresh reviewed inputs versus stale or cross-ticket receipts; CKWE2D's unchanged allowed and rejected routes. Include the installed CLI/edit/closing boundary, not only parser fixtures. No expensive model qualification rerun is needed to establish deterministic recovery mechanics.

The existing retrospective proof runner is Vitest-specific and expects exactly one named passing test and one named assertion failure. Root Cucumber evidence cannot simply be fed into that runner. Reuse a genuinely equivalent package test per claim where available; do not build a multi-runner proof abstraction just to mark the ledger complete. Any uncovered behavior remains open.

## Scope and remaining decision

This proposal resolves evidence bookkeeping only. It does not turn the prior 137/142 acceptance run into 142/142, clear historical failures, establish deferred host proof, or provide whole-stack review. The 137 unchecked entries need an itemized reconciliation; they are not 137 automatic certification candidates.

The additional scope decision is whether current-scope completion may exclude the exact 33 already-deferred cases while displaying them as unverified. The existing done gate has no such concept: it rejects any unchecked checkbox. User deferral establishes accepted delivery scope, but does not itself implement this new gate behavior.

Premortem: the profile becomes a blanket waiver through an overly broad scenario match. Mitigation: unique headings plus exact source-body and accepted-scope identity, with every unmapped or changed entry remaining open. No new recovery capability should ship without independent contract review and discriminating tests.

## Investigation checklist

- [x] Frame the decision.
- [x] Compare three concrete options.
- [x] Enumerate evidence, authorization, delivery and maintenance domains.
- [x] Inspect current source and primary external guidance.
- [x] Recommend the smallest bounded approach; isolate its additional completion-policy decision.
