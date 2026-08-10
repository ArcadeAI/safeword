# Work Log: Retrospective PR-review ground truth

**Anchored to:** `.project/tickets/CWGYH0-pr-review-eval/ticket.md`

---

## Session: 2026-07-26

- Started the falsification-first retrospective validation requested for CWGYH0.
- Read the day-8 frozen-experiment scoring record from `cwgyh0-experiment-scoring`.
- Constraint carried forward: acted-on findings are strong positives; merged-clean outcomes are weak negatives and cannot independently penalize a finding.
- Hygiene carried forward: the original scratch ledger lost its frozen head SHAs; PRs 2073 and 1998 received no trial comment and cannot label comment action.
- Created branch `codex/cwgyh0-retrospective-ground-truth` from the durable experiment-record commit.
- The globally referenced code-philosophy and testing-methodology guides are absent at `~/.agents/coding/guides/`; continuing under the repository's checked-in AGENTS.md and ticket-system instructions.
- Inspected the JSONL structure before designing extraction. The local corpus contains 1,185 `.jsonl` files. The largest target directories are the Arcade monorepo worktree (~366 MiB) and Arcade Way (~267 MiB).
- Extractability confirmed: events preserve timestamps, model identifiers, cwd/branch, typed message blocks, typed tool calls/results, and parent/session IDs. This is sufficient to order a review finding before a later edit/commit without exposing the outcome to the review input.
- Conservative contamination cutoff: 2026-01-31. Sonnet 5 explicitly reports a January 2026 knowledge cutoff in the inspected logs; all pilot changes below are from June/July 2026.
- Found strong-positive candidates directly in Arcade session history: review invocations followed by fixes whose commit bodies record the finding, consequence, fix, and verification. Candidate groups include XBS58Z, 5IMBV1, ZPTV2V, 4147MK, NPVKH6, and D4VYN9.
- The source Arcade worktrees contain unrelated user changes. They will remain read-only; prompt runs will use a temporary local clone pinned to each pre-fix SHA.
- Pre-registered 30 strong-positive labels, four human anchors, five fresh approved/zero-inline-comment silence cases, exact prompt texts/hashes, contamination guards, and a no-composite ranking rule in `retrospective-pilot.md`.
- Completed both prompts on 24 strong-positive labels. Prompt A recovered P22 only; prompt B recovered P20 only. Score: 1/24 vs 1/24.
- The pre-registered rule required A to strictly exceed B, so the experiment stopped before miner work, anchor reruns, or silence-set verification.
- Spot-checked six source-group links against the actual fix diffs and regression changes; all six held.
- A subsequent methodology review found that the pilot cannot support its original falsification claim: the human A-vs-B direction was inferred, not measured; each stochastic prompt ran once; 24 labels were clustered in six diffs; early stopping was incomplete; raw traces were not durable; and the shipped runner was bypassed.
- Corrected the durable verdict to inconclusive. The result does not validate the substitute, establish prompt equivalence, or rehabilitate merged-clean as a negative.
- Compared three repairs under the figure-it-out workflow: minimally salvage the pilot, run a live shadow test, or build a fresh paired buggy/fixed benchmark. Selected the paired benchmark because the other two retain unrepairable human-comparator or weak-negative problems.
- Added `paired-benchmark-v2.md`: fresh cases, deterministic fail-before/pass-after reproduction, a development/scored split, production-runner parity, multiple equal-budget trials, mechanical grading, PR-clustered paired statistics, durable traces, no LLM jury gate, and no score-based early stop.
- Ticket remains in progress; G5337S remains blocked until the replacement benchmark clears its frozen bar.

## Session: 2026-08-01

- Began Phase 0 with isolated `git archive` copies of Arcade snapshots; the
  Arcade working tree stayed read-only.
- Confirmed the shipped reviewer lives on
  `origin/jose/plt-2618-phase1-tool-loop`, not the local Arcade `main` checkout.
  Its `runReview` entry point accepts an injected agent/provider, permitting
  safe runner-wiring validation before any live model call.
- Created `development-cases.json` and `development-cases.md` with five
  development-only pairs. All five had the expected deterministic result:
  old snapshot failed (one by a declared 10-second timeout), fixed snapshot
  passed. The two auth pairs consumed today are now excluded from scored corpus
  selection.
- Rejected the duplicate-auto-disable candidate: its later test cannot compile
  against the old snapshot because the fix also changes a generated return type.
  It is not counted as a valid development pair.
- Exported `origin/jose/plt-2618-phase1-tool-loop` to an isolated directory,
  installed its locked dependencies there, and ran
  `bun --cwd tools/pr-review test test/runner.test.ts`: 16/16 passed. The
  injected fake-agent suite proves routing, tool-read attribution, verifier
  rejection, usage aggregation, and key preflight without a live model. It does
  not yet invoke the five pair fixtures; a benchmark adapter is still needed.
- Created the adapter on isolated Arcade branch
  `codex/cwgyh0-dev-benchmark-adapter`, commit `bad4a27b3`:
  `tools/pr-review/src/eval/development-benchmark.ts` loads a strict manifest,
  passes only `(caseId, reviewBaseSha, sourceSha, variant)` to the executor, and
  writes a separate JSON record containing the parsed report and trace for each
  side. It connects to the real fact-pack and `runReview` pipeline through a
  prepared target checkout while keeping the model agent injectable.
- Added `development-benchmark.test.ts`: a real temporary Git PR runs through
  the detector and runner with only the model boundary faked. It proved the
  tool-read trace reaches the durable record. Full reviewer verification passed
  233 tests; TypeScript and Biome checks passed.
- Corrected the development manifest to include `reviewBaseSha` for every case.
  A pre-fix head alone would make the detector compare a commit to itself and
  review an empty diff; the three-commit record is now explicit.

### Shipping review and refactor scout

- Ran `$safeword:quality-review` with current Bun and Git primary documentation,
  plus the full reviewer test, typecheck, and Biome checks (233 tests passed).
- Found a blocking correctness gap in the isolated adapter: it carries
  `reviewBaseSha` in its input/record but never verifies that `targetFor`'s
  `baseRef` resolves to that SHA. A mistaken ref mapping can therefore run and
  persist a review of the wrong diff. This must be fixed and regression-tested
  before a development run is trusted.
- Found a second reproducibility gap: `runnerRef` is parsed from the manifest
  but is not used or included in each durable output record. The record cannot
  independently identify the reviewer revision that produced it.
- Refactor scout ledger: no behavior-preserving refactor is justified before
  the two functional gaps are addressed. The adapter is compact, has no
  duplicated logic or deep nesting, and its integration test is already at the
  right seam. Per `$safeword:refactor`, no code cleanup was applied because it
  would not resolve either defect.

### Provenance fixes

- Fixed and committed the two review blockers in isolated Arcade commit
  `c9848d72e` (`fix(pr-review): preserve benchmark provenance`). The executor
  now fails closed when the fact-pack merge base differs from the frozen
  `reviewBaseSha`; a real-Git regression test proves the rejection.
- Each saved record now includes the manifest `runnerRef`, structured
  `(expert, provider, model)` identities, and explicit verification/tool-call/
  wall-clock limits. The same limits are passed to the production runner.
- Final verification: reviewer package TypeScript check, Biome check, and all
  234 tests passed. The re-review found no remaining critical issue in this
  adapter scope.

### Phase 0 real-pair dry run

- Created a shared-object temporary clone of the Arcade repository and invoked
  the adapter with a deterministic recording agent. No model/API call or prompt
  scoring occurred.
- The new base-SHA guard exposed a corpus error before a run could be trusted:
  DEV-01 through DEV-04's declared review diffs do not contain their stated
  causal code (two ticket-doc-only diffs, a second ticket-doc-only diff, and a
  `tools/pr-review` diff respectively). Their output records are quarantined;
  they cannot be used for scoring or prompt tuning.
