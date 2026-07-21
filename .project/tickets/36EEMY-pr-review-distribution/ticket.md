---
id: 36EEMY
slug: pr-review-distribution
type: feature
phase: implement
status: in_progress
depends_on: [G5337S, CWGYH0]
phase_anchors:
  - 'define-behavior: .project/tickets/36EEMY-pr-review-distribution/spec.md'
  - 'scenario-gate: features/pr-review-distribution.feature'
  - 'plan-implementation: .project/tickets/36EEMY-pr-review-distribution/impl-plan.md'
scope:
  - Runner is a vendor-agnostic, HEADLESS driver — `codex exec` for V1 (author assumed Claude → review cross-vendor), `claude -p` for V2 — reusing the proven two-vendor spawn seams in `hooks/lib/retro-extract.ts` (RetroAgent, buildCodexExtractArgv, runHeadlessExtraction). NOT `claude-code-action` (Claude-only; cannot run headless Codex, which is the cross-vendor default's whole point).
  - Full checkout of the PR head branch (R17); the vendor invoked headless with the G5337S prompt over the diff + surrounding tree.
  - Auth per vendor, WIF/OIDC preferred, scoped to the single headless invocation: `CODEX_API_KEY` (Codex) / `claude_code_oauth_token`|`anthropic_api_key` (Claude); never a job-level env var in a job that checks out fork code.
  - Trigger gating (R8): fire once when a PR is ready AND CI is green (on check-suite conclusion=success), re-fire only on a material post-ready change that re-greens — never every push, never while red.
  - Verdict output (R9): `needs-a-human` posts a comment; `reviewed` writes a NON-required status-check receipt (not a comment, not an approval); `unreviewable-as-is` posts one note.
  - Fork-PR safety (SM1.R3): read untrusted head as DATA in an unprivileged job (read-only token, no secrets); hand artifacts to a privileged poster carrying NO approve/merge capability. Do not obtain head via `pull_request_target` checkout (actions/checkout v7 refuses it by default); enable "require approval for external contributors".
  - Declared-intent access (R6): reach the tracker as the PR author via arcade.dev MCP over HTTP (bearer token) for private-team linkbacks that omit the issue body.
  - Dynamic subtraction (R1): detect the project's existing quality surface — linters, types, tests, AND peer AI reviewers (arcade runs Cursor Bugbot) — and review only the gap, subtracting on coverage not mention.
  - `safeword setup` distribution: ownedFiles in schema.ts, template↔dogfood parity pairs.
  - Kill switch + per-project trust calibration in `.safeword/config.json` (Tricorder precedent).
out_of_scope:
  - The review judgment itself — G5337S.
  - A required status check / hard block. Warn-mode only (precedent: done-flip guard #460 held to warn-mode).
  - A server/daemon — the runner executes on the customer's CI runners.
done_when:
  - A customer repo gets the reviewer from `safeword setup` with no hand-editing.
  - The runner drives a review headlessly on the configured vendor (codex exec V1 / claude -p V2), never on claude-code-action.
  - The reviewer fires only after CI is green on a ready PR, and re-reviews a material re-green.
  - A fork PR carrying injected instructions is reviewed without those instructions taking effect and without a write/approve token.
  - Nothing Bugbot or the project's CI already reports is surfaced again.
  - A clean PR gets a `reviewed` receipt (status mark), never a comment or an approval.
  - The reviewer can be disabled by config without deleting the workflow.
parent: WAWQA6
created: 2026-07-15T14:24:45.733Z
last_modified: 2026-07-15T14:24:45.733Z
---

# pr-review-distribution

**Goal:** Ship the reviewer into a customer repo: workflow template, ownedFiles, config + kill switch, trigger gating, fork-PR safety. Serves TB1's delivery.

**Why:** Arcade is customer #1 of many, so the reviewer has to arrive as a product rather than a bespoke workflow. Fork-PR injection only becomes real at customer scale — safeword's own repo is 37/40 self-authored, so it never surfaced there.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T14:24:45.733Z Started: Created ticket 36EEMY

## HELD at implement, 2026-07-21 — what this is waiting for

The runner is built and proven: 24/24 scenarios closed, full suite 5398/5398,
Gherkin green, audit passed with 0 errors. Held rather than marked done because
`done_when` #2 — "the runner drives a review headlessly on the configured
vendor" — is NOT met. Everything else in `done_when` is.

Two things were missing. The first was ours and is now done; only the
human-gated one remains. They are kept separate below because conflating them
would have hidden real work behind someone else's gate — and did, briefly.

### 1. The vendor spawn adapter — DONE 2026-07-21 (d031a4bf8)

Built and wired end to end: `reviewPrCommand` → `assembleVendorReview` →
`createVendorRunner` → `spawnSync`. `spawn.ts` is the only place in the runner
that knows a binary name, and it carries the review job's three divergences from
retro's headless child — a real MCP broker instead of `mcp_servers={}`, a
sandbox tiered by execution trust, and a 15-minute cap.

Two things worth knowing for whoever touches this next:

- **Unknown provenance counts as FOREIGN.** `isFork` comes from head-repo
  identity, and an absent `head.repo` (a deleted fork) resolves to `true`, not
  `false`. The first version had this backwards. Skipping a run gate costs one
  finding; executing code we cannot identify is the pwn-request the two-stage
  split exists to prevent.
- **`arcade.mcpServers` must never contain a credential.** It is passed as
  argv, where it would appear in process listings and CI logs. Auth belongs in
  the child's environment, and a test asserts no secret reaches argv.

### 2. The review prompt — NOT ours, human-gated

**This is now the only thing standing between the runner and a real review.**
Everything else is built: the adapter starts a child, the bundle carries the
diff and tree, the job supplies schema and parsing. The runner has nothing to
ASK. The prompt is G5337S's deliverable and the chain is:

    36EEMY (this)   needs a prompt
      └─ G5337S     status: blocked, blocked_on: [CWGYH0]
           └─ CWGYH0  status: in_progress
                └─ arcade engineers must triage the corpus

G5337S's `done_when` is explicit: "The skill scores against CWGYH0's corpus at
or above the bar CWGYH0 recorded BEFORE triage. The eval is this ticket's test
suite — there is no other proof of a prompt's judgment." So the prompt cannot
ship on our say-so.

CWGYH0 is further along than "not started": a pre-registered predictiveness
experiment was frozen on 2026-07-17 over 20 open arcade PRs, with verdicts and
head SHAs recorded before any outcome was known. Scoring was set at ~2 weeks,
so roughly **2026-07-31**. A validated `skill-draft.md` already exists (23KB,
three trial runs plus Nate's triage: 3 of 4 findings useful, one over-rotation
found and fixed).

**The unblock is a human action, not a code change:** arcade engineers scoring
that frozen experiment. If they are too underwater to triage it, CWGYH0's own
ticket says that is itself the answer about whether this reviewer earns its
place.

### What is safe about holding here

The workflow already ships and is inert: default-off, and when enabled it
degrades to a green job logging `no vendor configured` rather than reddening
CI. Nothing is half-installed in a customer repo.

### Merge-time action, independent of the above

This branch is 0.68.0; main is 0.69.0. The workflow pins
`bunx --bun safeword@0.68.0` and `tests/pr-review/workflow-contract.test.ts`
binds that pin to VERSION, so a rebase goes red until it is bumped. CLAUDE.md
now lists the workflow as the fifth release-tracked artifact.

## Steals from product-scout (2026-07-17) — the routing/attention layer

`~/projects/product-scout` is the same machine pointed at a different input: `reconcile(watchlist ↔ world) → collisions → route by attention budget`, vs our `reconcile(diff ↔ intent) → findings → route by attention budget`. Both exist to protect human attention. Four of its solved problems are our open ones. Two corrections already landed in the spec/skill (alternatives→provocation; the plain-language contract). Three need the frozen ledger's act-rate data first, so they live here as design, not code:

1. **Floating attention bar, not a fixed threshold.** product-scout: *"static thresholds are the #1 cause of false positives — the bar floats with human capacity and upstream volume."* Our evidence bar is currently fixed. This is the real answer to "who triages ~225 findings/month": the bar rises when the team is slammed / the PR queue is deep, falls when it's quiet. **Rave candidate — "it got quieter when we got slammed"; no bot does this.** Needs the ledger to calibrate what "slammed" means.

2. **Earned autonomy per finding-type (the flywheel).** product-scout: *"log the agent's leap vs the human's final; when keep-rate is high for a change-type, raise its autonomy — you earn the curve from data, you don't decree it."* Our frozen ledger is the ONE-SHOT version of this; this is the continuous version. Measure act-rate per dimension (evidence-integrity acted-on 80% → let it escalate toward blocking; alternatives 0% → keep it a provocation forever). This is the Tricorder kill-switch as a gradient, and it is how a finding-type ever *earns* the right to block. **Rave candidate — "it asked to block, and it had the receipts."** Precondition: ≥1 scored ledger cycle.

3. **Mutes — "declined, don't re-nag."** We have zero memory: if a maintainer says "that's noise," we say it again next PR — cry-wolf with a loop. product-scout's split: **config = the accepted set; dashboard = pending + mutes.** A muted finding-shape (per repo, per path, per dimension) is suppressed until un-muted. Cheapest of the three and the one most directly tied to the trust deficit; buildable as soon as there's a store for it.

Also noted, lower priority: **tiered routing / the "3 AM test"** (a blocking finding pages; a `noticed-nearby` goes to a weekly digest, NOT onto the PR) and **role-aware routing `(target × role) → owner`** rather than "the PR author" — the honest fix for the scope-finding-on-the-wrong-person's-PR problem.

**Open architecture question (do not resolve unilaterally):** product-scout and pr-review are the same reconcile+route machine. The attention bar, the act-rate flywheel, the mute store, and role routing are a **shared layer**, not pr-review-specific. Whether to build that layer once (serving both) or twice is a real fork — flag to the user before either ticket implements it.

- 2026-07-19T23:05:10.523Z Phase: intake → define-behavior
- 2026-07-20T05:37:00.465Z Phase: define-behavior → scenario-gate
- 2026-07-20T05:37:40.250Z Phase: scenario-gate → plan-implementation
- 2026-07-20T05:37:53.470Z Phase: plan-implementation → implement
