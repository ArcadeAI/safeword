# Impl Plan: pr-review-distribution — the runner

**Status:** planned

The runner is the vendor-agnostic, HEADLESS driver for the autonomous PR
reviewer (epic WAWQA6). It owns everything the reviewer does that is
_deterministically checkable_ — which tree it reads, when it fires, which vendor
it invokes, what it posts, what verdict it records, what it refuses to run on a
fork. The _judgment_ (does this finding clear the bar?) is the G5337S prompt,
proven by the CWGYH0 eval — the runner treats both the **vendor** and the
**review prompt** as injected inputs so the eval can reshape judgment without
touching a line of the runner.

Scenario source: `features/autonomous-pr-review.feature` (29 scenarios / 19
Rules). R/G/R ledger: `test-definitions.md` beside this file.

---

## Approach

**Riskiest assumption — the fork-safe trust split holds under the platform.**
The whole ticket exists because fork-PR injection only becomes real at customer
scale (safeword's own repo is ~37/40 self-authored, so it never surfaced here).
The design bets that we can (a) read an untrusted fork head _as data_ and reach
the model + the arcade tracker _with credentials_, then (b) post through a
credential that **structurally cannot approve or merge** — without ever
executing fork code while a secret is present. If that boundary is wrong (the
poster token can launder an approving review; the `workflow_run` handoff leaks a
secret into a job that runs fork code), the security posture collapses and no
amount of prompt quality saves it.

**Cheapest proof, sequenced first:**
`SM1.R3.an_injected_approve_instruction_cannot_produce_an_approval` — drive the
injected-approve fixture end-to-end through the two-job harness with a poster
token that lacks approval scope; assert an ordinary review comment is posted,
**no** approving review is submitted, **no** merge is triggered, and the diff is
treated as data. This slice fails loudly on slice 1 if the trust model is wrong,
while it is still cheap to change. The second load-bearing slice is R8's
authoritative green-gate (below): if the event→check-runs contract is wrong the
reviewer fires on red or never fires. Both precede any judgment-surfacing work.

### Integration contracts (pinned first — ADR-grade)

Everything downstream depends on three external contracts and two injection
seams. They are fixed here before the proof plan, per the arch-first directive;
the durable ones are folded into the ADR this ticket emits (see _Arch
alignment_).

#### A. GitHub — events, the authoritative green gate, verdict surfaces, fork two-stage

- **Trigger event (R8).** Coarse trigger = the CI workflow completing:
  `workflow_run` (`types: [completed]`) on the project's CI workflow, **plus**
  `pull_request` (`types: [ready_for_review]`) to catch a draft flipped ready
  after CI already went green. `check_suite.completed` is rejected as the
  primary trigger — it fires once _per check-producing app_, so a repo running
  Bugbot + CI + codecov emits three completions per SHA and none of them means
  "all required checks are green."
- **The green gate is an API read, not the event.** The event only says
  "something finished." Authoritative green = read the head SHA's checks and
  intersect with branch protection's _required_ set:
  `GET /repos/{o}/{r}/commits/{sha}/check-runs` + `GET /commits/{sha}/status`
  (combined status) filtered to
  `GET /repos/{o}/{r}/branches/{branch}/protection/required_status_checks`.
  Fire only when every required check is `success` AND the PR is
  `ready_for_review` (not draft). The reviewer's own `reviewed` receipt is a
  **non-required** check, so it is never part of the green it waits on — no
  self-deadlock (R8's closing note).
- **Fire-once + material re-review (R8).** De-dupe on head SHA: the presence of
  our own `safeword/pr-review` check-run (or a hidden marker) on a SHA means
  "already reviewed." Re-fire only when a _material_ push re-greens CI —
  "material" = the changed-path set since the last reviewed SHA contains a
  non-docs path (reuse a path-classifier; docs-only ⇒ no re-fire). A push that
  re-reds CI waits for green again.
- **Verdict surfaces (R9), and the credential split that makes them safe.**
  - `needs-a-human` → the only verdict that POSTS: a PR **review comment**
    (`POST /repos/{o}/{r}/pulls/{n}/reviews` with `event: COMMENT`, or inline
    hunk comments) — never `event: APPROVE`.
  - `reviewed` → a neutral **check-run receipt**
    (`POST /repos/{o}/{r}/check-runs`, `conclusion: neutral`,
    `name: safeword/pr-review`), NON-required. Not a comment (R2 holds), not an
    approval.
  - `unreviewable-as-is` → one posted note (comment), no receipt.
  - **The poster credential carries no review-submission or merge capability.**
    `pull-requests: write` alone _also_ permits submitting an APPROVING review
    (which can satisfy required-approval protection unless "require approval of
    most recent push" is set). So the poster is scoped to `checks: write` +
    issue-comment posting via a token/app permission set that structurally
    cannot approve or merge — SM1.R3's "issues no approving review and triggers
    no merge" is enforced by _absence of capability_, not by prompt obedience.
- **Fork two-stage (SM1.R3).** Stage 1 — `pull_request` (or `workflow_run`
  stage-1) — unprivileged: `permissions: contents: read`, **no secrets**,
  checks out the fork head, and produces the review _artifact_ (diff read as
  data; model called only in the secretless tier on a fork — see failure/threat
  sections). Stage 2 — privileged `workflow_run` in base context — consumes the
  artifact and posts with the no-approve poster token. **Never**
  `pull_request_target` + `actions/checkout` of the fork head into the workspace
  root: `actions/checkout@v7` refuses fork-PR head under `pull_request_target`
  by default (loud `allow-unsafe-pr-checkout` opt-in). Ship with "Require
  approval for all external contributors" so a fork runs only when a maintainer
  allows it.

#### B. arcade.dev MCP — brokered tracker read as the PR author (R6)

- **Contract:** arcade.dev MCP over HTTP with a bearer token, exposing the
  tracker as `Linear_*` tools (`Linear_GetIssue`, issue search by identifier) —
  the same MCP surface this repo's own sessions carry. The reviewer resolves the
  Linear identifier from the PR/branch linkback, then calls the tracker **once**
  as the PR author (author's own permissions — no service account, no privilege
  escalation; identity is v1's config-implied author, X1Z5MG deferred).
- **Fall-through ladder (R6 scenario):** a public linkback that carries the
  issue body ⇒ intent from the comment, **tracker called never**. A bare
  linkback (arcade's real private-team case) ⇒ tracker called **once**. Arcade
  unreachable / not configured ⇒ degrade to the bare linkback, note reduced
  intent certainty (feeds R7's provenance cap). The call count is the observable
  the scenario asserts.
- Reading the ticket is safe even on a fork (identity ≠ permission to _run_ —
  SM1.R3 still gates execution).

#### C. codex exec / claude -p — the invocation contracts (reuse `hooks/lib/retro-extract.ts`)

The two-vendor headless spawn is already proven in retro extraction; the runner
reuses the seams and diverges only where the review job genuinely differs.

| Seam (retro-extract.ts) | Reuse verbatim | Reviewer divergence (load-bearing) |
| --- | --- | --- |
| `RetroAgent = 'claude' \| 'codex'` | ✅ vendor tag | Selection is driven by R11 (cross-vendor), not config-only |
| `buildCodexExtractArgv` (`exec --skip-git-repo-check --ignore-user-config --disable hooks -o … --json --sandbox … -m …`) | ✅ shape | `-c mcp_servers={}` → **arcade MCP enabled**; `--sandbox read-only` → **tiered by trust** (read-only on fork; `workspace-write` only in the non-fork R12/R13 exec path); `--skip-git-repo-check` dropped (we run inside the checkout) |
| `buildExtractArgv` (`claude -p --model … --allowed-tools Read --output-format json --append-system-prompt …`, **no `--bare`**) | ✅ shape + no-`--bare` cloud-auth lesson | `--allowed-tools` grows to `Read` + arcade MCP tools + `Bash` (only in the trusted-exec tier); system/task prompt = the **injected G5337S prompt**, not `EXTRACT_SYSTEM_PROMPT` |
| `RunExtractionDeps.spawn` / `CodexSpawnOptions` (injected process boundary) | ✅ **this is the test seam** — fake the vendor to make every judgment-dependent scenario deterministic | — |
| `runCodexHeadlessExtractionChecked` → `{ ok, failureReason, findings }` | ✅ use the **checked** variant | Reviewer must distinguish _genuine empty_ (⇒ `reviewed`) from _vendor failure_ (⇒ no receipt, loud). The fail-open wrapper `runCodexHeadlessExtraction` (swallows to `[]`) is **wrong here** — an error would masquerade as a clean `reviewed` |
| `resolveRetroModel(projectDir, agent)` (config read, fail-open to default) | ✅ mirror as `resolvePrReviewConfig` | Adds `enabled`/`post`/`vendor`/`executionTrust`/`requiredChecks`/`arcade` keys |

#### The two injected inputs (the eval's reshape surface)

1. **Vendor** — `RetroAgent`, chosen per R11: default assume author=Claude ⇒
   review with **Codex** (V1 cross-vendor default); author=Codex ⇒ **Claude**;
   the `cross_model` claim tracks the _actual_ pairing (same-vendor ⇒ `false`).
   The `spawn` dep is the injection point.
2. **Review prompt** — the G5337S skill body, passed as the
   system/task prompt exactly as `EXTRACT_SYSTEM_PROMPT` is for retro. The runner
   never encodes review judgment; CWGYH0 can re-tune the prompt and the runner is
   untouched. This is the design's compliance with "keep vendor and prompt
   injected."

### Threat model

| Threat | Vector | Structural mitigation (survives a successful injection) |
| --- | --- | --- |
| **Fork injection / pwn-request** | Untrusted head code + "approve me" / "run this" instructions in the diff or body | Head read as **data** in an unprivileged, secretless stage-1 job; poster in stage-2 holds **no approve/merge capability**, so a hijacked reviewer _says_ something wrong, never _does_ something irreversible (SM1.R3). Diff is data — instructions are never executed as commands. |
| **Secret exposure** | Vendor API key (`CODEX_API_KEY` / `anthropic_api_key`\|`claude_code_oauth_token`) or arcade bearer present while fork code executes | WIF/OIDC preferred: short-lived, scoped to the single headless invocation. The job that _executes_ fork code (R12 base-repro, R13 fix-run, R17 live env) holds **no** secret; on a fork those gates **degrade** rather than run (SM1.R3). Never a job-level env secret in a job that checks out fork code. |
| **Trust boundary** | The tripwire is _execution of fork code with a credential_, not reading it | "Clone everything and read it" is always safe (privileged job OK). "Spin it up and bang on it" is the gated act — non-fork or secretless-only. Any new run-fork-code step is visibly in violation of the R13 fork-degrade scenario. |
| **Laundered approval** | `pull-requests: write` silently also grants APPROVE | Poster capability set excludes review-submission; enforced by token/app scope, not prompt. Recommend "require approval of most recent push" as defence-in-depth. |

### Failure modes — degrade loud, never falsely green, never block

The reviewer is advisory (warn-mode, no required check — `out_of_scope`), so
_nothing it does blocks a merge_. But its `reviewed` receipt carries a trust
claim, so — unlike retro's fail-**open** silence — a failure must be **visible**,
mirroring `retro-reconcile.yml`'s "one loud job" (exit non-zero ⇒ red run, not a
silent no-op).

| Failure | Posture |
| --- | --- |
| Vendor error / timeout / non-zero exit | Bounded `timeout-minutes` on the job + per-invocation timeout. On failure: **no receipt, no comment, red job** (`ok:false` from the checked runner). Never a green `reviewed` (that would claim "ran, found nothing"). No auto-retry (re-run is manual / `workflow_dispatch`). |
| Malformed / unparseable vendor output | Same as error — reuse retro's parse guards; `ok:false` ⇒ loud, no receipt. |
| Can't read required-checks / green state | **Fail-closed on the trigger**: don't fire. Better to skip than review red or half-settled code. |
| arcade / MCP unreachable | Degrade to the bare-linkback intent (R6 fallback); reduce claimed certainty (R7). Not a hard failure. |
| Can't post the verdict | Loud failed job — never a silent drop. |
| Stale / mismatched checkout | Pin to the head SHA; fail loudly on mismatch; prefer the diff as ground truth (G5337S's pin-tree finding). |

### Rollout

- **Distribution (`safeword setup`).** The workflow `.yml` and the G5337S skill
  become `ownedFiles` in `packages/cli/src/schema.ts` (upgrade-overwritten),
  with a template↔dogfood parity pair. **Net-new schema territory:**
  `.github/workflows/` is customer-**shared** (they own other workflows), so the
  reviewer workflow is a single-file `ownedFiles` entry keyed into a
  `sharedDir`, not an `ownedDir` — no `.github/workflows/*` shipping precedent
  exists in `schema.ts` today, so the reconciler's shared-dir single-file
  overwrite path is exercised here for the first time and needs its own
  release-parity coverage. The workflow is a vendor-neutral CI artifact, so it
  ships **once** — it is NOT part of the 7-surface skill parity trio (that is
  G5337S's concern).
- **Default-off (reversibility).** Ships disabled; the `.yml` lands dormant, so
  upgrade changes no behavior. Enabling is opt-in. The one-way edge (spec): any
  `.safeword/config.json` key becomes a versioning-commitment compatibility
  surface, and the ownedFiles become upgrade-overwritten.
- **Kill switch + trust calibration (SM1.R2, Tricorder precedent).**
  `.safeword/config.json` → `prReview: { enabled, post, vendor, model,
  executionTrust, requiredChecks, arcade }`, read at runtime via
  `resolvePrReviewConfig` (fail-open to the safe default = disabled / no-post).
  `disabled ⇒ 0 comments, workflow stays installed` (SM1.R2). Uninstall (not
  the switch) is what removes the workflow.
- **Migration.** No data model, no migration. Deletable `.yml` = two-way door.
  Config keys are the only durable surface.

### Component ownership + proof plan

Primary proof for almost every scenario is **integration** against a runner
harness with the vendor `spawn` faked (canned model output per the scenario's
`Given`) and GitHub / arcade MCP stubbed — the highest practical scope that
stays deterministic. A few pure decisions get a **unit** test. The
judgment-surfacing rows are thin runner pass-through tests, cross-checked for
_quality_ by the CWGYH0 **eval** (named, not duplicated here).

| Rule cluster | Owning component | Primary proof | Note |
| --- | --- | --- | --- |
| R8 trigger gating | `pr-review` workflow triggers + `evaluateTrigger()` (event → required-checks read → fire/skip/re-fire) | integration + **unit** (the fire predicate over the 7-row truth table) | load-bearing #2 |
| R9 verdict surfaces | `postVerdict()` (comment vs neutral check-run) | integration | non-required receipt |
| SM1.R3 fork safety | two-job workflow split + poster capability set | integration (injected-approve, fork-degrade, posted-without-running) | **load-bearing #1** |
| SM1.R2 kill switch | `resolvePrReviewConfig` + workflow guard | integration | default-off |
| R6 brokered intent | `resolveIntent()` (linkback → arcade MCP fall-through) | integration | asserts tracker call count |
| R7 completeness cap | `boundCompletenessSeverity()` (PR-cross-reference count → cap) | **unit** + integration | deterministic detector |
| R1 subtraction | `subtractCoverage()` (coverage, not mention) | integration | 3-row outline |
| R2 silence | `postVerdict` (empty findings ⇒ 0 comments, still `reviewed`) | integration | pairs with R9 |
| R11 cross-vendor | `selectVendor()` + `crossModelClaim()` | **unit** + integration | 4-row pairing table |
| R12 base-repro / R13 fix-run | `runGate()` (execute in checkout; **fork ⇒ degrade**) | integration | ties to SM1.R3 |
| R14 adversarial | `runAdversary()` (2nd spawn on findings; contested/annotate, never drop) | integration | vendor verdict injected |
| R17 full checkout | checkout step + "cite an unchanged file" pass-through | integration | substrate for R12/R18 |
| R19 / R20 / TB2.R1 / TB2.R2 / TB2.R3 / NTB1.R4 | runner surfaces / maps the **injected** judgment (work type, coverage, depth, sensitive verdict, author-request, decision-last assembly) | integration (pass-through) + **eval (CWGYH0)** for quality | runner proves it doesn't drop/garble the judgment; the eval proves the judgment |

### Build order (load-bearing first, each slice builds on green)

1. **Fork-safe two-stage skeleton + poster capability set** — SM1.R3 trio
   first (the riskiest assumption; injected-approve is the cheapest kill).
2. **Trigger + authoritative green gate** — R8 (unit truth table, then the
   event→check-runs integration).
3. **Headless invocation + parse** — wire `buildCodexExtractArgv` /
   `buildExtractArgv` behind the injected `spawn`; use the **checked** runner;
   R17 checkout.
4. **Verdict surfaces + silence** — R9, R2 (comment vs neutral check-run).
5. **Intent + subtraction + completeness cap** — R6, R1, R7.
6. **Cross-vendor + adversarial** — R11, R14.
7. **Execution gates** — R12, R13 (with the fork-degrade path from slice 1).
8. **Distribution + kill switch** — schema `ownedFiles`, parity pair, `prReview`
   config, SM1.R2.
9. **Judgment-surfacing pass-throughs** — R19, R20, TB2.\*, NTB1.R4 (thin runner
   tests; defer quality to CWGYH0).

---

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Runner architecture | Vendor-agnostic HEADLESS driver: `codex exec` (V1 default) / `claude -p` (V2), reusing `hooks/lib/retro-extract.ts` seams | `anthropics/claude-code-action` (the epic architect-brief's original V1) | claude-code-action is **Claude-only** — it cannot run headless Codex, which is the cross-vendor default's entire point (R11). Same-vendor review launders correlated blind spots as independence. |
| CI-green trigger | `workflow_run`/`pull_request:ready_for_review` event → **check-runs + required-status API** as the authoritative gate | `check_suite.completed` as the gate | `check_suite` fires once per check-producing app; "one app finished" ≠ "all required checks green" (R8). |
| Fork safety | Two-job split: unprivileged secretless read → privileged poster, poster **cannot approve/merge** | `pull_request_target` + `--add-dir` head checkout | `actions/checkout@v7` refuses fork head under `pull_request_target` by default; and `pull-requests: write` silently grants APPROVE. Capability-absence is the only injection-proof guarantee (SM1.R3). |
| Failure posture | Fail-**loud** & non-blocking: error ⇒ no receipt + red job; never a false green | Retro's fail-**open** (`[]`, silent) | The `reviewed` receipt is a trust claim; a swallowed error would masquerade as a clean review. Use `runCodexHeadlessExtractionChecked` (`ok` bit), not the fail-open wrapper. |
| Tracker access | arcade.dev MCP over HTTP (bearer), `Linear_*`, brokered as the PR author, called once, with a bare-linkback fallback | GitHub-app service account; no tracker (linkback-only) | Service account = privilege escalation; linkback-only misses arcade's private-team case where the linkback is bare (R6). |
| Injected inputs | Vendor (`RetroAgent`) and review prompt (G5337S body) are parameters, not runner code | Bake judgment/vendor into the runner | CWGYH0 must reshape judgment without a runner change; R11 must swap vendor per author. |
| Verdict surfaces | `needs-a-human` ⇒ comment; `reviewed` ⇒ non-required neutral check-run; `unreviewable-as-is` ⇒ one note | Always-comment (incl. clean); required check | Always-comment breaks R2 silence; a required check contradicts warn-mode `out_of_scope` and would self-deadlock R8. |
| Distribution | Workflow `.yml` + skill as `ownedFiles`; workflow keyed into the **shared** `.github/workflows/` dir; template↔dogfood parity pair | `ownedDir` for `.github/workflows/`; managedFiles (create-if-absent) | Customers own other workflows (must not own the dir); `ownedFiles` overwrite keeps the reviewer upgradeable — managed-if-absent would strand fixes. |
| Kill switch | `.safeword/config.json` `prReview.{enabled,post,…}`, default-off, runtime-read fail-open-to-disabled | Env var; delete the workflow to disable | Config is the Tricorder precedent (killable without uninstall, SM1.R2); env is invisible to `safeword check`. |

---

## Arch alignment

Honors these recorded ADRs (`ARCHITECTURE.md`, `paths.architecture`):

- **Schema (`src/schema.ts`) as single source of truth** & **Reconciliation
  Over Copy** — the workflow + skill are `ownedFiles`; reconcile computes the
  plan, no direct writes; upgrade overwrites keep the reviewer current.
- **Continuous Quality Gates (warn-mode precedent)** — the reviewer is advisory,
  non-blocking, killable-by-config; matches the done-flip guard held to
  warn-mode (#460) the `out_of_scope` line cites.
- **plan-implementation: a gated planning phase** — this artifact _is_ that
  phase's output; status `planned` now, reconcile to `implemented` at implement
  exit.
- **Architecture Review Gate (evidence + independent design review)** — the
  Decisions table carries cited evidence; this plan takes the Tier-2 review
  stamp before implement, and (given the cross-model theme) is a natural
  `crossModelReview` candidate.
- **Frozen Transcript Fixture Testing** — the injected-`spawn` fixtures (canned
  vendor output + captured GitHub/check-runs payloads) are the same
  format-pinned, no-live-API discipline; the reviewer's determinism rests on it.
- **Cross-agent Stop delivery** / **Profile-Scoped Generated Codex Plugin** —
  precedent that safeword drives Codex _and_ Claude headlessly from one canonical
  source; the runner extends the same two-vendor spawn to review.

**ADR to emit at implement exit** (significance-tested — this is a
difficult-to-reverse _public delivery + security_ boundary, like MZH9QH's):
**"Vendor-agnostic headless PR-review runner with a fork-safe two-stage trust
split."** Context: shipping a reviewer into customers' CI, cross-vendor by
default, on untrusted fork code. Decision: headless `codex exec`/`claude -p`
(not claude-code-action); read-as-data in an unprivileged secretless job → post
via a no-approve/no-merge credential; injected vendor + prompt. Consequences: a
net-new `.github/workflows/` ownedFiles class; a `prReview` config compatibility
surface; execution gates degrade on forks. Alternatives: claude-code-action
(Claude-only), `pull_request_target` checkout (refused + approval-launder risk),
voting panel (popularity trap). Reassess-when: see _Assessment triggers_.

## Known deviations

- **Fail-loud, not retro's fail-open.** Deliberate: retro is invisible/best-effort
  and returns `[]` on any error; the reviewer's receipt is a trust claim, so an
  error must be visible (red job, no receipt), never a false `reviewed`.
- **`.github/workflows/` ownedFiles is a net-new schema class** — no
  `.github/workflows/*` shipping precedent exists in `schema.ts`. Deviation is
  acceptable because it reuses the existing shared-dir single-file overwrite
  mechanism; it needs first-of-its-kind release-parity coverage, called out in
  the build order.
- **R17 says "an environment it can exercise"; the runner NEVER executes fork
  code.** The full-checkout _read_ is universal; _execution_ (R12/R13/R17 live
  env) is gated to non-fork/secretless. This narrows R17 on purpose — it is
  SM1.R3's execution tripwire, not a regression.
- **v1 implies the author vendor by config** (cross-vendor defaults to
  author=Claude ⇒ review with Codex). Real author detection is X1Z5MG, deferred;
  the default fails toward cross-vendor, the safe direction.

## Doc impact

- `README.md` — `safeword setup` now ships an autonomous PR reviewer; default-off;
  how to enable and kill it.
- `packages/website/src/content/docs/` — a reviewer reference page: the
  `prReview` config keys, the vendor/prompt injection points, the fork-safety
  posture and the "require approval for external contributors" prerequisite, the
  three verdicts, and the arcade MCP setup (bearer token).
- `ARCHITECTURE.md` — append the ADR named above.
- (G5337S owns the skill's own 7-surface docs; not duplicated here.)

## Assessment triggers

- **X1Z5MG lands** (real author-vendor detection) — cross-vendor stops being
  config-implied; revisit `selectVendor()` and R11's default.
- **A third decorrelated vendor becomes available** — R14's refuter could then
  _drop_ a shared-lineage false finding instead of only down-weighting it to
  `contested`.
- **`actions/checkout` / GitHub changes fork-PR policy** (e.g.,
  `allow-unsafe-pr-checkout` default flips, or check_suite/`workflow_run`
  semantics change) — re-verify the two-stage split and the green gate.
- **arcade MCP schema changes** (tool names, auth, HTTP contract) — `resolveIntent()`
  and the brokered-as-author identity model.
- **CWGYH0's recorded bar fails on a non-safeword corpus** — the eval reshapes or
  kills the epic; the runner's injected-prompt seam absorbs a prompt change with
  no runner edit, but a kill retires the distribution.
- **The product-scout shared attention-layer fork** (ticket.md's open
  architecture question) — floating attention bar (R8/R9 calibration), per-type
  earned-autonomy flywheel, and the mute store are a layer shared with
  product-scout, not runner-local. Do **not** build it into the runner
  unilaterally; it needs ≥1 scored ledger cycle and a user call on build-once vs
  build-twice.