- DEV-05 is the only valid practice pair. It ran through the real Git/fact-pack/
  runner path and retained the base/head, runner ref, model identity, policy,
  and trace. Its deterministic test failed on the buggy snapshot and passed on
  the fixed snapshot.
- Durable details and the rebuild gate are in
  `development-dry-run-2026-08-01.md`. The next task is to rebuild the four
  invalid fixtures from original PR boundaries, then create the deterministic
  matcher and near-miss fixtures before any scored corpus is frozen.
- Rebuild audit refined that task: DEV-01/02 fail the minimal-fixed-twin rule,
  and DEV-04/05 trace to a 2025 introduction and fail the cutoff rule. DEV-03
  was successfully rebuilt at original feature head `78a9544b6`, base
  `e4d86f2c9`, with production-only twin `f9e2254c9`; its regression test
  fails before and passes after. Three fresh post-cutoff candidates are still
  required before the development corpus can be frozen.

### Strategy decision — certification first

- Ran `$safeword:figure-it-out` across evaluation validity, harness/budget
  comparability, contamination, reproducible bug benchmarks, and statistical
  comparison. Selected a certification-first paired benchmark over manual case
  curation or an immediate live prompt trial.
- Recorded the claim, alternatives, mandatory case certificate, execution
  order, and limited-shadow ship criterion in `validation-decision.md`.
- Research anchors: OpenAI's May 2026 evaluation playbook requires the tested
  harness, budget, validity checks, and contamination controls to be disclosed;
  its July 2026 coding-eval audit found about 30% broken tasks in a major
  benchmark. The immediate next implementation is an automated certificate
  gate, then broad candidate mining until five development cases pass it.
- Implemented that first certificate gate in isolated Arcade commit `38de89741`.
  Every manifest case now requires a model cutoff and non-empty causal paths;
  before any reviewer call the adapter rejects a causal path absent from the
  resolved PR diff and rejects a buggy head committed on/before the cutoff.
  The full reviewer package passed 236 tests, TypeScript, Biome, and whitespace
  checks. Added the conservative `2026-01-31T00:00:00.000Z` cutoff to the
  historical development manifest; its known-invalid cases will now fail closed.

### Deterministic scoring gate

- Added a deterministic finding matcher in isolated Arcade commits `bac583a21`
  and `bdf2b6aa9`. A candidate finding earns a hit only when it names a causal
  changed file, a pre-registered failure mechanism, and a pre-registered
  concrete consequence. The matcher has one positive fixture and three
  adversarial near misses (wrong file, missing consequence, and missing
  mechanism).
- Every case now requires a `failureDescription`; the production benchmark
  runner scores the completed report after the model run and persists both
  `namedFailure` and the exact matching findings. The answer key is not passed
  to `runReview`, prompts, or the model. A zero-finding run is recorded as
  unknown/zero evidence, not a negative label.
- Registered DEV-R01's failure description in
  `rebuilt-development-cases.json` and advanced its runner reference to
  `bdf2b6aa9`. Full reviewer verification: 241 passing tests, TypeScript,
  Biome, and whitespace checks.

### Fresh post-cutoff mining

- Mined three independent post-cutoff bug/fix leads with direct `git blame`
  links: Notion inaccessible-database cursor (`a641c2ee4` -> `0705f9659`),
  auth refresh expiry state (`7a59c88534` -> `fa9b13016`), and Linear
  attachment-only update status (`0c2829591` -> `4f3490dab`). Details and
  explicit certification steps are in `candidate-mining-2026-08-01.md`.
- Rejected two superficially attractive Linear fixes because their blamed bug
  lines were introduced before the 2026-01-31 cutoff. This is a contamination
  guard, not a quality judgment on those fixes.
- Added a positive end-to-end scoring assertion in isolated adapter commit
  `80b37070e`: a completed report that names the causal file, registered
  mechanism, and registered consequence persists `namedFailure: true` plus the
  exact finding metadata. Focused adapter test: 8/8 passed; TypeScript and
  Biome passed. The case manifest now points to this runner revision.
- Certified C01 as `DEV-R02-notion-inaccessible-database-never-offers-resume`.
  The original feature PR is `2ae015d..a641c2e`; the causal helper is in that
  review diff and the feature head is after the model cutoff. The production-only
  fixed twin is `f5bb319`. Its regression test passes fixed and fails buggy with
  `next_cursor == 'row-two'`, proving the harmful resume loop. The answer key is
  registered in the rebuilt manifest but remains outside reviewer prompts.
- Certified C02 as `DEV-R03-auth-lost-refresh-token-reports-terminal-reason`.
  The original PR is `9648b1d..7a59c88`; the production-only fixed twin is
  `db86160`. The later fix's own regression test was vacuous because it deleted
  the token before the caller's first read. The replacement test deterministically
  deletes it from `CanRefresh`, between the first read and the under-claim re-read:
  buggy reports `refresh_failed`, fixed reports `no_refresh_token`.
- Recreated the disposable Engine test-template database after proving its cached
  schema predated the feature migration. No persistent/user database was removed.
- Certified C03 as `DEV-R04-linear-attachment-only-update-reports-success`.
  The original PR is `7efc3e5..0c28295`; the one-line production-only fixed twin
  is `f36c122`. The later regression test fails on buggy because a successful
  attachment-only write reports `updated=false`, then passes on fixed. Ruff and
  whitespace checks passed.
- Certified C04 as `DEV-R05-manageauth-open-ended-service-guidance-is-actionable`.
  The original feature PR is `e42f64b..e78b712`; it introduced both open-ended
  reach and the named-service resolution path. The production-only fixed twin is
  `e8181aa`. Buggy returns whole-gateway guidance with no corrective move; fixed
  explains that service names cannot be matched and named tools are required.
  The focused Go test fails buggy and passes fixed.
- Froze the five-case development manifest at SHA-256
  `7bc28edeefcf86b339f29f862e6b88c5bb4a01db0a8464bd5b5714d72c9fbc80`.
  All ten buggy/fixed SHAs passed the production Git/fact-pack/runner path with
  a recording model stub; durable records are in
  `certified-dry-run-2026-08-01-v2/`.
- Live model execution is pending: provider variables are absent from the shell.
  1Password references exist, but the CLI waited for desktop authorization and
  was stopped without exposing values. Deterministic certification continues.
- Completed the v2 three-run reproduction gate for all five development cases:
  15/15 buggy runs failed for their registered reason and 15/15 fixed runs
  passed. Fixed-twin surrounding suites passed: webhooks package, 51 Notion
  workspace tests, auth package, 12 Linear issue-write tests, and manageauth
  package. The Linear historical suite retains unrelated pre-existing
  `AsyncMock` warnings; the new focused test is warning-clean.
- Added a deterministic PR-clustered bootstrap power simulation with 5,000
  experiments per scenario. Froze 30 independent scored cases plus 10 reserves
  and three trials per prompt/variant. Simulated power for a +0.30 paired recall
  improvement is 99.1% at 30 cases; full results and the stringent fixed-twin
  false-positive implications are in `power-analysis-results.md`.
- Preserved every exact reproduction as a separate grader commit whose parent
  is its production-only fixed twin, and recorded all five `testPatchSha`
  values in the manifest. This closed the final scratch-directory durability
  gap without exposing tests or labels to reviewer input.
- The four-call live smoke falsified DEV-R01 before the planned comparison. The
  full prompt found the real durable-write ordering defect on the buggy side,
  but the frozen matcher described a different mechanism and consequence, so
  it scored a miss. The purported fixed twin also renamed a metric and changed
  four files; its grader asserted that rename instead of reproducing the
  registered persistence failure. On the fixed side, the reviewer correctly
  noticed that the rename broke the original metric tests. DEV-R01 is therefore
  invalid and must be rebuilt before any further model calls or scoring.
