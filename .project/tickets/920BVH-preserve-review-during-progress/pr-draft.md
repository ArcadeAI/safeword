# Preserve planning approval while builders record progress

Addresses one confirmed cause reported in #5766; local delivery ticket:
`920BVH-preserve-review-during-progress`.

Appending progress to a ticket's standard Work Log currently makes an owned
planning review stale. Exclude that history section from semantic ticket
identity so unchanged accepted work keeps its approval. Scope, decisions,
adjacent sections and plans remain bound; real changes still revoke dependent
approval. Generated Claude and Codex runtimes include the same source fix.

Verification: actual public-CLI regression fails before the fix and passes
after it; the final full CLI suite passes 11,624 tests (14 skipped), release
checks pass 81/81, and final focused controls pass 15/15. Changed-file lint,
strict package typecheck and all generated-surface checks pass. Cross-agent
code review `13a94973` and verification review `761cd1ab` approve; earlier
failures and rejected reviews remain retained in the ticket evidence.

Review focus: only an exact level-2 Work Log section is history, including its
nested content. Accepted decisions must remain in the bound contract. Existing
log-bearing approvals may become stale once on upgrade; evidence is not
rewritten. Reverting the source change and regenerating restores old behavior.
This fix does not complete #4200 or resolve every #5766 symptom.

Head: d2100c86948bebb7b80db977600dae0e1157401a (tested code candidate; delivery records remain uncommitted)

1. Ticket linkage — PASS: local authoritative task and #5766 linked above.
2. Author comprehension — PASS: complete eight-file net diff inspected, including generated output; dispatch.js is unchanged from main.
3. End-user execution — BLOCKED: real CLI fixture proves the fix; no completed native planning-approval walkthrough is claimed. Finish that boundary or retain the limitation.
4. Checks — BLOCKED: local checks above pass; no remote branch or current-head CI exists. Push only if authorized, then observe CI without erasing failed runs.
5. AI review — PASS: bounded source/generated code review and separate verification review approve, with warnings retained.
6. Fresh self-review — PASS: final material source diff inspected after locked-dependency regeneration; delivery-only edits still require a final commit check.
7. Merge confidence — BLOCKED: ticket closure and current-head CI remain unestablished; no merge or Ready authority is inferred.

DRAFT — local handoff only; finish the listed evidence and obtain explicit publication authority before creating a remote PR.
