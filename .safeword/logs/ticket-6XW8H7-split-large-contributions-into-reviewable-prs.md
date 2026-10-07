# Work Log: split-large-contributions-into-reviewable-prs (6XW8H7)

## 2026-09-12 implementation planning

- Parent reconciliation is current and the independently approved scenario
  packet remains authoritative.
- Figure-it-out compared fixed size thresholds, one large sectioned pull
  request, and dependency-ordered conceptual slices. Chose conceptual slices:
  each has one purpose, explicit prerequisites, its own proof, and a safe
  supported post-merge state. Line and file counts remain warning signals only.
- Current evidence: Google's Small CL guidance defines smallness as one
  self-contained change with related tests and a working post-submit system;
  GitHub's stacked-pull-request guidance orders foundational dependencies below
  their consumers and supports independent review and bottom-up merging.
- Premortem: a slice appears independent but hides a runtime dependency on a
  later slice. Mitigate in the contract by requiring prerequisites, proof, and
  supported intermediate state for every slice rather than adding a size
  heuristic.
- Independent plan review `1972f10f-293a-4b2f-8aab-1b314aef689f` requested one
  blocking correction: deterministic fixtures cannot prove that a real model
  applies the conceptual-scope rule. The plan now requires a matched-pair live
  smoke through the CLI boundary and fails that smoke when the load-bearing
  clause is removed. It also names the undecided-design proof case, the
  authoring template's build step, `K3EBHB`'s NTB recovery ownership, and
  `5F5ZZA`'s review-currency ownership.
- Corrected review `349f3536-7ea6-4824-9825-91ff23515672` found the proof table
  still left R2, R3, and R5 open to scripted semantic outcomes. The plan now
  requires per-Rule clause-deletion mutations plus one live positive/defect
  matrix covering all R1–R5 categories, binds proof to each RED/GREEN slice,
  and records the narrow review-coordinator architecture extension.
- Review `9e2e1303-e4b9-4b03-b3a1-a5e0f32ee44a` correctly distinguished verdict
  proof from record-content proof. The plan now uses two live positive plans and
  a defect matrix with field-omission and unresolved-design as separate cases;
  it inspects the positive eligibility, obligation-owner, unchanged-decision,
  and per-slice proof record. The live lane is opt-in operationally but mandatory
  for this child's completion. A fresh `ticket reconcile-parent 6XW8H7` check
  returned healthy, so the historical digest note does not represent current
  parent drift.
- Review `3b3be37c-d37d-4957-a829-ddbbc88e0127` found the remaining positive
  dependency-order proof gap. Added a schema-before-reader live positive record,
  required exact missing-field and obligation names, assigned exhaustive
  examples to deterministic fixtures and representative application to live
  review, and qualified every mutation check as contract-presence proof only.
- Review `d922e688-e007-422f-9fe8-d1abbf1f189f` found two omitted live
  assertions: the two-purpose denial and the unsafe merge's missing prerequisite.
  Added both, moved a minimal cohesion probe ahead of exhaustive fixture work,
  bound mandatory live provenance and fixture digests to `verify.md`, clarified
  `5F5ZZA` versus `G1C9PP` invalidation ownership, made byte/digest comparison
  explicit, and recorded why only representative omission permutations spend
  live-review tokens.
- The branch-built `ticket approve-plan` gate rejected prose-only Design
  alignment evidence even after semantic approval. Replaced every proof cell
  with resolvable Markdown links and moved the `K3EBHB` delegation out of the
  conflict column, preserving the same design while making its trace
  machine-verifiable.
- Exact-byte review `8603d9b3-a164-4590-9420-0688865f3d07` independently
  approved the final Implementation Plan through the branch-built review
  boundary. The canonical helper records the approval as an explicit bootstrap
  skip because installed Safeword 0.83.1 cannot authenticate branch-added
  review target metadata without trusting the code under review.
- Entered implementation with a second explicit bootstrap skip for Execution
  Planning. This ticket creates the first canonical Execution Plan contract and
  `plan-execution` review kind, so later epic tickets must use the shipped gate;
  this ticket cannot use a gate that does not exist yet.
- Executable-RED review `6ca37eec-7fe8-41d4-b8a6-ef0040f50243` confirmed the
  CLI fails at the intended missing `plan-execution` kind, then rejected the
  proposed positive proof because free-text summary substrings could echo the
  input without proving the slicing judgment. Returned to Implementation
  Planning before production changes.
- Figure-it-out compared exact summary labels, informational findings, and an
  optional structured review record. Chose `execution_plan_record`: existing
  review kinds keep their result shape, while an approved Execution Plan must
  expose its slicing decision, rationale, complete slices, dependency safety,
  obligation owners, and unchanged decisions as machine-checkable fields.
  Premortem: adding conditional provider schemas could split Claude and Codex
  compatibility. Fresh OpenAI documentation confirmed strict output requires
  every declared field, so the design now selects a `plan-execution`-specific
  schema with a required nullable field while leaving existing review-kind
  schemas byte-for-byte unchanged. A denial may return null; Safeword requires
  a complete non-null record before accepting approval.
- Independent plan review `3e6f266d-91af-46de-9d15-301e05f6f0bb` caught an
  undecided authority boundary. Resolved it from the parent contract: current
  Execution Plan approval authorizes only entry to implementation, never
  implementation, verification, release, or merge claims, and the epic has no
  second human approval. The typed record is retained in the existing
  integrity-checked review job cited by its stamp; `7CAMAD` owns the coding
  consumer and `5F5ZZA` owns currency and invalidation.