- Audited DEV-R02 through DEV-R05 against their production twins and grader
  patches. Each grader deterministically exercises its registered failure and
  each twin is narrowly aligned with that failure; no analogous label/test
  mismatch was found. The immediate repair is a focused webhook store stub that
  forces `MarkSucceeded` to fail, proving the deliveries counter must remain at
  zero until the outcome state is durably written.
- Rebuilt R01 under strict RED/GREEN. The external test commit `f1b77b72a`
  fails on the original buggy snapshot 3/3 because it observes
  `deliveries{outcome=succeeded}=1` after `MarkSucceeded` returns an error. The
  production-only twin `cb85dcb7b` changes only `worker.go` (3 additions, 2
  removals) and returns before incrementing on a failed state write. The same
  test patch is preserved above it at grader commit `30e6f09b4` and passes 3/3.
- Replayed the smoke finding through the repaired matcher aliases; it now earns
  the intended hit using only the confirmed finding's causal file, mechanism,
  and reprocessing/double-count consequence. A sanitized recording-agent run
  passed both repaired R01 variants through the production fact-pack/runner
  path with the fixed/grader objects absent. R02-R05 focused graders also pass,
  and all five grader commits have their recorded fixed twin as direct parent.
- Corrected the earlier surrounding-suite claim. The webhook historical
  database tests currently fail unchanged on both buggy and fixed snapshots
  because `ClaimDue` returns no rows; this baseline harness failure is not
  counted as either a regression or a pass. The repaired R01 certificate uses
  a database-free focused test. The superseding manifest hash is
  `edc70d23927bbbc512b7eb7ab01554a7ea1710b60a3f2d5c8e0502b67394ceb9`.
- Ran only the two newly necessary live calls on the repaired R01 fixed twin;
  the unchanged v1 buggy reports were replayed rather than paid for again. Full
  suppressed the named defect but retained four confirmed `info` nits plus one
  pre-existing uncertain item (571,766 tokens); narrow was silent (153,993
  tokens). Rendering correctly headlines “Nothing to act on,” collapses the
  four `info` items, and omits them from Slack.
- Self-verified every full fixed-side claim. The pre-commit enqueued counter is
  a real minor metric skew; outcome-on-span, double duration sampling, and nil
  logger acceptance are literal but below the action threshold; the publisher
  span item is pre-existing and uncertain. None is directly falsified and none
  matches R01. Combined with the unchanged buggy output, the smoke discriminates
  the systems (full hits R01, narrow misses) without treating fixed-side silence
  as evidence. Details: `development-live-smoke-2026-08-01-v2.md`.
- Inspected the actual Claude JSONL schema before building a miner: 1,226 files
  / 1.5 GB; entries expose session/cwd/time, structured tool calls, and linked
  tool results. Added a privacy-minimal log extractor that retains only commit
  SHA, session ID, cwd, timestamp, and edited paths. It never emits prompts,
  reasoning, commands, edit bodies, or outcomes. Two RED/GREEN tests prove the
  extraction and reject commit-like hashes from non-commit commands.
- The three highest-volume Arcade roots yielded 46 logged commit observations,
  but only a handful were product commits; most were arcade-way documentation.
  This confirms logs are useful provenance, not a sufficient corpus by
  themselves. The all-project scan found 11 Arcade-monorepo-cwd observations.
- Added a tested SZZ lead miner for zero-context Git patches. Against 30 small,
  regression-tested fix commits already on `origin/main`, it found 23 with at
  least one blamed post-cutoff introducing commit. Strong early leads include
  the catalog cursor infinite loop (`93df43494` -> `b14d83ebf`), Condex scoped
  search omissions, Slack thread parsing, portal focus theft, Gmail quote
  formatting, Outlook search escaping, Salesforce empty-result indexing, MCP
  discovery/status handling, API-key display-name loss, and audit-disabled
  startup. These are leads only until original PR boundaries, minimal twins,
  and fail-before/pass-after tests are certified.
- Certified the first fresh scored case, S01 catalog-cursor restart. Original
  PR #664 is `f90028e1e..93df43494`, after cutoff. A handler-level external test
  supplies two tools and a cursor beyond the final key: buggy returns the first
  page (`alpha`, `beta`) 3/3, proving a polling loop; the one-line production
  twin `90e07e8ec` initializes the search to `len(allToolDefs)` and passes 3/3.
  The exact grader is `aac81e4a3`, and the full `internal/api` suite passes.
  Registered it in `scored-cases-draft.json`; no model has seen this case.
- Certified S15 from Salesforce feature PR #356
  (`3d916fd27..2bda1c70e`). Its formatter blindly indexes every header split;
  a headerless but valid free-form description raises `IndexError` 3/3. The
  production-only twin `a3cb9bd13` parses only headers that exist, and the exact
  grader `e2694f18b` passes 3/3. All 42 utility tests and Ruff pass. Added it as
  the second draft scored case; no model has seen it.
- Certified S12 from Outlook Mail PR #757
  (`caa4e4789..6c22cbb74`). It passes raw KQL into Microsoft Graph `$search`;
  the external test proves even `from:` is unquoted, the form Graph rejects.
  Buggy fails 3/3; the seven-line production twin `f289535f6` OData-wraps and
  escapes KQL and passes 3/3. All 21 search tests and Ruff pass with the exact
  grader `0031ef4d0`. Registered as draft case three; no model has seen it.
- Certified S17 from GitHub toolkit PR #440
  (`096ec9843..d016b9a0e`). A configured `GITHUB_SERVER_URL` ending in `/`
  remains unnormalized before endpoint concatenation, producing a doubled path
  slash. The external test constructs the complete repository URL: buggy emits
  `https://api.github.com//repos/owner/repo` and fails 3/3; the one-line
  production twin `627c800ff` strips the trailing slash and passes 3/3. The
  exact grader is `590ac9248`; all 37 client tests and Ruff pass. A direct check
  against GitHub's public API returned HTTP 404 for the doubled-slash path and
  HTTP 200 for the normalized path, confirming the user-visible consequence.
  Registered as draft case four; no model has seen it.
- Rejected S14 before writing a grader. The exact string comparison that later
  rejected ephemeral loopback ports was already present in the parent of PR
  #249. Mechanical SZZ blamed a line carried through the large PR, not a defect
  introduced by its diff. This case cannot measure PR-review recall and is
  removed from the live candidate count.
- Certified S18 from MCP discovery PR #459
  (`01708224a..52c0cd897`). The refactor removed the previous direct probes and
  returned an error after only `WWW-Authenticate` and Protected Resource
  Metadata discovery. The external server exposes valid root OIDC metadata but
  intentionally omits PRM: buggy fails 3/3 with “failed to find authorization
  server metadata endpoint.” The production-only twin `0e76bff32` restores a
  narrow direct fallback and the exact grader `58d755822` passes 3/3. The full
  worker-config package and targeted golangci-lint pass. Red and green grader
  patches have identical stable patch ID
  `babd6d9cc9a31f564380d3f5c3efb5b1f42fd5b3`. Registered as draft case five;
  no model has seen it.
- Certified S05 from design-system PR #501
  (`3a155aadc..12d573633`). That PR introduced `PromptInput` with a wrapper
  click handler that always focuses the textarea. React portal events bubble
  through the component tree even when their DOM target is outside the
  wrapper, so a real Chromium click on a portaled button moves focus into the
  textarea 3/3. The three-line production twin `4a4cb170d` checks DOM
  containment and the exact grader `378974372` passes 3/3. The complete browser
  suite, TypeScript check, and targeted Biome check pass. Red and green grader
  patches share stable patch ID
  `17ece03fdad6801f02b6375cfed8b6bcfaa34915`. Registered as draft case six;
  no model has seen it.
- Rejected S04 at fix-diff inspection. PR #1239 does not repair the mined
  “wrong thread/message set” label; it changes datetime parsing, empty-user
  enrichment, and tool instructions. Treating that commit as truth for the
  claimed defect would manufacture a label, so no grader was written.
