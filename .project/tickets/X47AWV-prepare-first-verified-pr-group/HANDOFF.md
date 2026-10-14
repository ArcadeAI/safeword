# Resume #4200: establish the smallest safe first landing group

## Start here

Branch: `codex/4200-first-merge-group`. This is a work-in-progress integration and investigation branch, not a merge-ready PR. No promotion, merge, release or deployment is authorized. Task X47AWV belongs to epic 82T411 / GitHub #4200; see investigation.md and landing-proposal.md in this directory. The task scaffold remains intake because Safeword rejected canonical ticket edits; do not fake phase or activation evidence.

The candidate integrates #4991 db50bc23db43e59ec5609ad9ff13f820afaf15d8 with #4906 711e324126e937bc2029f4962d6ad2add311fe21, preserving all canonical changes and regenerating five surfaces. Its original other dependencies are #4989 65f7963af95f102999417a42de218649383b36ac and #4990 945c839a28e4e863392da35b1da9164008fb6311. Remote main was d5885e58771cd87f8108196ce67986f7725a1974; recheck before implementation.

## Actual result, not readiness

The four-PR candidate is unsafe as-is. After Execution review requests Implementation repair, the first approve-plan rolls back to plan-implementation; the second unchanged call admits the older approval and advances without repair. The new real-CLI assertion is deliberately RED. Main has no plan-approval.ts command; the candidate introduces the affected path.

A separate native-template lookup failure was reproduced and narrowly repaired using existing higher-stack schema-based lookup. Four targeted files passed 101 tests before the reentry assertion was added. Four root features passed 145 scenarios / 6,769 steps. Neither result overrides the later failing assertion. Raw logs and observed source hashes are tracked in evidence/. Formatting during commit may change source hashes: keep historical hashes as observed, and rerun proof on final candidate bytes before claiming success.

Independent code review e9d48f3b-c391-4a8e-9fed-6fc3ed0de745 confirmed the bypass. Independent proposal review dd57529f-37ec-4802-bead-591bf4ab0f1d challenged premature expansion and the claim that a faithful backport creates another policy. Corrected proposal review 5b763d66-5fbd-4223-987f-d873fe14ea13 approved the revised bounded comparison with no errors. These are proposal/bounded-code reviews, not whole-PR readiness approvals.

## Next authorized work

1. Compare a faithful, complete backport of existing repair with expanding the landing group. Relevant commits: 93781e058 (retained design-changing discovery) and c91547387 (native scaffolding plus legacy reentry refusal), with d74a2dc15 lookup guard. Current-context identity machinery is also involved; do not copy the notice/refusal alone or invent a new timestamp/ledger-order mechanism.
2. Establish exact dependency closure and canonical changed files before choosing. Both repair commits first appear among inspected existing branches at codex/4200-semantic-scope-pr5 (#5139); this does not mean the whole higher group is necessary, verified or ready.
3. Test gate-disabled reentry, gate-enabled reentry with prior approval for identical plan bytes, legitimate fresh-review repair, and whether unrelated reviews can clear a recorded repair. Explicitly resolve or disclose stale discovery versus edited plan bytes. Preserve legacy compatibility policy; do not silently add conversion requirements.
4. Prepare the smaller correct candidate, perform required independent review and verification, then present exact PR heads and limitations for explicit merge approval. Investigation is already authorized; do not ask again just to compare dependencies.

## Separate recovery work

Branch codex/4200-ledger-recovery (Draft #5857) contains the current recovery effort. At remote 66f11753b, CI passed 14 checks with 11 workflow skips; actual Sol and Claude each passed 63 qualification cases plus the guard; actual public CLI acceptance passed 47 scenarios / 3,009 steps. Those runs must not be relabeled as isolated proof for this lower candidate.

The larger recovery observation failed 5 of 142 (137 passed). Later judge/file identity and fixture repairs are work in progress. d5ca8cace is the judge grounding commit; additional fixture corrections are being preserved on that same branch for handoff. Final local full suite after fixture repair was 36 failed, 11,433 passed, 14 skipped. One native negative-case qualification retry failed on DNS and is incomplete. No successful 142-case observation or recovery certificate exists. Do not rerun unchanged paid 63-case qualification merely because independent eval fixtures change. No Astra qualification is required by this handoff.

The whole epic still has five children with 418 undefined scenarios. Original six failures and 585 unfinished historical scenarios remain historical evidence, not erased. Exactly 33 accepted OpenCode/cloud cases remain deferred and unverified; no new deferrals. Bounded recovery policy accepts independently reviewed current proof when historical RED is absent but preserves the history. All epic-related test edits are authorized.

## Environment and preservation

Use scripts/dev with repository-pinned Bun/Node. Never overlap Vitest processes. Run root features from the root with NODE_OPTIONS='--import tsx'. Do not bypass hooks or admission guards. No cache overwrite or shell-profile changes. External Claude review is authorized through the normal coordinator.

GitHub connector last required reauthentication; signed-in browser worked read-only. Local Codex standalone 0.162.1 was verified current through native update; daily maintenance automation exists. Do not create alternate pinned reviewer installations.

The original /Users/alex/.codex/worktrees/4951/safeword has historical ticket edits and untracked review notes; the approval checkout has preserved legacy diagnostic edits. They are separate historical working copies, not candidate changes. Leave them intact; this branch carries the current landing investigation and reproducible regression.
