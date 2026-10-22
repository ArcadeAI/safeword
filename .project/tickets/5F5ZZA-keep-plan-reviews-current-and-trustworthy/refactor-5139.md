# Refactor and subsequent quality review

Scope: complete scout of the authored #5139 branch delta from `origin/main`
merge base `a3c216940`, starting at delivery `d6f84af0a`. This is a
behavior-preserving pass, not qualification repair, #5857 recovery, or a
repository-wide rewrite. Historical evidence and Draft status remain intact.

The refactor skill's producer fan-out supplied separate read-only production and
test/fixture scouts. Mechanical audit found no dependency violations across
551 modules / 989 edges. The starting worktree was clean, so changed-file lint
had no source to fix. Mutation is serial: one change, focused check, scoped commit.

## Complete scout ledger, leaf first

| ID | Smell and location | Disposition / protection |
| --- | --- | --- |
| R1 | Planning-family predicate repeated four times in `src/review/runtime.ts` | Done `fc411daa0`: private predicate; Execution override, stream mode and Codex guard retained; 64 serialized schemas byte-identical; 176 pass / 2 existing skips; five generated surfaces regenerated |
| R2 | Retained-harness environment setup repeated twice | Done `635351af9`: local helper retains explicit replay-env unset; 12 actual-harness/rationale controls pass |
| R3 | Checkpoint identity repeated four times | Done `dfadd6b40`: fresh-value factory avoids shared mutable state; 18 checkpoint cases pass |
| R4 | Valid checkpoint result/output construction repeated | Done `5268d930d`: fresh seed factories; malformed kill fixture and independent corruption retained; 18 pass |
| R5a | Shell reviewer version/help/stdin prelude repeated in three fixtures | Done `146804d92`: shared prelude, existing trusted-bin setup/body retained; 47 pass; full scripts byte-identical with fixed signal witnesses. Pre-extraction commit `c51baba73` adds three passing real-subprocess metadata controls |
| R5b | Same prelude in coding-authorization fixture | Done `afce3a234`: prelude only; scripts byte-identical; three metadata controls plus one real installed coding control pass (16 intentionally filtered) |
| R5c | Same prelude in Execution journey fixture | Done `af9e164c1`: prelude only; scripts byte-identical, three metadata controls pass; contract signals/refusal bodies retained; broader journey admission remains blocked |
| D1 | Evidence nonblank checks repeated in validator and diagnostic | Deferred: tiny predicates serve different validity/diagnostic contexts; a new cross-module API has little payoff and needs broader malformed-plan characterization |
| D2 | Evidence-envelope validation separate from record validator | No change: one envelope implementation, nearby callers; moving removes no duplication |
| D3 | Independent-route exhaustion resembles persisted-job validation | No change: typed route evidence and untrusted persisted objects require different validation; sharing could weaken a trust boundary |
| D4 | Execution model-default second map in policy | No change: it keeps explicit models and route order clear; folding spreads the rule |
| D5 | Currency versus dispatch contract branches | No change: bounded currency and whole-copy integrity are intentionally distinct |
| D6 | Similar Node reviewer shims across context-currency tests | Deferred: independent fixture variants have different context/summary behavior; little payoff without wider characterization |
| D7 | Evidence-boundary test structure | No change: local matrix already expresses dense input partitions clearly |
| D8 | Checkpoint-reader guard sequence / permissive corrupt-input writer | No change: diagnostic order and deliberately malformed fixtures are part of protection |
| D9 | Moving/extracting the hashed live smoke oracle | Deferred: no structural gain sufficient to justify evidence-currency churn |
| D10 | Replay-only collision recovery / qualification corpus relabeling | Excluded by accepted scope and #5857 boundary; no unchanged paid qualification |

No scout findings were silently dropped. No structural change was identified
in author-copy, shared-contract declarations or typed contract definitions.

## Protection and evidence

Baseline: 206 pass / 2 existing skips across five files. Final committed refactor: 209 pass / 2 existing skips across six files; exit 0 in 7.68 seconds. Every serial mutation has a passing focused result before its scoped commit. These are protection runs, not newly invented RED failures. Existing failing qualification,
historical missing RED, GREEN/REFACTOR SHA collision, six historical failures,
585 unfinished checks and 33 deferrals remain unchanged. New characterization
is not historical RED or semantic acceptance proof.

## Quality-review plan (after refactoring)

Challenge Boolean equivalence across provider schema, transport and evidence
boundaries; fresh fixture/environment isolation; exact shell-string preservation;
cleanup symmetry; current dependency/API guidance; and all existing surface and
qualification limits. Use primary documentation and a fresh cross-agent review
of the final committed refactor. Keep each warning's applied/answered disposition.


