# Verified reviewer-fallback delivery

**PR Scope:** ✅ Only the accepted #5086 slice, its bounded quality repairs and evidence are delivered. Main's separately reviewed #5996 dependency fixes are base integration. No #5139, broader parent closure, advisory suppression or unchanged paid qualification.

This closes maintenance delivery J8T2E2 after local verification. It does not close #4200 or 5F5ZZA. Exact-head CI remains mandatory before the separately authorized admin merge of PR #5995.

## Frozen product and commands

Production checkpoint: `5a7f3c6eec014cb7308182a5c1ba0fb57271363c`. Main `65631937a73b8deadfbab5c348b13a14fc02a39b` is the merge commit of PR #5996 (GitHub mergedAt `2026-10-21T05:45:11Z`). PR-side integration merge `23dd979ac122a2e01ac5eb2f2f6900439d29c0ef` has parents `28d06a39ec4c8883e94ad56701d57871bb8173c2` and that main commit. The product checkpoint's sole parent is this PR-side integration merge. These roles were checked with `git show -s --format='%H %P %s'` and `gh pr view 5996 --json mergeCommit,mergedAt`.

All 166 product paths and two dependency files were independently hashed from `git show 5a7f3c6e:<path>` and match the working files and `../5F5ZZA-keep-plan-reviews-current-and-trustworthy/evidence/5086-quality/frozen-product.json.txt`. The manifest's captured HEAD is where the then-uncommitted final product snapshot was taken; its verified product commit is where those exact bytes were committed. Later evidence-only changes must preserve those bytes; CI must independently pass at the final PR head. Criterion mappings below include unchanged regression tests exercised by the full suite; they need not appear in the changed-product path list.

- `scripts/dev bun run test`: exit 0; CLI 717 files, 11,589 passed /14 skipped, 843.37 seconds; relay 198 passed /one skipped; collector 153 passed.
- Package `test:release`: exit 0; 14 files /83 tests, 25.76 seconds. Offline qualification verified; no paid model calls.
- Generated `project test-plan --kind bdd --format sh`, executed through `scripts/dev bash`: exit 0; full package acceptance 601 scenarios /11,821 steps, followed by 51 proof-tag checks. Standard manual/live/proof exclusions remain; this is not the broader epic's deferred native proof.
- Serialized scoped acceptance: exit 0; 123 scenarios /2,488 steps and two hooks.
- Repository lint, all three package typechecks, parity (277 pairs /11 contracts), all five generated surfaces and the full CLI contract check passed.
- Dependency audit passed using CI's existing high/critical threshold and existing two advisory exceptions; this slice adds no exception. Main's #5996 resolves markdown-it 14.3.3 and Vite 8.2.4.
- Quality-follow-up-only audit above PR-side integration merge `23dd979ac`: no dependency violations (84 modules /120 dependencies), no principle/domain/learning findings. This does not re-audit the earlier feature slice; its prior complete-slice code/test reviews are preserved below and its earlier verification is in the parent evidence. Whole-workspace Knip and clone discovery are explicitly outside the diff audit; no improvement count is claimed.
- The test plan also discovers the existing Go checker experiment: Go 1.25.14 compiled it successfully; it reports no test files, not additional behavior coverage.

## Tests and independent review

Criterion-to-proof mapping:

- Cursor/OpenCode: `packages/cli/tests/integration/planning-review-fallback.test.ts`, including the Cursor shell-bridge case without Claude session variables and OpenCode's mismatched/stale receipt refusals followed by successful admission.
- Architecture: `packages/cli/tests/integration/architecture-review-gate.test.ts`, including the witnessed stamp/coordinator model mismatch and retained same-model, missing-model and unwitnessed cases.
- #5957 copies: `packages/cli/tests/integration/native-planning-copy-dispatch.test.ts`, `installed-planning-copy-admission.test.ts` and `planning-contract-generation.test.ts`; their full author-copy checks remain intact.
- #5980 context/dispositions: `packages/cli/tests/integration/planning-review-disposition.test.ts`, `scenario-planning-context.test.ts`, `execution-upstream-planning-context.test.ts` and `packages/cli/tests/review/planning-disposition-identity.test.ts`; semantic invalidation, restoration and disposition behavior remain in the passing full suite.
- Protocol/feedback: `packages/cli/tests/review/codex-app-server-proof.test.ts`, `packages/cli/tests/integration/planning-review-weaker-route.test.ts` and the executable ranked-route BDD prove colliding-request handling, authoritative qualified results and safe earlier feedback.

Both defects were demonstrated before repair: response IDs colliding with server requests, and missing earlier unqualified feedback after a qualified verdict. Initial targeted RED: two failed /15 passed; real-CLI BDD RED: three failed /one passed. The repair passed 17 tests and all four BDD cases; broader protection passed 190 tests.