- Rejected S07 on causality and contamination. The Gmail parser that collapsed
  line structure was introduced on 2025-12-19 (`157f745c53`), before the model
  cutoff; PR #848 did not change that parser or the reply-body builder. It
  cannot be used as a post-cutoff PR-review case even though #1005 later fixed
  the user-visible formatting problem.
- Rejected S16 on original-diff inspection. PR #323 only appended a nolint
  comment to the relevant CORS header slice; the later-repaired wildcard CORS
  behavior was unchanged from its parent. SZZ tracked a touched line, not an
  introduced defect.
- Certified S02 from the original Condex service PR #388
  (`f45e63504..e34706efd`). Its new batch-search builder inserts `INKEYS`
  immediately before `LIMIT` (after `RETURN`/`WITHSCORES`), although the
  FT.SEARCH grammar requires the clause directly after the query. The pipeline
  swallows individual command errors, so scoped retrieval loses candidates.
  The external command-shape test fails 3/3 with `RETURN` at position three;
  the single-file production twin `1d696d682` moves the clause and exact grader
  `e4e8c904c` passes 3/3. The entire Redis-store package passes. Targeted lint
  has one unchanged baseline error for pre-existing unused
  `filterByGateway`; it appears identically on buggy and fixed branches. Red
  and green grader patches share stable patch ID
  `c35f33e2005a009a8ba81fc3b9c9f6edccf7d73e`. Registered as draft case seven;
  no model has seen it.
- Certified the manually repaired API-key display-name case from PR #424
  (`f6fe38a8f..62938ea42`). The old cache is pre-cutoff, but this PR introduced
  `CredentialInfo.display_name` and populated it without extending the cache's
  Pydantic schema. A fake-Redis round trip proves the newly labeled key becomes
  `display_name=None` on the reviewed commit 3/3. The one-line production twin
  `b9dfda564` retains the field and exact grader `a9c1bd437` passes 3/3. Nine
  surrounding API-key service tests and Ruff pass; their import harness needs
  disposable Stripe/Orb and DB/Redis configuration values but makes no external
  calls. Red and green grader patches share stable patch ID
  `76f931c9999f6762ae55b96c7dec30dc518fce36`. Registered as draft case eight;
  no model has seen it.
- Rejected the JWKS first-token flood lead under the cutoff guard. The later
  singleflight fix is valid, but the two unwrapped verifier assignments blame
  to `809bb94b00` on 2025-12-19, before the frozen model cutoff.
- Rejected the user-connections filter lead under the cutoff guard. The dotted
  dashboard parameters predate cutoff (December 2025), and the engine's dotted
  query names date to January 2025; #314 is a later migration, not a valid
  post-cutoff introducing PR.
- Rejected the last-project owner-deletion lead under the cutoff guard. The
  over-broad policy branch later fixed by #883 originates in `99fc6b687` on
  2025-12-16.
- Rejected the static-worker reconciliation lead under the cutoff guard. The
  three unconditional tenant filters later repaired by #591 all originate in
  `2cc158222` on 2025-10-04.
- Expanded the post-cutoff search across 500 fix commits that add tests and
  touch at most eight files, then ran the SZZ candidate miner on the strongest
  results. Fresh concrete leads include nil tool-search-gate fail-open,
  `[object Object]` experience output, case-sensitive tool allowlists,
  Condex pure-negation/dimension handling, telemetry force-flush, protocol
  non-date versions, remote MCP resource indicators, and the 5,000-tool cap.
  These remain outcome-hidden from both reviewer prompts; each still requires
  original-diff causality and an independently red/green grader before it can
  enter the frozen corpus.
- Certified S21 from the per-org tool-search rollout PR #1757
  (`29810f143..d9a82b014`). Its new request gate explicitly returned true when
  no flag reader was wired, enabling discovery for every org on a
  misconfigured deployment. The independent fail-closed grader fails 3/3 on
  the reviewed commit; the one-line production twin plus explicit gate setup
  in old tests ends at `ec41169c6`, and exact grader `dc0743949` passes 3/3.
  The full MCP package and targeted golangci-lint pass. The red and green
  grader patches share stable patch ID
  `ba891dbf9a442cef7188e8e508040dfdcd18e8ea`. Registered as draft case nine;
  no model has seen it.
- Certified S22 from the Playground tool-calling PR #735
  (`d514ef6b8..be7768f69`). That PR introduced the Experience API client with
  `error?: string`, then passed Engine's actual structured error object into
  JavaScript's `Error` constructor. A black-box mocked Engine response makes
  `executeTool` throw `[object Object]` on the reviewed commit 3/3 rather than
  “The email was not found.” The structured-error production twin
  `7c579eefa` and exact grader `beb480e56` pass 3/3; all package tests,
  TypeScript, and targeted Biome checks pass. Red and green grader patches
  share stable patch ID `67e666243ca6855eecc92d29925119af191756e5`.
  Registered as draft case ten; no model has seen it.
- Certified S23 from MCP fast-path PR #1703
  (`c1f013554..d439c91c0`). Its new `ensureToolIsAllowed` compares
  versionless names case-sensitively even though registry resolution uses a
  case-normalized key. A lowercased request for mixed-case allow-listed
  `Slack.SendMessage` is rejected on the reviewed commit 3/3. The one-line
  canonical-key twin `815d6b3a5` and exact grader `5a1381601` pass 3/3; the
  full MCP package and targeted golangci-lint pass. Red and green grader
  patches share stable patch ID
  `50942ec03e7a72aac8e4f3f5a2ff0679682c6a24`. Registered as draft case
  eleven; no model has seen it.
- Rejected the telemetry `force_flush` lead as an unfair review-time target.
  PR #2097 introduced the wrapper while its pinned OpenTelemetry base class
  still allowed the omission; the later failure depends on a future SDK
  making the method abstract. That is useful compatibility testing, but not a
  defect a reviewer of the frozen PR could establish from its then-current
  contract.
- Certified S24 from the stateless protocol dispatcher PR #2131
  (`c691e4131..8dba9ccfd`). Its new router recognizes only date-shaped headers
  at or above the new minimum, so an unsupported non-date claim such as
  lowercase `draft` bypasses the handler that returns protocol-negotiation
  evidence. The focused grader fails 3/3 on the reviewed commit. The later
  contract twin preserves exact `Draft` and headerless legacy traffic while
  routing other non-empty claims to negotiation (`6ea28c385`); exact grader
  `9c497b340` passes 3/3. The full stateless MCP package and targeted
  golangci-lint pass. Red and green grader patches share stable patch ID
  `0581d8686c2196d2d613f57379de6ab020247b1a`. Registered as draft case
  twelve; no model has seen it.
- Certified S25 from the audit-log UI PR #302
  (`52090364a..c70fbe772`). The new diff component serializes snapshots with
  insertion-order `JSON.stringify`, so equal nested objects arriving in
  different map order are handed to the diff viewer as different values. The
  component-level grader observes this false audit change 3/3 on the reviewed
  commit. Recursive stable serialization twin `f04719f8a` and exact grader
  `1b28bff16` pass 3/3; all audit-log tests, dashboard TypeScript, and targeted
  Biome checks pass. Red and green grader patches share stable patch ID
  `10c17d32dbfc3d99e571198b69fe72208ad52e2b`. Registered as draft case
  thirteen; no model has seen it.
- Certified S26 from MCP JIT-scope PR #1812
  (`457588c20..ca393c5cb`). Its new fallback checks only challenge and static
  credential scopes. A mock RFC 9728 server proves metadata discovery succeeds
  and advertises the only valid Power BI scope, yet the reviewed commit emits
  an authorization URL with an empty `scope` 3/3. The production twin retains
  discovered protected-resource scopes without changing explicit empty-slice
  behavior (`b6038e828`); exact grader `ed3158493` passes 3/3. The full worker
  config package and targeted golangci-lint pass. Red and green grader patches
  share stable patch ID `bd14c29cee97b5079cbea1cd92ddc1646ab97334`.
  Registered as draft case fourteen; no model has seen it.
