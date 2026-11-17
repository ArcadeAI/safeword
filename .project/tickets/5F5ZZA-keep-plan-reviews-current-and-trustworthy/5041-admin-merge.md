# Get green and admin merge #5957

On 2026-10-19 the user explicitly requested: “get green and admin merge”. This
supersedes the earlier no-merge/no-promotion instruction for this bounded PR.
It does not close the parent epic or convert deferred evidence into passes.

## Main integration

Starting head: db6bf12b800b0abf308bd97fe97a415f277921c2.
Fetched main: 27890c5243ec7a658317a861530bc9f529a9c2f8 (#5799).
GitHub reported CONFLICTING; CI had no run for the starting head. Merge-tree
preview and the actual merge identified only six generated-file conflicts:
three Cursor lifecycle fixtures, their manifest, and Claude plugin identity and
inventory. Main's stop-hook template and regression tests merged without source
conflicts and match main byte-for-byte.

Resolved the generated files by regenerating all five surfaces in their safe
order. The generator completed successfully and verified its output. Cursor
fixture changes affect tree hashes only; every lifecycle result hash remains
unchanged. Parity passed: 276 pairs and 11 contracts. No manual bundle edits,
test weakening, timeout changes, dependency upgrades, or #5051 work.

## Proof boundary

The current CLI reports all three planning-contract copies current with host
and plugin variables cleared. This proves copy usability, not semantic approval.
Independent Claude/opus refactor review fe34bd12-c6d2-406b-b095-e777a00c53ba
remains fresh and approved against its unchanged test targets.

Prior failed local relay runs, Bun audit advisories, contrary qualification
outputs and parent acceptance/host-proof deferrals remain in verify.md. They
must not disappear from the merge handoff. The existing CI security policy
already excludes two named unpatched advisories; this PR does not change it.
No unchanged paid semantic qualification is rerun.

Combined local regression run: 142/142 tests passed across six files, covering
the three hardened planning/bundle tests, BDD proof tags, documentation readiness
and main's stop-hook transcript regression tests. Raw integration logs and
digests are preserved in `evidence/5041-admin-merge/manifest.json`.

Before the user-requested admin merge: push the integrated head, obtain terminal
green required CI, inspect any review findings, and pin the merge to that exact
head. The final GitHub run and merge records are the authority for those actions;
this pre-push record does not claim they have happened.