Follow-up review found the new feedback path bypassed terminal safety. The full attempt was stopped (130), not called green. Explicit RED then demonstrated ESC/bidi leakage. The final repair uses the shared feedback sanitizer, preserves summary/info severity, caps prior errors at warning and bounds the final prefixed message. Plain and unsafe cases pass; every pre-existing unknown-rejection assertion remains intact. Final safety/protocol suite: 18 passed.

Independent headless Claude reviews:

- `7bb0fb9f-b85f-42e9-9e41-154a760c834a`: complete own-slice non-bundled source/guidance approved.
- `9d90fd3d-e74a-4898-b888-7c2a9db3572f`: complete own-slice test diffs approved.
- `fb77b798-6564-4d15-a9ff-7d17979205be`: requested terminal-safety repair; the error was applied, not dismissed.
- `e3cb7c01-6e38-42da-84d4-252b10cf7894`: final incremental code/test repair approved, no errors.
- `c675ff45-eb9a-4e30-940f-b896d115b69a`: final README approved.
- `71bffa74-2c38-4251-89d4-869bcf19406c`: scoped delivery intake approved and authenticated intake stamp recorded before advancing this task.
- `f0973a2b-a5ae-4787-96cf-a2f3e00553ad`: initial verification record approved with traceability suggestions, applied here.
- `31e2687e-4243-47de-aa0e-ff7961501c7e`: requested changes over provenance. Its claim that main `65631937a` preceded #5996 was disproved by Git/GitHub; correct hashes retained. Integration-role, snapshot and audit-scope clarifications were applied; the raw disputed verdict and adjudication are preserved in `git-provenance.txt` and the named raw envelope.
- `1d78d7dc-13b4-4fcb-88ec-f1dabb82da66`: independent re-review confirmed the corrected provenance, counts and scope; approved. Its suggestion to disclose the disputed review is applied above. Bounded review did not independently inspect every referenced raw log/review; those remain available in the evidence archive.

Review packets are immutable checkpoint evidence; no fabricated exact evidence-commit signature or raw compiled-bundle review is claimed. Derived surfaces were regenerated and exercised. Raw envelopes, patches, failures and hash-indexed logs live in the adjacent 5F5ZZA `evidence/5086-quality/` directory.

## Real end-user execution

Ran installed setup with `--agents none`, then the actual planning CLI/job against a deliberately incomplete fixture plan. External Claude failure was deliberately simulated; it is not evidence of a provider outage. One actual fresh Codex context loaded only the serialized packet/instructions/contract as review material and returned six blocking findings. Submitted its exact object unchanged through `review continue`.

The CLI recorded `changes_requested`, actual reviewer Codex and `reduced` independence; status preserved all six findings. Replay returned `errors.REVIEW_CONTINUATION_ALREADY_USED`. The ticket did not advance. Approve-plan refused at the planned-status gate; that command alone does not prove receipt-specific admission. Positive admission and current-policy refusal retain separate real-collaborator integration coverage with external reviewer executables faked.

This was same-agent feedback, not independent review or proof of privacy/isolation. Job/packet/tier/currency/single-use authentication does not authenticate the host's fresh-context or origin claim as an isolation attestation.

## Preserved failures and limitations

The first safety assertion stopped at missing summary count; reordered assertions demonstrated the actual control-character defect. One Python edit anchor missed, applied nothing, and the repeat remained RED. Typecheck caught the unnecessary predicate type guard narrowing later branches to `never`; a boolean return fixed it. Lint found test-literal/spread style conflicts; final Unicode code-point counting and literals pass without changing project lint rules. A formatter invocation could not parse Gherkin; Gherkin lint subsequently passed.

The overlapping BDD attempt failed 13 scenarios, including an explicit absent shared dist entrypoint. It remains failed. Both serialized scoped and complete acceptance runs passed unchanged; no test assertion, retry budget or tool pin was weakened. Manual replay validation first looked for the error under findings; the unchanged raw errors were then validated correctly, without replacing or rerunning the native verdict. A Go launcher path from the leaf directory initially exited 127 before Go ran; the absolute repository launcher succeeded.

Non-blocking review suggestions retained: auth refresh/keyring transport; noncanonical target diagnostics; missing/duplicate final answers and genuine duplicate responses wait for timeout; unsupported server requests requiring replies fail closed; optional complete qualified cross-agent coding-authorization matrix. Existing qualified approve-plan and downstream reduced/policy-refusal proof remains. Repeated sanitization intentionally reuses shared feedback behavior and bounds the final prefix.

README's adjacent planning/non-planning wording, optional display-detail prose, pre-existing phase count and internal Mermaid IDs remain optional editorial suggestions. Current text already distinguishes the planning fallback and non-blocking feedback and does not claim isolation. The BDD fixture intentionally avoids the integration helper's Vitest import; CI rebuilds dist before acceptance, as defined by package scripts and exercised by the authoritative local plan.