- Rejected four additional SZZ leads under the post-cutoff/original-diff
  causality guard. Deployment idempotency/provider-info behavior repaired by
  `2b0a9c1c5`/`74da30c03`, Google Sheets multi-tab response handling repaired
  by `a10629b10`, coordinator BaseHTTPMiddleware error handling repaired by
  `0c0e730bd`, and gateway tool-version serialization repaired by `ccb82fd22`
  all trace their material behavior to pre-cutoff commits. Later post-cutoff
  edits merely exposed or touched those paths, so blaming those review diffs
  would create false retrospective labels.
- Certified S27 from design-system chat-components PR #501
  (`3a155aadc..12d573633`). The PR introduced a reusable `CopyButton` without
  `type="button"`, so HTML treats it as a submit control whenever a consumer
  places it inside a form. A component-level behavioral grader clicks copy in
  a form and observes the form submit handler firing 3/3 on the reviewed
  commit. The one-line production twin `1bc0c0c2c` and exact grader
  `89ef13cb8` pass 3/3; all 23 design-system unit tests, TypeScript, and
  targeted Ultracite checks pass. The grader patch has stable patch ID
  `5b4635fcf87e550bb7438dc9f7cafdf4cf68b0dc`. Registered as draft case
  fifteen; no model has seen it.
- Certified S28 from the dashboard 404 redesign PR #545
  (`33605ec25..6186a5a16`). The redesigned route re-read mutable
  `history.canGoBack()` on every render, so a transient history change during
  navigation removed the initially available Go Back action. A component
  grader renders with history available, mutates history, then rerenders; the
  action disappears 3/3 on the reviewed commit. The later-contract twin
  freezes the initial history decision with a ref (`aa057894a`); exact grader
  `fef2379f0` passes 3/3, and dashboard TypeScript plus targeted Ultracite
  checks pass. The grader patch has stable patch ID
  `8610b67df0ab48080812f1c44ca10aa49604ef5a`. Registered as draft case
  sixteen; no model has seen it.
- Certified S29 from Confluence direct-children PR #1240
  (`712b1c5ea..3944d1c55`). The new nested output types use
  `typing.TypedDict`; Pydantic explicitly cannot derive their schema on the
  package's supported Python 3.10 runtime and aborts catalog construction for
  `list_direct_children`. Importing the real MCP app under Python 3.10 fails
  3/3 on the reviewed commit. The compatibility twin uses and declares
  `typing_extensions` (`f2801da15`); exact grader `8f40f734e` passes 3/3,
  all 66 Confluence tests pass under Python 3.10, and targeted Ruff passes.
  The grader patch has stable patch ID
  `ab192d106c27356a5c6963beb7d0294e6f6a34da`. Registered as draft case
  seventeen; no model has seen it.
- Certified S30 from MCP discovery PR #665
  (`8e6d3859b..073c387fd`). The new `GetAllToolsSorted` path first asks the
  registry for a toolkit-filtered list, then unconditionally appends every
  Arcade builtin after filtering. With a Math filter and two Math tools, the
  real director returns a third `Arcade.SearchTools` entry 3/3 on the reviewed
  commit. The later-contract twin removes that cross-path merge
  (`a5c4d499c`); exact grader `e3dd192e4` passes 3/3, the full directors
  package passes, and targeted golangci-lint reports zero issues. The grader
  patch has stable patch ID
  `868fa01453afdd05be98feebaa1f2639c8d7f8cc`. Registered as draft case
  eighteen; no model has seen it.
- Rejected three more attractive-looking fixes because the faulty production
  behavior predates the cutoff: MCP header deletion cleaning repaired by
  `aaf257838` traces to September/October 2025, the missing gateway execution
  user ID repaired by `6f0a8a0ec` traces to October 2025, and raw `json` schema
  type emission repaired by `f1684d425` traces to 2024. The later commits are
  valid fixes but cannot label a post-cutoff review diff.
- Certified S31 from hidden-toolkit cache PR #657
  (`8f40fee2a..ad52c2b0b`). Moving filtering into React Query's `select` option
  fixed the stale-cache problem but supplied a new inline selector on every
  hook render. A hook-level grader holds the hidden set constant and proves
  selector identity changes across a rerender 3/3 on the reviewed commit—the
  mechanism behind the recorded infinite rerender. Memoized-selector twin
  `760fde0ca` and exact grader `3f8d0e649` pass 3/3; all 65 ui-kit unit tests,
  TypeScript, and targeted Ultracite checks pass. The grader patch has stable
  patch ID `3448af3520f09919af77c4a1b944d3f2f6be5583`. Registered as draft case
  nineteen; no model has seen it.
- Certified S32 from the engine database-creation opt-out PR #1335
  (`1fdb4e43c..258d0cd75`). The PR added `--create-db=false` so restricted
  managed-Postgres roles could skip `CREATE DATABASE`, while the existing Helm
  value `engine.database.create` remained disconnected from both engine
  startup and the migration job. Rendering the real chart with that value set
  false produces zero `--create-db=false` arguments 3/3 on the reviewed
  commit. The production twin is byte-for-byte equivalent to independent fix
  #1338 for the two templates (`81132440e`); exact grader `8959391ba` passes
  3/3, `helm lint` passes, and a default full-chart render succeeds. The grader
  patch has stable patch ID
  `d99ca6e643e37f10cea910eb684ed49ee1d9a1e8`. Registered as draft case
  twenty; no model has seen it.
- Certified S33 from the Connect to Tools dialog PR #510
  (`c709a0041..b3662d6ed`). The new framework picker displayed
  `npx @arcadeai/create-agent --framework ...`, but create-agent's supported
  selector is `--template`; every framework choice therefore produced a
  command the CLI rejects. A component grader replaces only presentation
  dependencies and inspects the command produced by the real picker. It fails
  3/3 on the reviewed commit and passes 3/3 with one-line production twin
  `3b6fb3613`, whose production patch ID exactly matches independent fix #840.
  All 65 ui-kit unit tests, TypeScript, and targeted Biome checks pass. The
  grader patch has stable patch ID
  `0a361d842a67defa84d51e6212efe1ecfb197bb2`. Registered as draft case
  twenty-one; no model has seen it.
- Repaired the Experience API bytecode SZZ boundary before certification. The
  Dockerfile's `--bytecode` flag originated in PR #353, but that commit's
  entrypoint had no top-level await and compiled under its then-current
  contract. The reviewable regression begins in OTel PR #953
  (`8062ffb6e..04d4e4dbd`), which introduced `await import("./app")` while
  retaining the existing bytecode production build.
- Certified S34 from that OTel PR #953. Running the production compilation
  mode against the real entrypoint fails 3/3 on the reviewed commit with
  `await can only be used inside an async function`. The one-line production
  twin drops bytecode from the Docker build (`ef19a34ad`), exactly matching
  independent fix #1008 by stable production patch ID; the grader passes 3/3,
  Experience API TypeScript passes, and the shell grader passes ShellCheck.
  The grader patch has stable patch ID
  `2d4414bd9727ebb307209c5e066719246875dff7`. Registered as draft case
  twenty-two; no model has seen it.
- Certified S35 from onboarding progress PR #729
  (`e83bb5561..1d9b0d374`). The new component checks only whether `data` is
  truthy, then immediately calls `findIndex` and `map` on `data.steps`; a
  partially serialized response therefore throws and the shell's error
  boundary hides the progress bar. A component grader supplies that exact
  response and observes React's caught render error 3/3 on the reviewed
  commit. The one-line production twin guards `data?.steps`
  (`e132d932f`), exactly matching independent fix #843 by stable production
  patch ID; the exact grader passes 3/3, dashboard TypeScript passes, and
  targeted Biome checks pass. The grader patch has stable patch ID
  `f1f89832a9e9ef35847923555450f384e0dfb861`. Registered as draft case
  twenty-three; no model has seen it.
