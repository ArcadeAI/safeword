# Remaining #5051 slice from current main

Base: `e7b1f9f9c39da46f954d244d2371aa279ae96c1e` (#5957).
Delivery request: continue epic #4200, only Product/scenario semantic-context
admission and the authenticated disposition command. Draft PR only; no merge
or Ready promotion. Test edits and external Claude review authorized.

## Scope and implementation plan

Reuse main's role resolver, semantic projectors, authenticated job provenance,
canonical contract/copy validation, native context identity and approval repairs.
Enable the existing role graph at Product and scenario dispatch, require its
sources before reviewer execution, and expose typed missing-context recovery.
A marked Product Plan cannot downgrade to generic review when its ticket is
missing. Keep main's strict malformed/opaque ticket ownership checks.

Register the public disposition command. Authenticate a current planning job,
select one optional finding for exactly this ticket's work target, require
interactive confirmation, recheck ticket bytes, accepted-boundary digest and
review currency under the existing exclusive lock, then replace the ticket through a same-filesystem rename. The lock serializes
cooperating disposition writers only; unrelated writers can still race. Preserve prior dispositions and ordinary frontmatter lists. A decline
is scoped reviewer evidence, never a verdict override or scope expansion.

Proof: public installed-distribution reviewer fixtures and CLI/PTY paths,
semantic currency/selected-parent/ownership controls, existing canonical-copy,
native identity and approval regressions, generated-surface checks, complete
repository suite and independent Claude review. No new dependencies or fallback
routes. No template wording, admission corpus, oracle or paid qualification work.

## TDD and limitations

Initial RED: `1d9670061`, five files, 13 intended failures and four passing
controls (`evidence/5051-main/red.log.gz`). Initial GREEN: `cf188cf91`, 17 tests
passed. Repeat-decline RED: `896fef833`, existing YAML collection rejected by
old command (`evidence/5051-main/disposition-red.log.gz`). Fixed collection decoding
through YAML's plain JS representation. Expanded tests also exposed missing
marked-ticket refusal and an incorrect new assertion using the hook's shallow
frontmatter reader for nested disposition records; the assertion now checks
both complete records through the YAML parser. Failed runs remain evidence.

This is a residual delivery slice, not completion of the whole 5F5ZZA ticket or epic #4200. Do not rewrite its historical phase or check off its broad scenario
ledger based on these tests. Existing accepted scenarios/spec and main's
stronger tests are retained. Runtime fixtures prove mechanics, not live reviewer
judgment or human NTB usability.

## Historical evidence remains historical

The read-only dedupe audit in chat `01a145df-9763-70e2-a6cd-297867193c90`
used main `ca452a9cc`; this slice instead starts after #5957. #5051's old head
`11867f743542616868fcb7ae2a59bae741c9c711` is reference material, not merged
wholesale. Its review/CI/qualification does not authenticate this new head.

Retain the audit's six failed and 585 unfinished broad acceptance cases,
418 undefined bindings across five children, and 33 deferred/unverified cases.
R7 host retrieval/private-injection proof remains human-deferred. The old R9
probe rejected a wrong-kind receipt but did not name the mismatch; its old
unapproved patch is not silently imported. #5139's missing historical RED and
GREEN/REFACTOR SHA collision, and #5857's unfinished observation/certification
remain outside this slice. #5086 fallback is excluded.

Main's X47AWV `verify.md`, `ready-closure-disposition.md` and archived
`evidence/historical-verification/` / `evidence/formal-delivery/` preserve failed
verifier/closure runs, scanner findings, incomplete child reports, qualification
limits and contrary observations. Earlier live qualification remains bound to
its original revision, including any contrary judgments; green deterministic
tests do not replace it. No unchanged paid qualification is rerun or upgraded
to a current pass. Main's canonical-copy and authenticated currency separation
remain authoritative.