- Independent review `b1634a46-d3fb-455e-aba8-69668ca804e9` approved the
  corrected approach. Applied its useful non-blocking cleanup before stamping:
  named the reviewer-agent result versus unchanged top-level CLI envelope,
  made local review-job retention and fail-closed removal explicit, recorded
  compliance as inapplicable, removed duplicate fixture bookkeeping, and added
  a reassessment trigger for generic rather than specifically named denials.
- Exact-byte review `486a11a7-51a1-47f5-bfb6-9e4056405afb` approved the
  shortened plan. Its final useful warnings made the implementation boundary
  sharper without adding scope: the plan now records local file access and
  rollback, cites the open command-specific `data` slot in the v1 CLI schema,
  distributes live proof across Claude and Codex strict-output routes, and
  rejects vacuous non-null approval records.
- Arcade's Linear Technical Writing Guide and Product and Implementation Plan
  Writing Guide moved test permutations, commands, and build sequencing out of
  the human design path and into Execution Planning. The corrected plan keeps
  one reviewer-output validation contract, human-readable release gates, named
  ownership links, and current approval state.
- Cross-agent plan review `8456fc86-f095-4fea-9937-cd1cfdf6929f` approved the
  exact current bytes with full ticket, scenario, principle, persona, surface,
  architecture, and parent context. Project version 0.83.10 has no installed
  distribution CLI for receipt verification, so the canonical bootstrap skip
  records the review while the source-built approval boundary advances with
  human design approval not required. Current plan digest:
  `18029b477cdb041921f0179decbf103faa37bad68344e3d4d722ea06d1915f13`.
- Execution Planning split implementation into four dependency-ordered,
  independently supported PRs: canonical contract, typed judgment, semantic
  conformance/admission, and auditable CLI activation. Review
  `a83af767-fbd2-4aa8-be5e-8859191fdc62` found no blocking defect. Its useful
  warnings narrowed proof claims, assigned the architecture update and every
  deferred owner, required generated parity and per-slice full tests, and made
  conformance evidence a writer-produced generated manifest whose current
  contract and corpus digests are checked at admission. The explicit bootstrap
  phase skip permits implementation because this ticket creates the first
  `plan-execution` gate.
- Slice 1 packages the canonical Execution Planning contract, artifact template,
  generated reviewer rubric, schema entries, and Claude/Codex/dogfood assets.
  The first full-suite attempt mixed two environmental faults with legitimate
  fixture drift: sandboxed tests could not chmod their `~/.cache` reviewer
  fixtures, and child processes selected Bun 1.4.0 instead of the repository's
  pinned 1.3.14. The same review-wiring file passed 120/120 with normal fixture
  access, and the Codex bundle file passed 18/18 with Bun 1.3.14 first on PATH,
  ruling out contract or bundle logic regressions. Regenerating the lifecycle
  hashes for the two new managed files and the CLI reference, plus restoring the
  complete focused-review fixture clause, resolved the genuine drift. Final
  proof: 612/612 test files green (9,773 passed, 57 skipped), package lint,
  TypeScript, parity, generator freshness, and repository formatting all pass.
- Slice 2 adds a kind-specific strict provider schema and pure classifier for a
  typed `execution_plan_record` while preserving every legacy schema byte for
  byte. Focused judgment and runtime tests passed 101 assertions with two
  intentional skips; package lint and TypeScript passed. The first full run
  exposed two build-artifact issues rather than product failures: the Claude
  bundle had not been regenerated beside Codex, and cache-busted plugin
  generation rewrote unchanged rubric files, making concurrent built-CLI tests
  reject their own fresh build. Regenerated both bundles and made all rubric
  writers content-aware, with a regression assertion that their mtimes remain
  unchanged. Final proof: 613/613 test files green (9,808 passed, 57 skipped).
- Slice 3 admits only exact reviewer identities whose writer-produced evidence
  covers the complete authoritative corpus at the current contract and corpus
  digests. Claude Opus passed all 25 semantic cases; deterministic conformance,
  route-filtering, generation, lint, and type checks passed before commit
  `f6e67f8ad`.
- Slice 4 activates the public `plan-execution` review kind for one ticket-owned
  Execution Plan with its Implementation Plan and scenarios as bounded context.
  The shared coordinator filters configured or built-in routes through current
  admission evidence, the kind-specific validator distinguishes semantic denial
  from malformed output, and the existing job/receipt path retains the typed
  judgment. The complete focused lane passed 442 tests with 2 intentional
  skips; package lint, typecheck, markdownlint, all 266 parity pairs and 8
  contracts passed. After correcting the plan's live-test command to use the
  repository's live Vitest configuration, final packaged bytes passed Claude
  Opus identity plus all 25/25 semantic cases in 739.7 seconds. Evidence digests:
  contract `15507633fda621d9b5b6ec117c3e2687c70af27a16ba18600b2d8a18de19aa9e`;
  corpus `59819df04cc76546ac2a93c3512932040dcf5fe6c8a888b411227ba2f8a4b65b`.
- Independent review `e7af4634-7d00-43e2-9a0c-33697239d6ac` found that
  admission hashed only the specialist rubric even though reviewers receive the
  shared severity foundation too, and that eight positive cases collapsed to
  two distinct inputs. Admission now hashes the complete packet-independent
  prompt contract, every positive scenario carries a distinct decision-relevant
  plan, and Claude Opus passed the strengthened final matrix: 25/25 semantic
  cases in 708.4 seconds. Fresh evidence digests: contract
  `8ac42eac14821a9b2b752a892edfc3aa5c1cbbdf1ee0afdd0e173fe5b5b190dc`;
  corpus `4077d5cab2e60bb889b841e9d9300ca6ed0688426374fe28ecf1c8e745cff5d8`.