- Certified S36 from the monorepo Helm-chart import PR #895
  (`2b0a9c1c5..31fb16f13`). The new values file defaults `environment` to
  `prod` and renders that into Coordinator's `ENVIRONMENT`, while the existing
  Coordinator configuration accepts only the literal values `dev` and `pro`.
  A cross-artifact grader renders the real chart and extracts the allowed
  values from the service's Python AST; it rejects `prod` 3/3 on the reviewed
  commit. The one-line production twin uses `pro` (`881faaa3f`) and the exact
  grader passes 3/3; Helm lint, a full default render, and Ruff pass. Later fix
  #1325 makes the same value correction, though its textual patch ID differs
  because an intervening commit changed the adjacent comment. The grader patch
  has stable patch ID `7a4a772a75ae90bca901b494f2c157d43c46eaf8`.
  Registered as draft case twenty-four; no model has seen it.
- Certified S37 from correlation-telemetry PR #1131
  (`65302ac10..cfda25977`). The PR adds `arcade-telemetry` as a local uv path
  dependency of Coordinator, but its Dockerfile still copies only the protos
  path before the dependency-install layer. A cross-artifact grader reads all
  `[tool.uv.sources]` paths and verifies that the Dockerfile copies them before
  the first `uv sync`; it reports the missing telemetry directory 3/3 on the
  reviewed commit. Production twin `f185f236e` and exact grader
  `981458805` pass 3/3, Ruff and diff checks pass, and the production patch ID
  exactly matches independent fix #1308. The grader patch has stable patch ID
  `8a81a20d31da64f831365df2babdc82b92d1dd1f`. Registered as draft case
  twenty-five; no model has seen it.
- Rejected the API half of onboarding null-response fix #1039 as a separate
  case. A direct Elysia reproduction shows that adding the response schema does
  not independently make a null handler body serialize as JSON under the
  actual framework behavior. The effective client-side `?? null` repair maps
  back to PR #729, which is already represented by S35, so another label would
  blur causality and overweight one original PR.
- Certified S38 from PostHog toolkit PR #686
  (`f5ce551c0..f6c9809b1`). The new HTTP helpers strip trailing slashes from
  `POSTHOG_SERVER_URL` but do not add a scheme, so a host-only secret such as
  `us.posthog.com` remains invalid for httpx. The external helper grader
  returns that real base URL and fails 3/3 on the reviewed commit. Production
  twin `834cebeeb` normalizes every introduced use to HTTPS and the exact grader
  passes 3/3; all 175 PostHog tests pass, and targeted Ruff passes with the
  unrelated historical UP038 finding explicitly ignored. The grader patch has
  stable patch ID `a471df304b975eb8d6e2b0420532113fe068b9bd`.
  Registered as draft case twenty-six; no model has seen it.
- Certified S39 from MCP client-install UI PR #203
  (`8c3be9750..56887dee9`). The generated Claude Code command begins with
  `ARCADE_API_KEY=<your-api-key>`; POSIX shells interpret the unquoted angle
  bracket as input redirection, so copying the displayed command fails before
  the `claude` executable runs. An external grader executes the real generated
  command with a harmless Claude stub and reproduces `/bin/sh: your-api-key: No
  such file or directory` 3/3 on the reviewed commit. The one-line production
  twin `751ce2848` puts the placeholder inside the quoted Authorization header;
  exact grader `9b9625119` passes 3/3, dashboard TypeScript and targeted Biome
  checks pass, and the production patch ID exactly matches independent fix
  #329. The grader patch has stable patch ID
  `f9eee39a111120702fce1fcd3bf023f05fbe9e7b`. Registered as draft case
  twenty-seven; no model has seen it.
- Certified S40 from audit-log publication PR #294
  (`fb53c4324..7c14cc76c`). Gateway audit sanitization puts a non-empty tool
  allow list into the protobuf-bound audit map as `[]string`, but
  `structpb.NewStruct` accepts list values only as `[]any`. An external grader
  exercises the real update audit-event path and gets `proto: invalid type:
  []string` 3/3 on the reviewed commit. The one-line production twin changes
  the intermediate slice type (`2a9a7a047`); exact grader `6013be6ea` passes
  3/3, the full gateway package and targeted golangci-lint pass, and its
  production patch ID exactly matches independent fix #347. The grader patch
  has stable patch ID `72f4da6a1b7f75f64a792f4d29063a0ee90d7a92`.
  Registered as draft case twenty-eight; no model has seen it.
- Certified S41 from playground execute refactor PR #225
  (`856911a87..b333cd2a7`). The new client adapter stringifies every value
  except `undefined`, so an optional form field left as `""` is sent as an
  explicitly supplied tool argument. A hook-level grader drives the real
  `executeTool` callback and observes the blank optional value in the Arcade
  client request 3/3 on the reviewed commit. Production twin `5760a4f1d`
  applies the later input-normalization contract; exact grader `e6d38cadb`
  passes 3/3, dashboard TypeScript and targeted Biome checks pass, and later
  fix #299 records the same empty-string repair while also refactoring nearby
  toolkit code. The grader patch has stable patch ID
  `b5958a87e7901e5686dc969ae00c5ddfadbd4a3c`. Registered as draft case
  twenty-nine; no model has seen it.
- Certified S42 from chat UI-boundary refactor PR #873
  (`e84c6c21c..5fa0f64c7`). The new OrganizationSwitcher selection callback
  awaits route resolution inside `try/finally` but has no catch; a network
  failure closes the dialog and rejects the UI callback without telling the
  user. A component grader drives the real callback with a rejected resolver
  and observes the escaped rejection 3/3 on the reviewed commit. The
  three-line production twin `7af2f7a17` catches the failure and emits the
  recorded toast; exact grader `a30d50664` passes 3/3, targeted Biome passes,
  and the production patch ID exactly matches independent fix #1015. The
  grader patch has stable patch ID
  `7011a93c2f6e30c8682e2fb4863c93a81ccc9424`. Registered as draft case
  thirty; no model has seen it.
- The 30-case boundary-uniqueness audit found that S05 and S27 both originate
  in design-system chat-components PR #501. Both remain valid certificates,
  but scoring both would double-weight one review. S27 is therefore the first
  held-out reserve and was removed from the primary manifest before any model
  exposure.
- Certified replacement primary S43 from execution-origin PR #691
  (`026bb0442..00242bf9e`). Its new onboarding summary checks for an immediate
  `tool_execution` row but never joins `tool_execution_attempt.success`; a
  failed API attempt therefore sets both success milestones. An external
  grader executes the production SQL against a minimal relational fixture and
  gets `(1, 1)` instead of `(0, 0)` 3/3 on the reviewed commit. Production twin
  `744dbd46f` adds the success joins in source and generated SQL; exact grader
  `d7c5f92b5` passes 3/3, the generated-storage Go package passes, and the
  production patch ID exactly matches independent fix #923. The grader patch
  has stable patch ID `5df3748f5eac8fa699cf284ad6bded34fb65efa5`.
  Registered as the thirtieth independent primary case; no model has seen it.
- Certified reserve R02 from design-system registry PR #374
  (`2bae10bb9..3a146abd6`). Its new prebuild package script always chains
  Ultracite over the complete icon directory after generation, even when the
  real generator reports zero missing components. An external grader runs the
  real no-op generator while instrumenting any subsequent Bun invocation and
  sees the formatter launch 3/3 on the reviewed commit. Production twin
  `45b47988f` moves formatting into the non-empty generated-path branch; exact
  grader `3691c8210` passes 3/3, a direct no-op generator run passes, and the
  two-file production patch ID exactly matches independent fix #445. The
  grader patch has stable patch ID
  `96fa8f25323fb46997f6f1d71c2d446607bd2939`. Registered as reserve two; no
  model has seen it.
