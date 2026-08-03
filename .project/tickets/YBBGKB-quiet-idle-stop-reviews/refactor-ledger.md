# Refactor Ledger — Keep stop reviews quiet until a new user prompt

Scout scope: the marker field, its two hook transitions, and their installed-hook integration tests.

1. [x] **Coverage gap — leaf first:** prove the complete `Stop → UserPromptSubmit → Stop` cycle re-arms generic review, using the installed hooks and a real state file. (Quality-review suggestion; behavior proof only.)
2. [x] **Naming — after coverage:** rename `recordReviewMarker` to describe that it writes both phase-review and idle-review state. (Tier 1; behavior-preserving.)
3. [x] **State writes — hook-local:** batch prompt-hook mutations into one final write so clearing the marker does not add another torn-write window. (PR #1652 review.)
4. [x] **Test home — focused:** move marker-lifecycle coverage out of the frozen transcript-format suite into `stop-hook-idle-review.test.ts`; share its state-path helper between setup and assertions. (PR #1652 review.)
5. [x] **Prompt recovery — hook-local:** retain one final best-effort state write, but run it after reminder derivation so a malformed optional reminder cannot preserve the idle marker. (PR #1652 pass-2 review.)
6. [x] **Closure anchors — durable:** replace pre-rebase GREEN SHAs with their reachable rebased commits and point the matrix at the moved fail-closed test. (PR #1652 pass-2 review.)
7. [x] **Recovery-test precondition — explicit:** seed a downstream pending-learning nudge and assert it remains unseen when malformed cached failures abort reminder derivation. This keeps the recovery regression non-vacuous if failure parsing later becomes tolerant. (PR #1652 pass-3 review.)
8. [x] **State type — honest:** use `QualityState` for the parsed hook state, while retaining the runtime error boundary for stale or malformed on-disk content. (PR #1652 pass-3 review.)

9. [x] **Narrative precision — docs + comment:** state the generic-review trigger as "no resolvable ticket phase" rather than "no active ticket", since `resolveStopPhase` also yields no phase for an in_progress ticket missing `phase:`, any status escape hatch, and a done-status patch/typeless/scenario-less ticket. Type the Stop writer's parsed state as `Partial<QualityState>` so both hooks that read-modify-write the file name the same contract. (PR #1652 pass-5 review; docs + annotation only, no behavior change.)

10. [x] **Rebase evidence — reachable:** retarget all TDD GREEN/REFACTOR annotations to their `git range-diff`-matched commits on the rebased series, so fresh/shallow checkouts can validate the ticket. (PR #1652 rebase review; evidence only, no behavior change.)

11. [x] **Review provenance — explicit:** record the two review-driven sibling-hook comment corrections in ticket scope, refresh the active-ticket timestamp, and reflow the shared JSDoc. (PR #1652 pass-7 review; documentation and metadata only, no behavior change.)

12. [x] **Fixture mechanics — shared:** move the duplicated simple Stop-hook transcript, process, ticket, and state-file mechanics into one test-only helper, while retaining frozen-format fixtures and scenario assertions in their owning suites. (PR #1652 pass-8 review; test structure only.)

13. [x] **State patch — derived:** make `recordStopReviewState` accept a `Pick<QualityState, ...>` rather than restating its two field types. (PR #1652 pass-8 review; type contract only, no behavior change.)

14. [x] **Fixture namespace — canonical:** make the four touched Stop-hook integration suites create `.project` fixtures, exercising the resolver's preferred root while separate namespace tests retain legacy-fallback coverage. (PR #1652 pass-8 review; test fixtures only.)

15. [x] **Fixture process plumbing — leaf first:** replace the `spawnSync`/env/timeout reimplementation in `packages/cli/tests/helpers/stop-hook.ts` with the established `spawnHookScript` from `packages/cli/tests/helpers.ts`; input payloads stay at the call sites. (PR #1652 pass-9 refactor; behavior-preserving.)

16. [deferred] **Template/dogfood hook copies:** do not consolidate `.safeword/hooks/` and `packages/cli/templates/hooks/` — deliberately mirrored installation artifacts that the parity contract validates as separate copies.

17. [deferred] **Cross-hook state writes:** do not extract a shared read-modify-write helper for `stop-quality` and `prompt-questions` — they run independently across lifecycle boundaries, and explicit failure handling keeps the concurrency and recovery behavior reviewable.

18. [deferred] **Transcript writers:** retain the hand-crafted no-edit and frozen real-format transcripts in their owning suite — they encode distinct boundary and format semantics, not generic fixture mechanics.

19. [deferred] **`runStopHook` signature:** keep the two optional trailing positionals. The PR #1652 pass-9/10 review proposed an options object on the estimate of four call sites; the shared helper actually has **18** (13 in `stop-hook-transcript-format.test.ts`, 5 in `stop-hook-idle-review.test.ts`) with only two `undefined` placeholders. An 18-site churn to remove two placeholders is not worth it — reviewer estimate corrected, recommendation withdrawn.

Deferred deliberately: extracting a general read-modify-write helper would make independently running hooks share an abstraction around a known concurrency hazard. The explicit cross-hook writes are safer and clearer at this scope; the prompt hook batches only its own already-loaded state object.

Evidence: package-local Vitest passed the idle-review (3), typecheck (4), phase-backstop (3), frozen transcript (14), and prompt-marker (1) focused coverage after the PR-feedback fixes. The attempted old-head Node 24 rerun was canceled when the corrective branch head pushed; that fresh CI run is the authoritative aggregate evidence.
