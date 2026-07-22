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
The design bets that we can (a) check out an untrusted fork head **only** in a
secretless job, (b) hand it forward as an inert data bundle to a credentialed
job that reads it but never executes it, and (c) keep that credentialed job from
producing an approval or a merge. If any leg is wrong — the handoff leaks a
secret into a job that runs fork code, or the poster can launder an approving
review — the security posture collapses and no amount of prompt quality saves it.

_Leg (c) got weaker under review (2026-07-19). An earlier draft claimed a
credential "that structurally cannot approve"; that was **verified false** —
no token scope separates commenting from approving, and a `github-actions`
approval counts toward branch protection. Leg (c) now rests on an org/repo
setting plus an endpoint the runner never calls (§A). It is defence-in-depth
rather than a single structural gate, and that is worth knowing before the
build, not after._

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
  primary trigger: there is one check suite per commit SHA **per app**, and
  GitHub Actions additionally gives **each workflow run its own check suite**, so
  a repo running CI + Bugbot + codecov has several suites per SHA and no single
  suite completing means "all required checks are green."
  _(verified: [REST check-suites](https://docs.github.com/en/rest/checks/suites),
  [community#24872](https://github.com/orgs/community/discussions/24872) —
  "only one check suite per commit SHA, per app"; the per-workflow-run suite
  behaviour is corroborated but not stated in the Actions events page.)_
- **`workflow_run` constraint that shapes onboarding:** it "will only trigger a
  workflow run if the workflow file exists on the **default branch**"
  _(verified:
  [events-that-trigger-workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows))_.
  So the reviewer cannot review the very PR that installs it — the first review
  happens only after the `safeword setup` PR merges. Say this in the docs; it is
  the #1 "it didn't work" report to expect.
- **The green gate is an API read, not the event.** The event only says
  "something finished." Authoritative green = read the head SHA's checks
  (`GET /repos/{o}/{r}/commits/{sha}/check-runs` + `GET /commits/{sha}/status`)
  and intersect with the branch's _required_ set. Fire only when every required
  check is `success` AND the PR is `ready_for_review` (not draft). The reviewer's
  own `reviewed` receipt is a **non-required** check, so it is never part of the
  green it waits on — no self-deadlock (R8's closing note).
- **Resolving the required set — three tiers, and log which one answered.**
  1. **`GET /repos/{o}/{r}/rules/branches/{branch}`** (rulesets) — returns active
     rules including `required_status_checks` with their contexts, and needs only
     **Metadata: read**, which an ordinary workflow token has. _(verified:
     [REST rules](https://docs.github.com/en/rest/repos/rules))_ **Not**
     `/branches/{branch}/protection/required_status_checks` — that one needs
     **Administration: read**, i.e. admin, which a customer's runner will not
     have. An earlier draft named the admin-gated endpoint.
  2. **`.safeword/config.json` → `prReview.requiredChecks`** — the declared
     override, and the fallback for repos still on _classic_ branch protection,
     where the rules endpoint legitimately returns nothing.
  3. **Every check must pass** — last resort when neither above answers.
     Over-strict by design: it can never review red code, but one flaky optional
     check will suppress reviews indefinitely.

  Tier 3 is the dangerous one — it fails as "the reviewer seems broken" rather
  than as an error. So `evaluateTrigger()` **logs which tier resolved the gate on
  every run**; "why didn't it fire?" must be answerable from one line of output.
- **Fire-once + material re-review (R8).** De-dupe on head SHA: the presence of
  our own `safeword/pr-review` check-run (or a hidden marker) on a SHA means
  "already reviewed." Re-fire only when a _material_ push re-greens CI —
  "material" = the changed-path set since the last reviewed SHA contains a
  non-docs path (docs-only ⇒ no re-fire). **No path classifier exists in the
  repo today** — this ticket adds one; it is not a reuse.
- **Verdict surfaces (R9), and the credential posture that makes them safe.**
  - `needs-a-human` → posts **inline** review comments via
    `POST /repos/{o}/{r}/pulls/{n}/comments` (`path`/`line`/`side` — "creates a
    review comment on the diff"), a **different endpoint** from
    `POST /pulls/{n}/reviews`. The runner never calls `/reviews` at all, so
    `event: APPROVE` is never even a reachable code path.
    _(verified: [REST pulls/comments](https://docs.github.com/en/rest/pulls/comments))_
  - `reviewed` → a neutral **check-run receipt**
    (`POST /repos/{o}/{r}/check-runs`, `conclusion: neutral`,
    `name: safeword/pr-review`), NON-required. Not a comment (R2 holds), not an
    approval. **Confirmed usable from the workflow token**: the Checks docs say
    creation requires a GitHub App, and the Actions `GITHUB_TOKEN` is an App
    installation token — the permissions reference states plainly that
    "`checks: write` permits an action to create a check run", and `neutral` is a
    valid `conclusion`. No GitHub App of our own is needed, and the commit-status
    fallback an earlier draft reserved is unnecessary. _(verified:
    [REST checks/runs](https://docs.github.com/en/rest/checks/runs),
    [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions))_
  - `unreviewable-as-is` → one posted note (comment), no receipt. (So two
    verdicts post; only `reviewed` is silent.)
  - **CORRECTION — capability-absence is not achievable at token scope.** An
    earlier draft of this plan claimed the poster could be "scoped to a
    permission set that structurally cannot approve." That is false: there is no
    `pull-requests` sub-scope separating comment from approve, and the
    `github-actions` bot's approval **does** count toward required-approval
    protection _(verified: [approving with required
    reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews),
    [Cider Security — bypassing required reviews via
    Actions](https://medium.com/cider-sec/bypassing-required-reviews-using-github-actions-6e1b29135cc7))_.
    SM1.R3 is therefore met by **three layers**, of which the first is genuinely
    structural:
    1. **Repo/org setting "Allow GitHub Actions to create and approve pull
       requests" → OFF.** This is the real structural control on `GITHUB_TOKEN`,
       it is the default for new personal-account repos, and it cannot be
       re-enabled below a tier that disabled it (Enterprise → Org → Repo).
       _(verified: [managing Actions settings for a
       repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository))_
       **This becomes a documented install prerequisite, not an assumption.**
    2. **"Require approval of the most recent reviewable push"** → a bot
       approval cannot satisfy protection for the push it just reviewed.
    3. **The runner never calls the review-submission endpoint** — asserted by
       the SM1.R3 injected-approve test, which fails if `/pulls/{n}/reviews` is
       called at all.
- **Fork two-stage (SM1.R3).** The split is **checkout vs credential**, not
  read vs post — an earlier draft blurred this and implied a secretless job
  could call the model, which is impossible.
  - **Stage 1 — `pull_request`, unprivileged** (`permissions: contents: read`,
    **no secrets**): checks out the fork head and emits a **data bundle**
    artifact (diff + the surrounding files R17 needs). It calls no model and
    posts nothing, because it holds no credential.
  - **Stage 2 — `workflow_run`, privileged** (base context, holds the vendor +
    arcade credentials): downloads the bundle, invokes the vendor headless with
    the bundle **as data**, and posts. It **never checks out the fork head and
    never executes fork code** — which is exactly why holding a credential here
    is safe. This matches the Rule verbatim: "Reading the diff as data and
    sending it to the model is safe while a credential is held; running the
    fork's code is not" (`features/autonomous-pr-review.feature`, SM1.R3).
  - Consequence for R12/R13/R17: the execute-gates need fork code to _run_, so
    on a fork they **degrade** (stage 2 won't run it; stage 1 can't pay for it).
    On a non-fork PR both stages are same-repo and the gates execute normally.

  Two hard constraints, both verified:
  - **Stage 1 cannot be `workflow_run`.** `actions/checkout@v7` refuses fork-PR
    head in **both** `pull_request_target` _and_ `workflow_run` workflows
    (opt-out `allow-unsafe-pr-checkout: true`), and the enforcement was
    backported to all supported majors on **2026-07-16** — three days ago, so it
    is live on floating tags now.
    _(verified: [GitHub changelog
    2026-06-18](https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/))_
  - **Stage 2 must never check out the fork head** — it only downloads the
    artifact. Same refusal would apply, and it is the pwn-request surface.
  - Ship with "Require approval for all external contributors" so a fork runs
    only when a maintainer allows it.

#### B. arcade.dev MCP — brokered tracker read as the PR author (R6)

- **Contract (verified 2026-07-20):** arcade.dev MCP over HTTP, exposing the
  tracker as `Linear_*` tools (`Linear_GetIssue`, issue search by identifier).
  Arcade separates **two** identities, which is exactly what R6's
  no-privilege-escalation premise needs:
  - `Authorization: Bearer <ARCADE_API_KEY>` authenticates the **application**.
  - `Arcade-User-ID: <end user>` selects **whose** vaulted OAuth token executes
    the call. The runtime stores tokens per user id and retrieves that user's
    token, so the read really is scoped to that person's own permissions — not
    the key owner's, and not a service account.

  _(verified: [Arcade auth model](https://docs.arcade.dev/home/auth/how-arcade-helps),
  [user sources / MCP gateways](https://docs.arcade.dev/en/guides/user-sources))_

  **The precondition this creates is load-bearing.** The PR author must exist as
  an arcade user with an authorized Linear connection. If they have not
  authorized, arcade raises an authorization interrupt — which **cannot be
  satisfied inside CI**, since there is no human present to complete an OAuth
  flow. That is not a failure case to handle late; it is the common case for any
  contributor who has never used the tool. The runner treats it as R6's existing
  fallback: degrade to the bare linkback and lower the certainty R7 permits.

  **Residual, and it is a deployment question rather than a design one:** how a
  GitHub author maps to an arcade user id (email? a configured table?). Built as
  an injected parameter so the mapping is config, not code.
- **Fall-through ladder (R6 scenario):** a public linkback that carries the
  issue body ⇒ intent from the comment, **tracker called never**. A bare
  linkback (arcade's real private-team case) ⇒ tracker called **once**. Arcade
  unreachable / not configured ⇒ degrade to the bare linkback, note reduced
  intent certainty (feeds R7's provenance cap). The call count is the observable
  the scenario asserts.
- Reading the ticket is safe even on a fork (identity ≠ permission to _run_ —
  SM1.R3 still gates execution).

#### C. codex exec / claude -p — the invocation contracts (reuse `hooks/lib/retro-extract.ts`)

The two-vendor headless spawn is proven in retro extraction — but a review pass
is **not** a retro extraction, and an honest audit of the module (2026-07-19)
shows the split is not where an earlier draft of this plan claimed. The argv
builders are genuinely parameterized; **the runners are retro-coupled and cannot
be called as-is.**

| Seam (`hooks/lib/retro-extract.ts`) | Actually reusable? | What the runner needs |
| --- | --- | --- |
| `RetroAgent = 'claude' \| 'codex'` (:36) | **Yes**, verbatim | Selection driven by R11 (cross-vendor), not config-only |
| `buildExtractArgv({model, systemPrompt, prompt, allowedTools, mcpConfigPath})` | **Done** | `allowedTools` grants `Read,Grep,Glob,Bash,WebSearch,WebFetch` in the execute tier (read-only on a fork), so R13/R17 run for real; `mcpConfigPath` + `mcpToolGrant` attach the tracker gateway by FILE (never inline — the config carries a bearer). Both vendors now reach the tracker (R6). **Remaining:** the command layer that assembles the MCP config file from `.safeword/config.json` (gateway URL) + an env bearer, writes it 0600, and passes the path — its own slice because it handles the live secret. |
| `buildCodexExtractArgv({model, schemaPath, outputPath, prompt})` (:189) | **Partly** — prompt/schema/model are parameters, but three flags are **hardcoded literals** | `-c mcp_servers={}` (:196) must become arcade MCP; `--sandbox read-only` (:203) must tier by trust; `--skip-git-repo-check` (:191) should drop (we run inside the checkout). All three need parameterizing |
| `RunExtractionDeps.spawn` (:317) / `RunCodexExtractionDeps.spawn` (:339) | **Yes** — the injected process boundary | **This is the test seam** — fake the vendor to make every judgment-dependent scenario deterministic. (`CodexSpawnOptions` (:330) is an options bag, not a seam — an earlier draft mislabelled it) |
| `runHeadlessExtraction` (:374) / `runCodexHeadlessExtractionChecked` (:402) | **No — not callable as-is** | Both hardcode the retro job: the retro output schema (:412), `buildCodexExtractPrompt`/`EXTRACT_SYSTEM_PROMPT` (:417, :268), and a JSONL transcript through `buildDigest` (:494). A PR review has a different schema, prompt, and input. **The `{ok, failureReason}` return shape is the pattern to copy** (a review must distinguish genuine-empty ⇒ `reviewed` from vendor-failure ⇒ no receipt; the fail-open wrapper `runCodexHeadlessExtraction` (:445) would let an error masquerade as a clean review) |
| `resolveRetroModel(projectDir, agent)` (:48) | **Pattern only** | Mirror as `resolvePrReviewConfig` with `enabled`/`post`/`vendor`/`executionTrust`/`requiredChecks`/`arcade` |

**Consequence — this ticket owes a generalization step (slice 0), not free
reuse.** Parameterizing prompt + schema + input on both runners touches a
shipped, tested surface: `packages/cli/src/commands/retro.ts` imports the
template copy, `packages/cli/src/schema.ts` declares the
`.safeword/` ↔ `templates/` byte-parity pair, and
`packages/cli/tests/hooks/retro-extract.test.ts` pins the current contract. The
refactor must keep retro's behaviour identical and both parity copies in sync.

#### D. The vendor → runner data contract (the review output schema)

Six-plus scenarios require the runner to read **structured** fields out of the
vendor, so the schema is a contract, not an implementation detail. `codex exec`
takes it via `--output-schema`; `claude -p` gets it in the appended system
prompt and returns it inside the `--output-format json` envelope. Minimum shape:

```jsonc
{
  "verdict": "needs-a-human" | "reviewed" | "unreviewable-as-is", // R9
  "work_type": "patch" | "logic change" | "new behavior",          // R19
  "cross_model": true,                                             // R11 (runner overwrites — never trust the model's own claim)
  "findings": [{
    "path": "…", "line": 0,          // R12 inline anchoring
    "consequence": "…",              // NTB1.R1 plain-language surface
    "evidence": "…",                 // TB1.R4 code block, one layer deeper
    "severity": "question" | "finding",   // R7 cap target
    "dimension": "…",                // TB2.R1 depth accounting
    "suggested_fix": null,           // R13 — null unless run against tests
    "adversarial": "unchecked" | "contested" | "affirmed"  // R14 (runner writes, not the model)
  }],
  "decision": "push back" | "ask"    // NTB1.R4 — assembled last
}
```

Two fields are **runner-owned and must be overwritten after parse**:
`cross_model` (R11 — a model asserting its own independence is exactly the
laundering R11 exists to stop) and `adversarial` (R14 — set by the second
spawn's outcome). A parse failure is a vendor failure ⇒ no receipt, loud.

Drift-safety is **asymmetric**: `--output-schema` makes a renamed field
structurally impossible on codex; the claude path instead relies on the appended
schema being honored, so `tests/pr-review/output-contract.test.ts` binds the
prompt's field names to the runner's parser (they cannot drift in source) and the
loud parse-failure path above is the runtime backstop. If `claude -p` ever
exposes a custom output-schema flag, adopt it to close the asymmetry.

#### E. Vendor auth — WIF/OIDC is available, and it is the default

Verified 2026-07-20, and it upgrades the threat model: **both vendors are OIDC
relying parties**, so the runner can hold no standing secret at all.

- **Anthropic** — Workload Identity Federation (shipped June 2026). The workflow
  requests an Actions OIDC token, posts it to `POST /v1/oauth/token` (RFC 7523
  `jwt-bearer` grant); Anthropic verifies it against
  `https://token.actions.githubusercontent.com`'s JWKS and the federation rule's
  match conditions, returning a short-lived `sk-ant-oat01-…` (60s–24h, default
  1h) bound to a service account. _(verified:
  [WIF](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation),
  [WIF with GitHub Actions](https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions))_
- **OpenAI** — equivalent workload identity federation with its own Actions
  guide; match on `repository` / `ref` / `environment` rather than org-wide
  trust. _(verified:
  [OpenAI WIF for GitHub Actions](https://developers.openai.com/api/docs/guides/workload-identity-federation/github-actions))_
- Both require `permissions: id-token: write` on the job.

**But WIF cannot be the only path.** Registering an issuer and a service account
needs **admin on the customer's vendor org** — a step `safeword setup` cannot
perform. This ticket's `done_when` says a customer repo gets the reviewer "with
no hand-editing", so a WIF-only design is an adoption cliff that contradicts the
contract. Therefore:

| Tier | Mechanism | Posture |
| --- | --- | --- |
| Preferred | WIF/OIDC → short-lived token | No standing secret. Documented as the recommended setup. |
| Fallback | Static key in a GitHub **environment** secret, reachable only by the privileged stage 2 | Works out of the box; a standing secret exists, so scope it to the environment and never expose it to stage 1. |

`resolvePrReviewConfig` picks the tier; the runner logs which one authenticated,
for the same reason the green gate does.

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
| **Fork injection / pwn-request** | Untrusted head code + "approve me" / "run this" instructions in the diff or body | Fork head is checked out only in the unprivileged secretless stage 1; the credentialed stage 2 sees it as an inert data bundle and never executes it. A hijacked reviewer _says_ something wrong, never _does_ something irreversible — because approve is blocked by the org/repo Actions-approval setting and the runner never calls the review-submission endpoint (SM1.R3). |
| **Secret exposure** | A vendor credential or the arcade bearer present while fork code executes | **WIF/OIDC is real on both vendors and is the default** (see §E) — the workflow exchanges its Actions OIDC token for a short-lived vendor token, so there is no standing secret to steal. Static-key fallback lives in an environment secret reachable only by stage 2. The job that _executes_ fork code (R12, R13, R17 live env) holds **no** credential either way; on a fork those gates **degrade** rather than run (SM1.R3). |
| **Trust boundary** | The tripwire is _execution of fork code with a credential_, not reading it | "Clone everything and read it" is always safe (privileged job OK). "Spin it up and bang on it" is the gated act — non-fork or secretless-only. Any new run-fork-code step is visibly in violation of the R13 fork-degrade scenario. |
| **Laundered approval** | `pull-requests: write` also grants APPROVE, and a `github-actions` approval **counts** toward required-approval protection (verified) | No token scope separates comment from approve, so this is defence-in-depth, not a single structural gate: (1) org/repo "Allow GitHub Actions to create and approve pull requests" → **OFF** (the real structural control, and an install prerequisite); (2) "require approval of the most recent reviewable push"; (3) the runner only ever calls `POST /pulls/{n}/comments`, never `/pulls/{n}/reviews` — asserted by the SM1.R3 injected-approve test. |

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

### Runner surface — where the code lives

The functions named below are new and land in the CLI, not in a hook (hooks
cannot import the CLI distribution, and this runs in CI, not in a session):

- `packages/cli/src/pr-review/` — `evaluateTrigger`, `resolveIntent`,
  `subtractCoverage`, `selectVendor`, `crossModelClaim`,
  `boundCompletenessSeverity`, `runAdversary`, `runGate`, `postVerdict`,
  `resolvePrReviewConfig`, and the §D schema.
- `packages/cli/src/cli.ts` — a `safeword review-pr` subcommand is the single
  entry point the workflow invokes (mirroring how `retro-reconcile.yml` calls
  `bun packages/cli/src/cli.ts retro-reconcile`). The workflow YAML stays thin:
  triggers, permissions, the two-job split, and one CLI call per stage.
- `packages/cli/templates/workflows/pr-review.yml` → the `ownedFiles` source
  that `safeword setup` writes to a customer's `.github/workflows/`.

**Wiring proof:** the `review-pr` entry point gets one test built from real
collaborators that mocks only the process boundary (the vendor `spawn`, the
GitHub API, and the arcade MCP endpoint) — config → command → runner wired for
real, so a green fully-mocked unit suite cannot hide a broken entry point.

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
| SM1.R3 fork safety | two-job workflow split (checkout in stage 1, credential in stage 2) + never calling `/pulls/{n}/reviews` | integration (injected-approve, posted-without-running); the fork-degrade scenario waits for slice 7 | **load-bearing #1** |
| SM1.R2 kill switch | `resolvePrReviewConfig` + workflow guard | integration | default-off |
| R6 brokered intent | `resolveIntent()` (linkback → arcade MCP fall-through) | integration | asserts tracker call count |
| R7 completeness cap | `boundCompletenessSeverity()` (PR-cross-reference count → cap) | **unit** + integration | deterministic detector |
| R1 subtraction | `subtractCoverage()` (coverage, not mention) | integration | 3-row outline |
| R2 silence | `postVerdict` (empty findings ⇒ 0 comments, still `reviewed`) | integration | pairs with R9 |
| R11 cross-vendor | `selectVendor()` + `crossModelClaim()` | **unit** + integration | 4-row pairing table |
| R12 base-repro / R13 fix-run | `runGate()` (execute in checkout; **fork ⇒ degrade**) | integration | ties to SM1.R3 |
| R14 adversarial | `runAdversary()` (2nd spawn on findings; contested/annotate, never drop) | integration | vendor verdict injected |
| R17 full checkout | checkout step + "cite an unchanged file" pass-through | integration | substrate for R12/R18 |
| TB2.R2 / NTB1.R4 | verdict mapping (an open question forbids a `reviewed` receipt) + review-body assembly (exactly one decision, positioned last) | integration | the two survivors of the split — both fail for a real runner reason |
| ~~R19 / R20 / TB2.R1 / TB2.R3~~ | **moved to CWGYH0's eval** — judgment-bound, cannot fail for a runner reason | eval | see Known deviations |

### Build order (load-bearing first, each slice builds on green)

0. **Generalize the retro-extract runners** — parameterize prompt + schema +
   input on `runHeadlessExtraction` / `runCodexHeadlessExtractionChecked` and
   the three hardcoded Codex flags; keep retro's behaviour byte-identical, keep
   the `.safeword/` ↔ `templates/` parity pair in sync, keep
   `tests/hooks/retro-extract.test.ts` green. Without this, slice 3 has nothing
   to call. (Discovered by review — an earlier draft assumed free reuse.)
1. **The trust model, at module level** — the capability-narrow poster
   (endpoint allow-list; approve and merge absent by construction) and the
   fork-based execution tier. Proves
   `an_injected_approve_instruction_cannot_produce_an_approval` and
   `a_fork_is_reviewed_and_posted_without_running_the_forks_gates`. The third
   SM1.R3 scenario (`the_fix_gate_degrades_on_a_fork`) **cannot be proven here**
   — a gate that does not exist degrades trivially — so it moves to slice 7.

   **Corrected while building (2026-07-20): the workflow YAML is NOT in this
   slice.** The plan originally put the "two-stage skeleton" here, but any file
   under `templates/` must be registered in `schema.ts` — `checkOrphanTemplates`
   runs in pre-commit's contracts-only mode and hard-blocks an unregistered
   template (`src/parity.ts`). Registering it makes `safeword setup` write the
   workflow into every project, and a workflow invoking a `safeword review-pr`
   command that does not exist yet is a broken install shipped to customers. So
   the YAML and its structural contract test (no `pull_request_target`, stage 1
   secretless, stage 2 never checks out the fork head, no
   `allow-unsafe-pr-checkout`) move to **slice 8**, after the CLI entry point
   exists in slice 3. The trust properties themselves are proven here and do not
   wait on it.
2. **Trigger + authoritative green gate** — R8 (unit truth table, then the
   event→check-runs integration).
3. **Headless invocation + parse** — wire the slice-0 generalized runner behind
   the injected `spawn`, against the §D output schema; R17 checkout.
4. **Verdict surfaces + silence** — R9, R2 (extends slice 1's poster with the
   neutral check-run receipt).
5. **Intent + subtraction + completeness cap** — R6, R1, R7.
6. **Cross-vendor + adversarial** — R11, R14.
7. **Execution gates** — R12, R13, **plus** SM1.R3's fork-degrade scenario,
   which only becomes falsifiable once `runGate()` exists.
8. **Distribution + kill switch** — schema `ownedFiles`, parity pair, `prReview`
   config, SM1.R2.
9. **Verdict mapping + body assembly** — TB2.R2 (an open question forbids a
   `reviewed` receipt) and NTB1.R4 (exactly one decision, positioned last). The
   four judgment-bound Rules that used to sit here moved to CWGYH0's eval; this
   slice is now two real tests instead of six pass-throughs.

---

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Runner architecture | Vendor-agnostic HEADLESS driver: `codex exec` (V1 default) / `claude -p` (V2), reusing `hooks/lib/retro-extract.ts` seams | `anthropics/claude-code-action` (the epic architect-brief's original V1) | claude-code-action is **Claude-only** — it cannot run headless Codex, which is the cross-vendor default's entire point (R11). Same-vendor review launders correlated blind spots as independence. |
| CI-green trigger | `workflow_run`/`pull_request:ready_for_review` event → **check-runs + required-status API** as the authoritative gate | `check_suite.completed` as the gate | `check_suite` fires once per check-producing app; "one app finished" ≠ "all required checks green" (R8). |
| Fork safety | Two-job split by **checkout vs credential**: fork head checked out only in the secretless stage 1; stage 2 holds credentials but treats the bundle as inert data and never executes it | `pull_request_target` + `--add-dir` head checkout; a "poster token that cannot approve" | `actions/checkout@v7` refuses fork head under `pull_request_target` **and** `workflow_run` (verified, backported 2026-07-16). No `pull-requests` sub-scope separates comment from approve, so capability-absence at token level is unachievable — approve is blocked by the org/repo Actions-approval setting instead (verified). |
| Failure posture | Fail-**loud** & non-blocking: error ⇒ no receipt + red job; never a false green | Retro's fail-**open** (`[]`, silent) | The `reviewed` receipt is a trust claim; a swallowed error would masquerade as a clean review. Use `runCodexHeadlessExtractionChecked` (`ok` bit), not the fail-open wrapper. |
| Tracker access | arcade.dev MCP over HTTP (bearer), `Linear_*`, brokered as the PR author, called once, with a bare-linkback fallback | GitHub-app service account; no tracker (linkback-only) | Service account = privilege escalation; linkback-only misses arcade's private-team case where the linkback is bare (R6). |
| Injected inputs | Vendor (`RetroAgent`) and review prompt (G5337S body) are parameters, not runner code | Bake judgment/vendor into the runner | CWGYH0 must reshape judgment without a runner change; R11 must swap vendor per author. |
| Verdict surfaces | `needs-a-human` ⇒ comment; `reviewed` ⇒ non-required neutral check-run; `unreviewable-as-is` ⇒ one note | Always-comment (incl. clean); required check | Always-comment breaks R2 silence; a required check contradicts warn-mode `out_of_scope` and would self-deadlock R8. |
| Distribution | Workflow `.yml` + skill as `ownedFiles`; workflow keyed into the **shared** `.github/workflows/` dir; template↔dogfood parity pair | `ownedDir` for `.github/workflows/`; managedFiles (create-if-absent) | Customers own other workflows (must not own the dir); `ownedFiles` overwrite keeps the reviewer upgradeable — managed-if-absent would strand fixes. |
| Kill switch | `.safeword/config.json` `prReview.{enabled,post,…}`, default-off, runtime-read fail-open-to-disabled | Env var; delete the workflow to disable | Config is the Tricorder precedent (killable without uninstall, SM1.R2); env is invisible to `safeword check`. |
| Reviewer model defaults (2026-07-22) | Codex → `gpt-5.6-sol`; Claude → `claude-sonnet-5` (explicit pin, not the floating `sonnet` alias); Fable/Mythos **warned, not blocked**; all overridable via `prReview.model` | Inherit retro's `gpt-5.5` codex default; hard-block Fable | Retro's `gpt-5.5` is a _summariser_ default — this reads code, and the ask was 5.6. Sol is GPT-5.6's coding + strongest-cybersecurity flagship, the tier a reviewer that inspects auth/billing/injection wants. Fable/Mythos refuse cyber content and _exclude_ security bug-finding, so routing there silently underperforms — but a maintainer may pick it for a non-security repo, so `spawn.ts` warns rather than blocks. (verified: claude-api model guidance; codex GA 2026-07-09.) Claude is pinned to the explicit id, not `sonnet`, so customer-repo reviews stay repeatable and match the model CWGYH0 scores on: decision 2026-07-22 keeps production Claude = Sonnet 5, so the eval (currently `claude-sonnet-4-6`) realigns to `claude-sonnet-5` once the open scoring window closes; the codex `gpt-5.6-sol` path is eval-covered via `createOpenAIRunner` (`SAFEWORD_EVAL_VENDOR=openai`; bare Chat Completions, `reasoning_effort:'none'`, no `temperature` — symmetric with the Anthropic runner so both isolate the prompt). |

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

- **RESOLVED 2026-07-19 — the scenario source was split by proof mechanism.**
  Both of this plan's former blockers were one problem. `findFeatureSourcePath`
  (`packages/cli/src/utils/feature-source.ts:18-20`) resolves a ticket's
  scenarios as `<slug>.feature`, so 36EEMY was looking for
  `pr-review-distribution.feature` while the scenarios sat under the parent
  **epic's** slug — the whole ledger was unenforced prose
  (`project_feature_file_ticket_slug_binding.md`: a mismatched name silently
  orphans a feature from ALL coverage while still linting clean). Fixed by
  `git mv` + subtraction, so the 24 retained scenarios are byte-identical to the
  originals:
  - `features/pr-review-distribution.feature` — **24 scenarios / 15 Rules**,
    binding verified.
  - `features/autonomous-pr-review.feature` — **5 scenarios / 4 Rules**
    (`@eval-bound` holding pen): R19, R20, TB2.R1, TB2.R3. Their Givens describe
    code shape and their Thens assert the model's judgment about it, so under a
    faked `spawn` they assert their own fixture (the tautological-mock
    antipattern; schema validation checks shape, not whether the model read the
    diff correctly). Written into **CWGYH0's `done_when`** so the pen cannot
    become a graveyard.
  - **TB2.R2 stayed with the runner** — its rows vary by an injectable
    concern-state, and it carries a rule R9 does not: an unresolved *question*,
    even with zero findings, forbids a `reviewed` receipt.
  Convention check: children own feature files, epics do not (epic Q4FX8Y holds
  only `ticket.md`; its children carry the full artifact set). The old layout was
  the repo's only epic-with-a-feature-file.
- **The trigger deviates from this ticket's own settled scope, deliberately.**
  `ticket.md` scope says fire "on check-suite conclusion=success". This plan
  makes the event a coarse trigger and puts the authoritative gate on the
  required-check-runs API, because several check suites exist per SHA (per app,
  and per Actions workflow run) so no single suite completing means "all
  required checks are green." R8's Rule — ready AND green, never red — is
  unchanged; only the mechanism is. **The ticket's scope line should be
  reconciled to match, or this deviation overruled.**
- **Reuse of `retro-extract.ts` is partial, not verbatim** — the argv builders
  are parameterized, the runners are retro-coupled (hardcoded schema, prompt,
  and transcript-digest input). Slice 0 generalizes them; that touches a shipped,
  parity-paired, tested surface. An earlier draft of this plan asserted free
  reuse and was wrong.
- **"Structurally cannot approve" was over-claimed and is now corrected.** There
  is no token scope that permits commenting but forbids approving. The
  structural control moved to the org/repo "Allow GitHub Actions to create and
  approve pull requests" setting (an install prerequisite), backed by the runner
  never calling the review-submission endpoint. Weaker than the original claim;
  stated honestly rather than assumed away.
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
- **INTERIM: the tracker is read through one shared service account, not as the
  PR author** (user decision, 2026-07-20). This contradicts R6 in the spec's own
  words — _"no service account, no privilege escalation"_ — so it is logged
  rather than absorbed.
  - **Why now:** per-author brokering needs a GitHub-author → arcade-user id
    mapping that does not exist yet. Waiting on it blocks the entire intent
    wedge, which is the feature's whole differentiator.
  - **The hazard it creates:** the reviewer quotes ticket contents into PR
    comments — that is the product, not a defect in it. A reading identity
    broader than the PR author's turns the reviewer into a confused deputy that
    prints private tickets for whoever can open a pull request.
  - **Containment:** a dedicated **read-only** tracker bot scoped to specific
    teams (never a personal account, and never org-wide), plus
    `shouldReadTracker` refusing the read on fork PRs for as long as identity is
    shared. Same-repo contributors can already read the tracker, so the
    disclosure surface there is ~zero.
  - **Expiry — delete this entry when:** the author → arcade-user mapping lands
    and `prReview.arcade.userId` is unset, which flips `identityMode` to
    `per-author` and re-enables fork reads by construction. The code already
    takes that path; only the config has to change.

### Five modules are staged, not dead (decided 2026-07-20)

`vendor.ts`, `execution.ts`, `certainty.ts`, `subtraction.ts`, `intent.ts` and —
since 2026-07-21 wired through `assembleVendorReview` — `prompt.ts`, `invoke.ts`
and `bundle.ts` are NO LONGER unwired. The remaining five have **no production callers**,
and knip will report them. They are staged, and they stay:

- Each implements a Rule whose ledger row is closed, with its own tests. Their
  scenarios are proven; only the wiring waits.
- Every one is blocked on the same missing piece — the headless vendor
  invocation. `subtractCoverage` filters findings that carry a coverage state the
  MODEL supplies; `boundCompletenessSeverity` takes a referencing-PR count that
  comes from intent resolution; `resolveExecutionTier` is consumed by the R12/R13
  run gates (slice 7). Wiring them now would mean inventing callers for data that
  does not exist yet — speculative structure, which is worse than an unused
  export.
- Deleting and rebuilding them later would discard working, tested code to
  satisfy a linter.

**Not** added to a knip ignore list. An ignore entry would silence them
permanently and mask the day one of them really does become dead; a reader who
hits the report should find this note and see the reason. Revisit when the vendor
slice lands — at that point every one of them acquires a caller, and any that
does not is genuinely dead.

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

- **Three platform assumptions were verified 2026-07-20 and are no longer open**
  — vendor WIF/OIDC (available on both, now the default), check-run creation from
  the workflow token (works; no App needed), and reading the required-check set
  (use the rulesets endpoint at Metadata scope, not the admin-gated
  branch-protection one). Re-verify if any vendor retires WIF or GitHub changes
  the rules endpoint's permission. Still unverified and owed before slice 5: the
  arcade bearer's identity semantics (does it really read **as the PR author**,
  or as the token owner? — R6's non-escalation premise), and the codex/claude
  MCP + sandbox flag details.

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
- **CWGYH0's scoring target decides the prompt's suppression posture** — the
  G5337S draft is deliberately precision-first: it _hard-drops_ sub-bar findings
  (§1 "delete it", §5 "or drop it", §6 the bar). Anthropic's current model
  guidance is explicit that Opus 4.8 / Sonnet 5 / Fable 5 follow drop
  instructions _more literally_, so a recall-scoring eval understates the model
  (it found the bug, then self-suppressed). If CWGYH0 scores posted-verdict
  usefulness the drops are correct and nothing changes; if it scores finding
  recall, the surgical fix is §1/§5/§6 emitting low-confidence/non-blocking
  (the draft already carries `confidence`/`blocking` fields for this) instead of
  dropping. A prompt decision for the eval owner, not a runner change. (verified:
  claude-api migration guidance; skills best-practices "evaluations are your
  source of truth", 2026-07.)
- **A Fable/Mythos model becomes a review candidate** — the runner already warns
  (security refusal + excluded security bug-finding), but if the eval tests it,
  also A/B a _de-scaffolded_ prompt variant: prior-model scaffolding (this draft's
  ~8 gates) reduces Fable output quality, and Anthropic's skills guide calls code
  review a _high-freedom_ task ("give general direction and trust the model").
- **The read-only guarantee is the runner's `--allowed-tools` argv + the
  secretless stage-1 job, not the skill's `allowed-tools` frontmatter** — that
  frontmatter only _pre-approves_ tools (verified: skills best-practices), so if
  the skill is ever driven through a harness that treats frontmatter as the sole
  gate, re-confirm the read-only tier still holds structurally (`spawn.ts`
  `claudeToolsFor`).
- **The product-scout shared attention-layer fork** (ticket.md's open
  architecture question) — floating attention bar (R8/R9 calibration), per-type
  earned-autonomy flywheel, and the mute store are a layer shared with
  product-scout, not runner-local. Do **not** build it into the runner
  unilaterally; it needs ≥1 scored ledger cycle and a user call on build-once vs
  build-twice.