- Certified reserve R03 from layered chat-components PR #535
  (`f8088373f..fc0083545`). Its prompt action unconditionally prevents the
  compatibility mousedown default to preserve textarea focus; on touch input
  that cancels the synthesized click the mobile send button needs. A rendered
  component grader dispatches the touch compatibility event and observes
  cancellation 3/3 on the reviewed commit. Production twin `b71702116`
  switches to pointer events and skips prevention for touch; exact grader
  `66deed5a2` passes 3/3, design-system TypeScript and targeted Biome pass, and
  the production patch ID exactly matches the prompt-input part of independent
  fix #853. The grader patch has stable patch ID
  `cd78e7be002ec076c6fee339bb9b79d81fe9bfba`. Registered as reserve three; no
  model has seen it.
- Certified reserve R04 from Better-Auth migration PR #568
  (`7e8b0b973..23b722448`). The replacement `/register` route redirects to the
  account UI using only its base URL and ignores `location.searchStr`, dropping
  invitation context. A route-level grader invokes the real `beforeLoad` with
  an invitation query and observes a query-less redirect 3/3 on the reviewed
  commit. Production twin `b7ec16a50` forwards the query; exact grader
  `65268ab46` passes 3/3, targeted Biome passes, and the production patch ID
  exactly matches independent fix #943. The grader patch has stable patch ID
  `1e4e15d0c310e79afffa4b30bc2acc086d2117e3`. Registered as reserve four; no
  model has seen it.
- Certified reserve R05 from Experience API Sentry PR #455
  (`5c8a04e76..c4a0376bb`). The new error hook reports every non-validation
  failure, including an `AbortError` whose request signal proves that the
  browser disconnected intentionally. A direct hook grader supplies that
  exact paired condition and observes a Sentry capture 3/3 on the reviewed
  commit. Production twin `710afb339` adds the later narrow suppression; exact
  grader `141430f83` passes 3/3 and targeted Biome passes. Independent fix
  #1073 adds the same guard after intervening logging/telemetry changes, so its
  textual patch ID differs while the added production logic is equivalent.
  The grader patch has stable patch ID
  `279462d5c6810dc933e74da2d8bb56b805177f89`. Registered as reserve five; no
  model has seen it.
- Certified reserve R06 from Telegram toolkit PR #893
  (`5ea6fe055..1a628e932`). The toolkit supports Python 3.10+ but defines its
  output models with `typing.TypedDict`; Pydantic requires the
  `typing_extensions` backport before Python 3.12. A real Python 3.11 grader
  asks Pydantic for `BotInfo`'s schema and gets `typed-dict-version` 3/3 on the
  reviewed commit. Production twin `a93126faf` adds the backport dependency and
  import; exact grader `fe81d8962` passes 3/3, all 42 Telegram tests pass on
  Python 3.11, Ruff passes, and the production patch ID exactly matches
  independent fix #1032. The grader patch has stable patch ID
  `62789a8f74dd2d7116bbf8f7b31a9618d68af630`. Registered as reserve six; no
  model has seen it.
- Rejected Linear scope fix #798 as a retrospective label. The faulty
  `issues:create` scope was already present before the model cutoff; PR #385
  only reformatted that decorator while adding metadata, so treating it as a
  post-cutoff introduction would contaminate the corpus.
- Certified reserve R07 from Attio OAuth-provider PR #221
  (`e1c6b8a43..1604c672d`). Its new list-entry parser reads the record-query
  fields `record_id` and `values`, but Attio list-entry responses use
  `parent_record_id` and `entry_values`; valid IDs and attributes therefore
  disappear silently. A direct tool grader supplies the recorded API shape and
  reproduces the empty ID 3/3 on the reviewed commit. Production twin
  `ee6352534` switches both response keys; exact grader `dda7c28f4` passes 3/3,
  the five surrounding list tests and targeted Ruff pass, and independent fix
  #709 later makes the same two field corrections plus a richer value
  extractor. The full historical toolkit suite has two unrelated failures
  because its old exception-message assertions now encounter sanitized errors
  from the resolved TDK dependency. The grader patch has stable patch ID
  `9388d9038c9a75535777a0a2e0fe505a58612e46`. Registered as reserve seven;
  no model has seen it.
- Rejected Gmail scope fix #1020 because the missing read scope was introduced
  before the model cutoff. The post-cutoff metadata PR only added the incomplete
  behavior declaration; it did not introduce the authentication defect.
- Certified reserve R08 from shared-chat migration PR #831
  (`fb3e0b718..73273607e`). Its persistence callback unconditionally replaces
  browser history when an asynchronous first save finishes, even if the user
  has already navigated away. A direct component-hook grader captures the real
  callback, moves the browser to project settings, and observes the callback
  replace that route 3/3 on the reviewed commit. Production twin `c29790ed4`
  checks that the current path is still under the chat route; exact grader
  `5aa535cda` passes 3/3, targeted Biome passes, and its production patch ID
  `d34a69026819efd4ad5253fe40fbff7af746bddc` exactly matches independent fix
  #835. Registered as reserve eight; no model has seen it.
- Certified reserve R09 from Confluence direct-children PR #1240
  (`712b1c5ea..3944d1c55`). The new typed output uses `typing.TypedDict`
  even though the toolkit supports Python 3.10 and 3.11; Pydantic requires the
  backport on those interpreters. A real Python 3.11 grader constructs the
  output's Pydantic schema and gets `typed-dict-version` 3/3 on the reviewed
  commit. Production twin `d2cf40f53` adds the explicit backport dependency
  and import; exact grader `a11c55abd` passes 3/3, all 66 Confluence tests pass
  on Python 3.11, and targeted Ruff passes. Independent fix #1336 makes the
  same dependency/import repair plus a package version bump. The grader patch
  has stable patch ID `8abf7f3af8e79b85d04e0e2aa7c8ff18457e96c1`.
  Registered as reserve nine; no model has seen it.
- Rejected Google Sheets fix #1343 because the incorrect tab bounds and
  response parser both trace to pre-cutoff toolkit code.
- Certified reserve R10 from org/project route-context PR #769
  (`ff97ddb2b..6b102cbf1`). Its new error fallback treats an account with no
  organizations like any other route error and renders two `Go Home` links to
  `/`, even when `/` is the screen already being rendered. A static-render
  grader constructs the real empty-account error and observes those self-links
  3/3 on the reviewed commit. Production twin `ae5d5aeb8` excludes the empty
  state from route recovery; exact grader `eb6ca4f60` passes 3/3 and targeted
  Biome passes. Independent fix #913 contains the same guard and additionally
  hides the now-empty action container and irrelevant URL display. The grader
  patch has stable patch ID `1fa794d0695fd3bbe306c5e3c20d190889460b28`.
  Registered as reserve ten; no model has seen it.
- The pre-freeze audit found two corpus-construction defects before any scored
  model call. First, 26 recently created `fixedSha` commits descended from the
  private grader commit, so their trees contained the answer-revealing
  regression test. Rebuilt each as a production-only child of its buggy head,
  removed every `testPatchPaths` change, and retained an identical production
  patch ID. Second, reserve R01 shared PR #501 with primary S05 and was not an
  independent replacement. It was removed rather than frozen conditionally.
