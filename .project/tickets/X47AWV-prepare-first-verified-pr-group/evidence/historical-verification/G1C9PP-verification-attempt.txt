# Verification: Approve coherent Implementation Plans

## Verify Checklist

**Test Suite:** ✓ 66/66 ticket-focused tests pass; the repository-wide aggregate is limited as recorded below
**Gherkin:** ✅ Ticket acceptance behavior passes through the packaged CLI integration tests; the branch-wide Cucumber aggregate is limited as recorded below
**Build:** ✅ The Safeword CLI and both relay packages build successfully; the unrelated website aggregate is limited as recorded below
**Lint:** ✅ Clean
**Scenarios:** All 53 ledger scenarios marked complete (160/160 RED, GREEN, REFACTOR, and cross-scenario ledger rows); they prove the 48 accepted feature scenarios plus five lower-level durability partitions
**Refactor:** ✅ Completed — approval state now has one shared ledger boundary, and each remaining scenario records why no further change was warranted
**PR Scope:** ✅ Diff matches the #4200 epic and this first Implementation Planning slice; sibling changes are the accepted Product Plan and scenario artifacts for the same epic
**Dep Drift:** ✅ Clean — no dependency manifest changed
**Parent Epic:** 82T411 (siblings: 0/10 done before this ticket closes)
**Reconcile:** ⚠️ 3 transitional deviations, 0 missing uplevel ticket — 7CAMAD, 5F5ZZA, and YCFFNC own the named release prerequisites
**Experience:** ✅ No new dead end claimed — walkthrough evidence below records the remaining bootstrap limitation
**Surface Evidence:** ✅ 7/7 affected surfaces have recorded proof or a scope-owned skip
**Evidence limits:** ⚠️ The restricted local environment prevents relay port/process-lock proof; the website lacks its optional `@bruits/satteri-darwin-arm64` binding; the branch-wide Cucumber aggregate contains unrelated undefined/failing scenarios; and installed Safeword 0.83.1 omits review ID/kind/targets from `review status`, so it cannot witness the new exact-content plan-review stamp until the provenance/migration sibling ships

Audit passed with warnings — no diff-scoped architecture, dependency, domain-reference, agent-config, or test-quality error; the principle checker reported only pre-existing findings in unrelated legacy tickets.

## Surface evidence

| Affected surface | Proof command or decision | Result |
| --- | --- | --- |
| Safeword CLI | `bun run test tests/review/plan-data-applicability.test.ts tests/skills/implementation-plan-repair-loop.test.ts tests/review/approval-ledger.test.ts tests/integration/plan-design-approval.test.ts tests/integration/plan-repair-loop.test.ts tests/review/plan-rubric-generation.test.ts` | 66/66 pass against the built CLI and packaged contract |
| Claude Code | `skip: YCFFNC owns installed host delivery and real-boundary proof` | Scope-owned M2 prerequisite |
| Claude Code Cloud | `skip: YCFFNC owns installed host delivery and real-boundary proof` | Scope-owned M2 prerequisite |
| OpenAI Codex | `skip: YCFFNC owns installed host delivery and real-boundary proof` | Scope-owned M2 prerequisite |
| OpenCode | `skip: YCFFNC owns catalogue delivery; Desktop remains advisory until native dispatch is proven` | Scope-owned M2 prerequisite |
| Cursor | `skip: YCFFNC owns installed host delivery and real-boundary proof` | Scope-owned M2 prerequisite |
| Cursor Cloud Agents | `skip: YCFFNC owns installed host delivery and real-boundary proof` | Scope-owned M2 prerequisite |

## Persona walkthrough

Walked the Non-Technical Builder through a rejected plan, the consolidated repair receipt, corrected-byte re-review, and optional human approval. Worst step = a lost approval-fence sidecar currently yields a safe but ineffective generic retry instruction until the provenance/migration sibling supplies an authorized recovery path. New steps vs before = one explicit Implementation Planning review boundary.

Walked the Technical Builder through the same flow with contract digests, exact plan paths, review provenance, decision-owner consequences, and the append-only approval ledger preserved. Worst step = installed 0.83.1 can report the independent approval but cannot expose enough receipt identity to satisfy the new stamp verifier. New steps vs before = one explicit Implementation Planning review boundary; no direct control or evidence is removed.

## Independent review

- Implementation Plan: approved by Claude Opus with cross-agent independence (`4bef5cf0-9ce2-4b40-bf52-b7752a217ced`). The stamp remains unavailable for the installed-runtime compatibility reason in Evidence limits; no substitute stamp was forged.
- Quality review: approved by Claude Opus with cross-agent independence (`e3812ca8-ed2c-479a-b744-20b987ca6a9f`). Review `771c9a2f-4d96-4843-9749-04081b3ee60b` drove the accepted-plan transition fix; review `87007145-8745-467c-8a33-af3fd46898fa` drove the malformed-configuration fail-closed fix; review `cd2ad15b-deed-4232-8d8f-a2546688d3da` drove canonical skill routing through `ticket approve-plan` into Execution Planning; review `2d42981c-40c7-4b5b-b262-43b27870a887` drove discriminating stale-fence proof; review `3302cc31-7e59-4be0-9664-ffb37ee2c33e` drove serialized retry identity and phase reconciliation to the latest durable human decision; review `c0154c6d-a19c-474f-992c-ad58fa33a4f2` drove exact anchoring of authority records so extension events cannot smuggle embedded decisions into current state. The terminal review found no error; its remaining warnings are fail-closed limitations or named sibling scope, so this slice does not broaden to absorb them.

## Current disposition

The G1C9PP implementation slice is functionally complete and ticket-focused evidence is green. It is not independently releasable or ready to mark done while the exact-content approval stamp, repository-wide aggregate evidence, and named sibling prerequisites remain unresolved.