## Post-refactor checks

- Final protection: six files, 209 pass / 2 existing skips, exit 0. Runtime/output/evidence-boundary, checkpoint, actual retained harness, and shell metadata are included.
- Caller regression: corrected five-file command reproduces 86 pass / 16 fail, exit 1, 41.46 seconds. The exact sixteen failing test names match the archived pre-refactor run: fourteen coding-authorization cases and two Execution journeys remain blocked by unavailable qualified Execution routes. No waiver, admission change, or semantic qualification is inferred.
- An initial regression command named two nonexistent test files; Vitest matched only three files, producing 47 pass / 16 fail. Preserve that incomplete run separately; it is not five-file evidence.
- CLI package typecheck and changed-file ESLint pass. Post-audit has no dependency violations (555 modules / 1,034 edges); diff-scoped Knip, clone and dependency-upgrade discovery are explicitly skipped, not whole-repository clean claims.
- All five generated surfaces are current. Corrected parity command passes all 277 pairs / 11 contracts. The first parity command used a nonexistent package-relative script and exited 1; preserve it alongside the corrected root-script result.
- Project-only preview/apply updates exactly the four installed planning/template copies; no package/configuration/network/destructive effects. No shared-profile activation or repair occurred. Shared official runtime remains SHA-256 `c535706afa985ac3e76fa83b0d033baf9d42ed17eb08a245de1085d9cdc5e6a1`.
- The live oracle is unchanged: SHA-256 `982ed387e7b0ee82465fd1022b37a3047755800d1e6d55f132d0e028c986766b`.
- Latest completed full remote baseline at `d6f84af0a96cfc7ba281ed90f5d8bd23d4b3e024`, run [39696253879](https://github.com/ArcadeAI/safeword/actions/runs/39696253879), has 11,679 CLI passes / 40 failures / 10 skips on both Node22 and Node24; 715 files pass / 8 fail. Relay/collector pass (Node22 relay has one skip). The older 73-failure run remains recorded; neither result is relabeled as current-head green.

Smoke lane `test:smoke:fast`: all 106 files / 2,220 tests pass, exit 0, 49.89 seconds. This is the repository smoke lane, not the full suite.

## Current-source quality challenge

Currency uses the host date 2026-10-22 UTC (2026-10-21 PDT), not a fabricated prompt timestamp. Installed Node24.18.1, Bun1.3.14 and Vitest5.0.3 remain pinned; no dependency or toolchain edit is included.

| Angle | Evidence and judgment |
| --- | --- |
| API currency and supersession | [ECMAScript String.raw](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.raw), fetched this session, specifies raw literals plus stringified substitutions; extracting an already-built prefix preserves backslashes. The full-script comparison is stronger than a prose-only equivalence claim, bounded to fixed contract/proof signal witnesses and unchanged source bindings. |
| Environment isolation | [Vitest stubEnv / unstubAllEnvs](https://vitest.dev/api/vi.html#vi-stubenv), fetched this session, explicitly supports `undefined` unsetting and restoration. The helper preserves the replay reset; the existing real-harness controls retain cleanup and independent collision/mutation inputs. |
| Process boundary | [Pinned Node24.18.1 spawnSync](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html#child_processspawnsynccommand-args-options), fetched this session, supports direct executable/argument invocation, string input and captured result. The new test runs the real installed fixture with existing trusted-directory cleanup; it proves exact metadata results, not input-read timing. No new production entry point exists. |
| Security / version drift | Fresh unrestricted `bun audit --json` exits 1 with the same seven advisories across six packages: 2 high, 2 moderate, 3 low. [Vitest5.0.3 release](https://github.com/vitest-dev/vitest/releases/tag/v5.0.3) and [security policy](https://github.com/vitest-dev/vitest/security) were fetched; supported APIs are not an advisory-free guarantee. [Node's October21 security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), fetched this session, identifies Node24.22.1 as the fixed release and includes high-severity issues affecting 24.x. The pinned24.18.1 is behind that release; defer the pin upgrade to repository toolchain/security ownership, preserve this finding, and do not infer exploitability or resolution from a refactor. |
| Elegance / no bloat | One private production predicate replaces four classifications; one test-only shell prefix replaces three copies; local factories remove repetition without a shared mutable seed. No dependency or general configuration layer. D1–D10 retain explicit trust-boundary and scope reasons for no change. |

### Principle, persona and surface challenge

Read current `project review-knowledge` sources, `PRINCIPLES.md`, configured persona/surface inventories, `spec.md` and `impl-plan.md`. Principle 1 still requires observed boundaries, not self-report: exact schema/string comparisons plus real runtime/parser/harness tests protect this refactor. Principle 6 supports the narrow helper extractions; it does not justify merging typed route evidence with untrusted persisted-job validation. Principles 2–4 remain unchanged: no extra per-turn gates, configuration replacement, scope authority or decision layer. Principle 5 has no new interaction to evaluate.

TBU controls and outputs remain unchanged; SWM gets fewer duplicated definitions with the same generated integrity proof. NTB clarity is experiential and is not demonstrated by these tests; the plan explicitly assigns final wording/comprehension to K3EBHB. No persona walkthrough or Rave Moment is invented.

| Affected surface | Concrete result / explicit limit |
| --- | --- |
| Safeword CLI | Real installed fixture metadata, parser/runtime, retained-harness and checkpoint checks pass; real caller regression retains the same sixteen qualification/admission failures. |
| Claude Code | Shell metadata fixture subprocess passes; external Claude review is review execution, not a native lifecycle or semantic qualification proof. `skip:` no new native session/conformance run for this behavior-preserving delta. |
| OpenAI Codex | Deterministic runtime tests protect app-server route selection and output schema. `skip:` no fresh live model qualification; 38/63 historical collection and stale admission remain. |
| Cursor | Generated/parity checks pass; `skip:` no new native IDE session. Adapter proof remains narrower than native acceptance. |
| Claude Code Cloud / Cursor Cloud Agents | Generated project guidance remains in parity; `skip:` no new external cloud lifecycle execution. Existing fixture evidence does not prove provider execution. |
| OpenCode | Catalogue/guidance preserved; `skip:` independent native dispatch/activation authority remains deferred to YCFFNC, Desktop advisory. |
| OpenAI Codex Cloud / Claude Code on the Web | `skip:` accepted spec marks these unaffected/advisory; no new approval or enforcement claim. |

Independent Claude review job `97c24f49-f80a-4daf-9098-aea74194915e` was dispatched after all refactor commits, targeting the exact authored diff through `af9e164c1` with full relevant source and current spec/plan/persona/surface context. Terminal result: **APPROVE**, actual reviewer Claude / `claude-opus-5`, typed `independence: cross-agent`. No correctness, regression, security or trust-boundary error was found. The target SHA-256 is `92c49a12f29d1559789d995b627e71fee3194e04235f5f50bbf2431b31a219d9` and matched the committed authored diff before the test-only follow-up.


### Independent findings and follow-up

- **Schema precedence warning — answered:** `reviewOutputSchema` retains its explicit Execution-schema ternary. The 64-case before/after schema snapshot is byte-identical, and the reviewer independently verified logical equivalence. A speculative override rewrite adds production/generated churn without changing this accepted behavior; retain the current expression and protection.
- **Payload branch coverage warning — applied:** commit `c228c4356` adds two real fixture subprocess cases with different caller dispatch IDs, exact returned JSON, neutralized fixture override envs, timeout and existing trusted-directory cleanup. They reach stdin reading and dispatch-ID extraction rather than metadata early exits. Both pass, along with the existing three metadata and 44 evidence-boundary cases (49 total). This is characterization of already-working behavior, not fabricated RED. Fresh independent test-only follow-up review `37774c8c-24fd-425b-ab92-2318cf069945` approves the final test, actual reviewer Claude / `claude-opus-5`, `independence: cross-agent`; no production or fixture implementation changed.
- **Inferred helper types / remaining cross-file seed duplication — answered:** local test factory inference retains the original literal widening and fresh-object behavior. Exporting a shared seed or adding another type layer is cosmetic coupling without demonstrated benefit. Keep the scoped local helpers; no production API change.

The four ranked-route BDD scenarios pass with all 88 steps (4.100 seconds); this focused execution does not replace the earlier full601-scenario record or earn model qualification. The four-step difference relative to an older 84-step log are recorded as observed rather than silently substituted.


## Final protection after the review suggestion

Commit `c228c43561ac07ac7fd9d53e616f3bfebf4ff0a0` changes only the shared-prelude test. The six-file repeat now passes 211 tests / 2 existing skips in 7.69 seconds; package typecheck and changed-test ESLint pass. The prior 209-pass result remains preserved as the pre-follow-up protection. No additional production change invalidates the approved refactor's schema, route, environment or shell-byte comparisons. Project-only reconciliation was repeated through the same four-file official/candidate boundary; final parity and all five generated-surface checks pass again. A preservation probe initially named a nonexistent ticket-local feature; the corrected probe checks the actual root feature and confirms original ledgers, feature, live oracle and shared runtime are byte-identical to the baseline.

The scout/serial refactor is complete. Full feature acceptance is not: the same qualification, live-host/privacy, NTB experience, historical RED and ledger deferrals remain. Ticket and parent stay open; PR #6031 stays Draft. No merge or promotion is authorized.


### Follow-up review dispositions

The second Claude pass independently traced the real fixture and found no errors. Its four warnings and three information notes are all answered:

- Capability help text shares the fixture constant: accepted as plumbing characterization, not independent capability sufficiency. Runtime candidate-selection integrations remain the owning proof; no stronger capability claim is made.
- Version/help argument ordering is asymmetric: preserve the existing fixture protocol. Production's observed version probe places `--version` first; the test does not promise metadata support for arbitrary argument order. Broadening that fake protocol would change behavior during a refactor.
- Payload extraction covers compact serialized packets: accepted and stated. Pretty-printed JSON, nested duplicate dispatch keys and hostile shell-fixture input are not claimed; tests use the actual runtime's compact serialization. Do not generalize this trusted fixture into a production JSON parser.
- Trusted home-directory fixture cleanup: retain the actual existing `installReviewer()` factory as the integration collaborator rather than introducing a divergent temporary-root implementation just for this test. Registered directories are removed after each case. A hard-kill cleanup guarantee is unclaimed and remains outside the fixture's existing lifecycle contract.
- Metadata timeout/env asymmetry: those branches exit before reading payload or fixture overrides, and receive EOF stdin. The new payload cases additionally bound process time and neutralize branch-selecting envs because they reach that code. No shared production environment is changed.
- Overlap with the evidence-boundary quality row: deliberate two-value dispatch discrimination is the added proof. The older integration row remains useful for parser/schema behavior; no duplicated capability qualification is counted.
- Prelude filename versus terminal fixture output: the full fixture body is intentionally a real collaborator that makes the prelude's extracted dispatch ID observable. This is integration characterization, not a claim that the terminal verdict body belongs to the prelude.

## Quality Review

**Currency:** ⚠️ Supported APIs verified against current primary docs; Node pin and dependency advisories remain behind current security guidance, with no upgrade in this scoped change.
**Sources:** ✓ Relevant ECMAScript, Node24.18.1 and Vitest docs fetched this session and linked above; repository evidence supports equivalence and exact observed test results.
**Correct:** ✓ Behavior-preserving refactor and final test-only follow-up independently approved; full feature acceptance remains blocked.
**Elegant:** ✓ Private/local helpers preserve existing boundaries and fresh-value semantics.
**No-bloat:** ✓ No dependency, public API, new authority, qualification waiver or general fixture framework.
**Wiring:** ✓ `shell-reviewer-prelude.test.ts` executes the actual fixture and process; runtime, evidence-boundary and retained-harness checks retain real collaborators. No new production entry point.

**Verdict:** APPROVE — scoped refactor and test-only follow-up. This does not approve feature completion, model qualification, Ready promotion or merge.

**Critical issues:** None introduced by the reviewed refactor. Existing security findings, remote failures, qualification gaps and historical evidence defects are retained, not resolved by this verdict.
**Suggested improvements:** Payload coverage applied; remaining non-blocking suggestions answered above. Deferred scout rows remain explicit.
**Provenance:** Primary sources were fetched this session; exact schema/script comparisons, logs, immutable review targets and typed Claude verdicts are archived. No external blocker is inferred from training data.
**Next:** Keep Draft PR #6031 open with its qualification, current CI and historical evidence limitations visible.


## Refactor-head remote CI observation

[Run 39716002672](https://github.com/ArcadeAI/safeword/actions/runs/39716002672) targets `af9e164c1c811c888dfeaf64da4b5c72cd298b1c`, before the test-only follow-up. CLI contract and dogfood parity pass. At the captured snapshot, both Node test jobs and lint remain in progress. Dependency audit fails because the registry request returned HTTP 503, independently of the successful local scan's retained seven advisories. OpenCode conformance has 8 passing tests / 1 failing positive real-host test: the CLI exits 1 with empty stderr where exit 0 was expected. The assertion output does not retain the returned stdout/reason; root cause is therefore unresolved, not declared a refactor regression or a harmless flake. The underlying OpenCode conformance source is unchanged by this refactor. The first log download was refused by gh's terminal-escape guard; a second authorized read strips ANSI from the returned logs and succeeds. Preserve both attempts. Current/future delivery-head CI is not claimed green; the PR remains Draft.


## Evidence archive integrity

All 317 manifest-listed artifacts validate their uncompressed length and SHA-256. The original 261 entries are unchanged; 56 refactor artifacts are appended, with zero matches in the new-artifact credential-pattern scan. The preexisting unindexed `historical-5139-pr.json.gz` is unchanged. Archive validation first rejected an empty successful lint log, then an overstrict disk/manifest equality assumption rejected that preexisting unindexed artifact; both checks were corrected without changing historical bytes. New entries use deterministic gzip timestamps.