- Certified replacement reserve R11 from Microsoft Excel MCP Server PR #273
  (`788a25cbd..f6abe59e7`). The new SharePoint `create_workbook` tool requests
  only `Sites.ReadWrite.All` and then calls the Graph workbook-session endpoint,
  which requires `Files.ReadWrite`. An external AST grader reads the real tool
  decorator and observes the missing required scope 3/3 on the reviewed commit.
  Production-only twin `26650993a` adds that scope; exact grader `4b098bb68`
  passes 3/3, 73 of 74 historical toolkit tests pass, and targeted Ruff passes.
  The remaining old test failure is unrelated: its assertion expects raw HTTP
  error text that the currently resolved TDK now sanitizes. Independent fix
  #1108 makes the same scope addition to every workbook-session tool after the
  toolkit rename. The grader patch has stable patch ID
  `f35c82f0c32f1128240ecc8295f092efc3c1580d`. Registered as the tenth distinct
  reserve boundary; no model has seen it.
- The cross-manifest boundary audit found reserve R09 was the same original PR
  as primary S29 (`712b1c5ea..3944d1c55`). Removed it before freeze; a second
  label from the same PR would have overstated the effective sample size.
- Certified replacement reserve R12 from Outlook shared/delegated-mailbox PR
  #960 (`62c0f20b0..8aca376a8`). The new shared output contracts use
  `typing.TypedDict` while the toolkit supports Python 3.10 and 3.11; Pydantic
  requires the `typing_extensions` backport on those interpreters. A real
  Python 3.11 grader constructs `SearchEmailsResult`'s schema and gets
  `typed-dict-version` 3/3 on the reviewed commit. Production-only twin
  `ff6f859f0` adds the backport dependency and import; the exact grader passes
  3/3, all 466 Outlook Mail tests pass on Python 3.11, and Ruff passes.
  Independent fix #1151 makes the same dependency/import repair plus broader
  output-shape changes and a version bump. The grader patch has stable patch ID
  `a00cdf039face531c797f2701ed39d8e762685ea`. Registered as the tenth distinct
  reserve boundary; no model has seen it.
- Pre-run contamination audit found the draft runner prompts named
  `claude-opus-5`, whose official training cutoff is May 2026, while the case
  manifests conservatively admitted defects after 2026-01-31. Only four of the
  40 certified PR heads were after May 31. No holdout model call had occurred,
  so rejected Opus 5 for this benchmark rather than contaminating the score.
  Selected the fixed `claude-sonnet-5` API model for both systems: Anthropic
  documents its training cutoff as January 2026, so every frozen case remains
  post-cutoff. This changes the complete system being validated and must be
  declared in the freeze record; it is not a prompt-tuning or outcome-driven
  change.
- The first scored-run preflight stopped on the API-key display-name case
  because its two causal anchors include changed `common.py` and reached but
  unchanged `api_key_cache.py`. This is intentional contract-drift coverage:
  the PR introduces the new field and the existing cache schema drops it. The
  full prompt explicitly permits findings in reached unchanged code. Corrected
  the structural audit to require at least one causal anchor in the original
  diff and every other anchor to exist at the reviewed tree. All other 39 cases
  have every causal anchor directly in their original diff. No model call had
  occurred.
- The fixed-twin ancestry audit then found S21 and S26 still had two-commit
  corrective histories. Even though neither contained its private grader, a
  reviewer could inspect the intermediate commit and subject, and S21's second
  commit adapted existing tests to the new fail-closed behavior. Rebuilt both
  as single direct children of their buggy heads with byte-identical final
  trees: S21 `2117004dc` and S26 `6d0fca6f4`. This preserves the certified
  production/test state while removing intermediate future history. No model
  call had occurred.
- Full contamination preflight passed after those corrections: 40 distinct PR
  cases, 80 stripped buggy/fixed repositories, every review base present, every
  forbidden grader/future object absent, and no unreachable Git objects. Frozen
  Sonnet 5 prompts, corpus manifests, execution policy, statistical analysis,
  hashes, costs, retry/substitution rules, and exact invocation are recorded in
  `scored-corpus-freeze-2026-08-01.md`. Twenty-one policy/statistics tests pass.
  No scored-corpus model call has occurred as of the freeze.
- Pinned all four commits for every case (review base, buggy head, fixed twin,
  and private grader) under Arcade's dedicated
  `refs/cwgyh0/frozen-2026-08-01/<case>/` namespace: 160 refs total. This keeps
  synthetic grader/fixed commits reproducible instead of relying on Git's grace
  period for unreachable objects. Trial repositories still fetch exactly one
  selected source SHA and prove the forbidden refs' objects absent.
- 2026-08-07 resumed for issue #1910 after #1909 closed. Recovered the frozen
  30-primary/10-reserve benchmark commit from an unmerged local branch and
  transplanted it onto current main. The six corpus/prompt hashes still match;
  21 policy and statistical tests pass.
- Recovery exposed two environment-decay failures before any model call: the
  pinned adapter worktree had been cleaned, and Bun 1.3.14 no longer resolved
  its extensionless absolute TypeScript import. Restored the exact adapter
  commit, linked its already-installed workspace dependencies, changed only the
  import extension and ticket-root discovery, and recorded the recovery runner
  hash. Corpus, prompts, graders, thresholds, and adapter commit are unchanged.
- The full no-model isolation preflight is running against all 80 buggy/fixed
  snapshots. The scored run remains intentionally stopped: its preregistered
  ceiling is $1,000 and requires an explicit spend decision.
- A development-only Sonnet 5 cost calibration used the already-burned DEV-R01
  case with the frozen full/narrow prompts and scored limits. Four buggy/fixed
  calls cost $3.533523 total, projecting a complete three-trial scored case at
  about $10.60. No holdout output was exposed.
- Refroze the runner for cumulative complete-case spend checkpoints at 1, 2,
  5, 10, 20, and 30 cases. Atomic state preserves the exact shuffled queue,
  reserves, exclusions, completed cases, and cost; resume refuses frozen-input
  drift or a partially written case. Checkpoints never inspect or score interim
  answers. Thirty-two policy/statistics tests, ESLint, Prettier, and the Bun
  bundle pass. No scored-corpus model call had occurred at this refreeze.
- The first frozen holdout case was much heavier than the development
  calibration. Its first four randomized work items cost $8.638881, with zero
  retries or infrastructure errors. Inspected only usage/duration/retry/error
  metadata; did not open findings, named-defect matches, or reviewer text.
- Paused after the fourth durable record and before call five. Refroze only the
  operational checkpoint layer to persist after each work item and resume the
  same case/work index at cumulative dollar targets. Recovered the four records
  into version-2 state (`nextWorkIndex: 4`) and proved no-model resume. Forty-two
  tests plus lint, format, and bundle pass; all scientific inputs, completed
  outputs, work order, and scoring remain unchanged.
- Staged scored execution passed the $10 gate at $10.277085 / 6 calls, the $20
  gate at $20.407170 / 12 calls, and the $50 gate at $50.350935 / 28 calls.
  Across all three checkpoints: zero provider retries, infrastructure errors,
  or case exclusions; no duplicated work; exact work-index resume; no findings,
  named-defect matches, or reviewer text inspected. State is checkpointed four
  calls into the third frozen case with two cases complete.
- Merged current `origin/main` (`78afa7a7b`, `v0.74.6`) into the work branch.
  Every frozen scientific hash remains unchanged. Restored the disposable
  adapter worktree at its exact pinned commit and installed its frozen
  dependencies after main removed the old workspace links. Forty-two tests,
  Prettier, ESLint, and the Bun production bundle pass.
- Staged scored execution passed the $100 gate at $106.576443 / 51 calls and
  the $200 gate at $200.585727 / 100 calls. Eight cases are complete and the
  exact resume state is four calls into case nine. Across all calls: zero
  retries, infrastructure errors, exclusions, duplicate records, or resume
  mismatches. Mean call cost is $2.005857; maximum is $13.932660; longest
  duration is 516,843 ms. Findings and scores remain blinded.
- Initial $200 authorization attempts timed out before launch. Confirmed the
  1Password desktop app was unlocked and Touch ID plus CLI integration were
  enabled; resetting the CLI integration handshake restored scoped in-memory
  authorization. No API call occurred during the failed attempts.