Broader R7 retrieval/private injection, R9 recovery wording, historical six failed /585 unfinished cases and 33 deferred ticket cases remain unverified. No fresh 142/142 epic aggregate is claimed. Parent/epic state is unchanged. The lexical corpus remains bounded; collection dates, seals, rescoring lineage and the original model failure are preserved.

## Handoff

All local criteria are met; optional suggestions are applied or explicitly deferred. Fresh self-review inspected the complete final quality delta and base integration, confirmed the frozen product, and found no unrelated source changes. Ready promotion and admin merge still require exact-head CI, an authenticated local completion receipt and the current user authority. No destructive branch/worktree cleanup is authorized.

## Subsequent current-main integration

The preceding full-suite counts and handoff are checkpoint evidence. At `94d859c6e6e9d9c2f7bc08d43b489aca92630ba4`, CI run 39560991441 passed, and checked Ready promotion triggered CI run 39609140651 against that same immutable head. Its first attempt failed one of 83 Node 22 release tests at the unchanged 30-second timeout in `binds the committed catalogue to package version, hooks, inventory, and guidance`; no assertion mismatch was reported. Its single unchanged failed-job retry passed all 83 release tests, with that check taking 21,691 ms. The first failure remains visible at https://github.com/ArcadeAI/safeword/actions/runs/39609140651/attempts/1. The timing cause is unproven; no timeout, assertion or qualification was changed.

The final pre-merge check then found main had advanced with separately reviewed PR #5994. Normal integration merge `41a51f256ae3e0f58b85637f885f110d62f216a0` has parents `94d859c6e6e9d9c2f7bc08d43b489aca92630ba4` and main `7fae8f97fbc30962b916d3b3aba9c61f943ac531`. There were no conflicts. At that integration commit, before adding these evidence notes, the complete binary PR diff against updated main was byte-for-byte identical to the saved pre-integration diff against `65631937a`. All 166 frozen product paths and both dependency files still match the original manifest. That manifest remains an immutable earlier checkpoint, not a claim that main never advanced. Subsequent changes only record this integration and its verification.

PR #5994 changes scenario/proof specifications, their ledger and the contract-generation test matrix; it changes no production code, templates, dependencies, qualification or fallback. Its new supported-declaration control installs pending clauses in all three contracts while every dense rejection assertion remains. The combined branch freshly passes both focused files: 75 tests, exit 0 (21.48 seconds). All five generated surfaces are current, exit 0. No regeneration was needed.

The broad feature now has 54 definitions, 162 unchecked boxes and zero completed. Earlier counts remain historical. The BT1YNY root dry-run recorded at base `150eb7c61` has 176 undefined cases /528 undefined steps; this was not re-measured at `7fae8f97` and is not an acceptance pass. Its R8 conditional-guidance/native-proof targets remain unimplemented and unqualified. The earlier 601-scenario package acceptance result does not prove those root targets. Neither parent nor epic is closed, and no #5139 work is included.

Independent reviews remain evidence for the unchanged own-slice diff, not a new whole-integration verdict. Integration-document review `fe150ae6-387e-48d5-84bd-d8bc3ee3b0c1` approved through a Codex fallback after both Claude routes exited without a review. It was not independent and is not counted as independent coverage; its exact result is preserved. The integration record must receive independent review, and final-head CI remains mandatory before admin merge. Checked promotion already completed on the earlier verified head; the subsequent completion receipt and PR evidence must match the final commit. No release or destructive cleanup is authorized.

CI run 39617800852 completed successfully at `f32f79b3ffa8074205c9c49f5c2a50e2770bd1e0`. Both Node 22 and Node 24 passed 717 CLI files /11,594 tests with 10 skips, physical install and all 83 release tests. Node 24 also passed 601 package acceptance scenarios /11,821 steps and 51 proof checks; Node 22 acceptance is intentionally skipped. Lint, audit, parity, CLI contract and OpenCode conformance passed. This closes the integration's full-regression gap at that checkpoint; a subsequent documentation commit still requires its own final-head CI.

Commit `f32f79b3` directly descends from integration merge `41a51f25` and changes only evidence/documentation paths; the frozen product and dependencies are unchanged. The adjacent `integration-5994-results.json.txt` is the immutable pre-CI snapshot captured for that merge, so its `new_final_head_CI: pending` is historical status. The diff-hash match proves only that the net PR delta was preserved; the 75 focused tests and subsequent full CI provide the interaction/regression evidence.

After Claude sign-in was restored, independent Claude Opus review `aeddcf48-3777-4d91-a265-0a6c1035e3b0` approved both integration documents. Its accidental-heading and CI-head clarity suggestions are applied, and the historical root dry-run's base is explicit. The raw verdict is retained. These notes receive a final bounded re-review; the final-head CI, completion receipt and merge outcome will be recorded in the PR rather than claimed before they occur.
