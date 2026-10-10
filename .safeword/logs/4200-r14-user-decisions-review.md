# Recorded, pending and accepted optional scope choices

Native pending review reuses the completed disposition fixture and authenticated
review loop. No decline or acceptance is invented. The actual three app-server
requests must contain no disposition, plan and ticket bytes remain unchanged,
and at least two correctly judged approvals have successful stamps and installed
admission. Failover findings must remain warning/info. The public noninteractive
disposition command then re-presents the authenticated finding as action_required
and pending. This proves presentation on request, not automatic host prompting.

/tmp/4200-r14-pending-pinned-live.json passes one scenario/62 reporter steps;
the stronger actual-wire version /tmp/4200-r14-pending-wire-final.json also passes
one scenario/62 reporter steps in 1m16s. Each includes three real Sol reviews,
three Sonnet judgments and one known-bad control. The first attempt used caller
Codex 0.153.4 instead of the existing caller-only 0.160.0 pin and failed with
process_failed/continuation_required. That report is retained as
/tmp/4200-r14-pending-live.json and is not counted as passing acceptance.

Initial scoped review 68d04e8a-2cc4-4120-bcc8-004d932c1e84 approves with warnings.
Actual-wire pending assertions and failover severity checks address two of them.
Its automatic-presentation concern remains an explicit proof limit: the accepted
public workflow re-presents the choice on request. Exact turn-count/prompt-layout
checks may fail closed on future protocol changes. The semantic digest is checked
by the evaluator and protected tests. Subsequent review
6f53914c-0fd8-462d-aeb3-5ab070161686 became stale while the acceptance fixture
changed its context/corpus; it is not counted as a current approval.

The acceptance case follows the existing authoring workflow. Synthetic explicit
user direction and the authenticated suggestion reference are recorded in the
ticket before authoritative scope and Product Plan boundary changes. Assertions
establish unchanged plan bytes at that point, a changed boundary digest and stale
prior approval. Only then is the plan corrected for manual regional recovery and
submitted to real judged review. No accepted disposition or identity-authenticated
scope-writing command is invented. The corrected plan and acceptance record stay
unchanged through review.

/tmp/4200-r14-accepted-selected-live.json passes one scenario/62 reporter steps
in 1m48s using the existing real Opus/Sonnet evaluator. The earlier mistyped
scenario-name selection ran zero scenarios and supplies no acceptance evidence.
The new oracle permits only the user-accepted manual regional recovery and still
excludes automatic failover, migration and background mutation. Semantic corpus
entries are appended so existing qualification control positions remain intact.
The semantic manifest changes; qualified models, qualification inputs, rubrics
and thresholds do not. No Astra run occurs.

These are characterization proofs, not a production defect RED or completion of
the RGR ledger. Historical six failures/585 unfinished aggregate and remaining
route/retrieval/readiness gaps remain visible. All PRs remain Draft.

Final scoped review 2ae75257-53d9-4055-9b69-8891dfe9c2a7 approves the current
R14 sources and appended semantic cases. It retains the on-request presentation
limit, exact-protocol/timing constraints, small duplicated assertion bodies and
possible observer pipeline orphaning on forced termination. Successful runs
clean owned fixtures and observers. Captured stdin contains synthetic fixture
review requests, not secret-bearing authentication environment or publisher
traffic. This does not prove real-host privacy. No extra process framework or
production hardening is added for these warnings.

Final protected run passes 57 tests across the evaluator, proof-tag and public
disposition integration files. The manifest digest is actually recomputed and
checked by both real evaluator execution and those tests. Fresh root dry run
/tmp/4200-r14-decisions-final-dry.json reports 159 nondeferred cases: 142 bound
skips and 17 undefined. Neither dry skips nor historical failures are passes.
