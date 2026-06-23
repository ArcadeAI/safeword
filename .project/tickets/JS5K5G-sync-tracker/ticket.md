---
id: JS5K5G
slug: sync-tracker
title: 'safeword sync-tracker — one-way projection to Linear + GitHub Issues'
type: feature
phase: done
status: done
created: 2026-05-24T21:44:38.516Z
last_modified: 2026-06-23T03:15:00Z
scope:
  - A `safeword sync-tracker` command that projects the ticket corpus one-way (file → tracker) into Linear OR GitHub Issues as FLAT, label-grouped issues. Files stay canonical; the tracker is a projection, never a second master.
  - One call site `projectTicket(payload, provider)` over a provider-neutral `IssuePayload` (title, body, labels[], assignee?, state). Two concrete writers (Linear, GitHub) behind it — no plugin/adapter framework (rule of three; extract at provider #3).
  - Mapping each ticket → flat payload — title (no safeword ID prefix), `epic:`/`type:` labels, state from status (active→open, terminal→closed), body = banner + back-link.
  - Idempotency via a sidecar `.safeword/tracker-map.json` (NOT frontmatter) — first run creates + records ref; re-run updates; partial-failure (pending ref) resumes without double-create; missing/corrupt sidecar refuses to blind-recreate (requires --reset-tracker-map).
  - Field ownership (one writer per field) — safeword owns existence/title/labels/back-link and sets status ONCE at creation; never writes status/assignee/priority on re-sync. The one universal status write is close-on-terminal.
  - Identity — issues created via a bot identity, a back-link to the canonical ticket, and a body banner; no rival ID in the title.
  - Egress — body defaults to `minimal` (no spec/work-log); `full` is opt-in; `full`→public GitHub repo emits a loud egress warning.
  - Secrets — tokens from OS keychain / env var only, never `.safeword/config.json`, never logged; setup warns if provider set but no credential resolves.
  - No-tracker base case — `provider: none` (default) is a friendly no-op (exit 0); set-but-uncredentialed warns loudly (never silent exit 0); unsupported tracker treated as none.
  - CI/non-interactive auth — the `Arcade-User-ID` user-identity limitation is surfaced as an explicit warning naming the silent-failure mode.
  - Corpus writes rate-limited with backoff. All writers tested against mocked clients — no live tracker in tests.
out_of_scope:
  - The dependency-graph projection — epic/parent→sub-issues, blocked_on/depends_on→tracker relations, type→issue-type, topological ordering. This is v2 (M1FGRJ), which depends_on this skeleton.
  - A pluggable adapter interface, `custom` provider, dynamic adapter loading — deferred to provider #3.
  - Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
  - GitHub Projects v2 board placement (and Linear rich-board arrangement) — v1 ships labeled items; the team composes the board. Turnkey placement → v2.
  - The breach→issue caller — deferred stub K51FYZ, blocked on the signals layer (1W107W).
  - Jira, Slack, and any third provider (analyzed for seam-validation only).
done_when:
  - `safeword sync-tracker` projects the corpus one-way to the configured provider as flat issues (title, status→state, epic+type labels, assignee, link-back).
  - Both Linear and GitHub writers ship behind one call site + shared `IssuePayload`, using stable create/update only (no relations/sub-issue/issue-type calls).
  - Field ownership holds — safeword writes existence/title/labels/back-link, sets status once at creation, and on re-sync updates only title/labels and never status/assignee/priority, with the one universal exception of closing the issue when local status is terminal. It touches only issues in its tracker-map.
  - Identity — issues created via a bot identity, carry a back-link to the ticket and a body banner naming the repo as source; no safeword ID in the title.
  - Secrets — tokens read from keychain/env, never `.safeword/config.json`, never logged; setup warns if provider set and no credential resolves.
  - No-tracker base case — `provider: none` is a friendly no-op (exit 0), local system unaffected; a set-but-uncredentialed provider warns loudly instead of silently succeeding.
  - CI auth — the `Arcade-User-ID` user-identity limitation is surfaced as an explicit CLI warning naming the silent-failure mode.
  - Re-running is idempotent via the sidecar; partial-failure resume is tested (no double-create); missing/corrupt sidecar does NOT blind-recreate (reconcile or require --reset-tracker-map).
  - Body egress — default `minimal`; `full` opt-in; `full`→public-repo emits a loud egress warning.
  - Corpus writes rate-limited with backoff; `.safeword/config.json` carries the `ticketBridge` block (default `provider: none`, `body: minimal`).
  - Both writers covered by unit tests against mocked MCP/`gh` clients; no live tracker in tests.
---

# safeword sync-tracker — one-way projection to Linear + GitHub Issues

**Goal:** A `safeword sync-tracker` command that projects safeword's tickets **one-way (file → tracker)** into the customer's real tracker — **Linear and GitHub Issues** — as a **flat, groupable status board** (no dependency graph in v1), while the local files stay the source of truth. Two providers, one call site, a shared payload; no plugin interface.

> **v1 is the walking skeleton:** prove the whole pipe end-to-end — auth → corpus walk → payload → write → idempotent ref → re-run — on the **stable** `CreateIssue`/`UpdateIssue` surface. The **dependency-graph projection** (epic/parent → sub-issues, blocked_on/depends_on → tracker relations, issue-types, topo-sort) is the highest-cost / lowest-adoption / newest-API slice and is deferred to a **v2** ([relations-and-hierarchy projection](../M1FGRJ-tracker-relations-projection/ticket.md)). The graph already renders locally in the INDEX (AKZJXC), so deferring loses no visibility now.

**Why:** Local files are safeword's canonical execution anchor; the tracker is where humans coordinate. These are different layers, not competitors. Ship the projection for the two trackers we actually need (Linear + GitHub) and let the design stay honest to that — two concrete writers, not a speculative adapter framework.

> **History:** absorbs the former "alert-routing layer" (JS5K5G), the "ticket bridge" reframe, and the coordination-mirror ([THSPA5](../THSPA5-external-tracker-mirror/ticket.md), now superseded by this). The breach→ticket use-case is split to a deferred stub ([K51FYZ](../K51FYZ-breach-issue-projection/ticket.md)) — it's a future _caller_ of this command, blocked on the unbuilt signals layer (1W107W).

## Decisions carried forward (load-bearing — do not relitigate)

- **One-way, file canonical.** The command writes outward only; the tracker is a projection, never a second master. Two-way sync was rejected (two masters → conflict/data-loss, network in the agent loop). A read-only advisory pull of _terminal state_ (issue closed + assignee) is a deliberate, separable follow-up — **not v1**.
- **Off the per-turn loop.** Invoked by the `sync-tracker` command and/or CI — **never** a per-turn hook. Keeping the network out of the execution loop is the whole point of the seam.
- **No plugin framework.** Two providers earn a _thin_ seam, not an `Adapter` interface. Rule of three: extract a formal interface at provider #3, from concrete code. ([Metz: duplication is far cheaper than the wrong abstraction.](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction))

## Scope

### The agnostic system (what "one system" means here)

There **is** one provider-agnostic system — it's the invariant that held across Linear, GitHub, and Jira: **one-way projection · field-ownership (never own status) · `IssuePayload` · identity/banner · sidecar idempotency · project items, not the board.** The reason it holds: providers diverge most on **status** (Linear rich states / GitHub open-closed / Jira gated workflow), and that's exactly the field safeword **refuses to write** — so the abstraction never has to _unify_ status semantics. Ceding status is what makes provider-agnosticism possible. The only universal status write is **close the issue when local status is terminal** — every tracker supports that.

- **Rule of three holds** (Linear + GitHub in scope; Jira analyzed, out). No plugin framework. But `IssuePayload` + the single `projectTicket(payload, provider)` call site **are the proto-contract** — the v3/Jira extraction is a _rename_, not a redesign. Two known v3 widenings are deliberately anticipated: `body` (markdown → ADF), and a capabilities descriptor (below).
- **Capability variance**, when v2 needs it, is a tiny declarative **per-provider capabilities descriptor** the core _queries_ — `{ bodyFormat: 'markdown'|'adf', boardModel: 'native'|'projects'|'columns', canRelations, canSubIssues, canIssueTypes }` — not scattered `if (provider===)` (the WordPress-connectors / Next.js-feature-matrix pattern). v1 barely needs it; it's where v2's graph divergence lands cleanly.

### Single call site + shared payload

All projection funnels through **one** function with a provider-neutral payload — so the eventual provider #3 extraction is a refactor of one place, not a scatter of `if provider ===` conditionals:

```ts
type IssuePayload = {
  title: string;
  body: string; // v1: markdown. NOTE: Jira needs ADF JSON → widens to `string | AdfDocument` (or per-writer transform) at Jira time — the one non-neutral field.
  labels: string[]; // includes epic:<slug> and type:<type> so the board groups/filters
  assignee?: string;
  state: 'open' | 'closed';
};
function projectTicket(payload: IssuePayload, provider: 'linear' | 'github'): Promise<TrackerRef>;
```

### Two writers (the thin seam)

Both use only **stable create/update** endpoints — no relations/sub-issue APIs in v1, so both providers can even route through Arcade if convenient:

- **Linear** — `Linear_CreateIssue` / `UpdateIssue` via Arcade.dev MCP ([verified](https://docs.arcade.dev/en/resources/integrations/productivity/linear)); Arcade handles OAuth.
- **GitHub Issues** — create/update via the `github` MCP / `gh` (or Arcade's GitHub toolkit, which covers create/update/list — [verified](https://docs.arcade.dev/en/resources/integrations/development/github)). No sub-issue/dependency/issue-type calls in v1, so none of the new-API gotchas apply.

> **Note for v2:** Arcade's GitHub toolkit is create/update/list only — it lacks sub-issues/deps/types — so the v2 graph projection routes GitHub natively (`gh`, [dependencies CLI 2026-06-10](https://github.blog/changelog/2026-06-10-manage-sub-issues-types-and-dependencies-from-github-cli/)). Not a v1 concern.

### Provider shape — safeword projects items, not the board (`figure-it-out` 2026-06-21)

The two trackers are shaped differently, and the design holds because **safeword projects the _items_ (issues) and their truth; each tracker's own coordination layer arranges them.**

|                                   | Linear                                   | GitHub                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the **board/roadmap** lives | the issue list _is_ the board            | **Projects v2** ([verified](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)) — a separate layer over issues                 |
| **Status** model                  | rich workflow states, auto-moved off PRs | **open/closed only**; rich status is a Projects v2 field. Only native automation: **auto-close on linked-PR-merge** (toggleable) — so field-ownership collisions are _milder_ than Linear |
| **Bot identity**                  | native integration actor                 | a **GitHub App** = `safeword[bot]` (own identity, 15k/hr); a PAT degrades to user-attribution                                                                                             |
| **Back-link**                     | native attachment                        | a **body link / cross-reference** (no native attachment object)                                                                                                                           |

**Consequence:** on GitHub, v1's flat issues are a **labeled list, not a board** — the team composes a Project view over the `epic:`/`type:` labels (2 minutes), or gets turnkey Projects-v2 placement in **v2** ([M1FGRJ](../M1FGRJ-tracker-relations-projection/ticket.md)). Owning the team's board layout is the same human-coordination authority we cede for status/cycles — so safeword stops at the items. Egress matters _more_ on GitHub (issues often share the code's repo, often public) — the minimal-body default is load-bearing, not cosmetic.

**Jira readiness** (third provider, still out-of-scope — captured because it _validates_ the seam). Jira status is a **gated workflow state machine**: you can't set arbitrary status via API, only valid transitions, which can be rejected by validators ([verified](https://developer.atlassian.com/cloud/jira/platform/modules/workflow-validator/)) — so create-and-cede isn't just clean, it's the only workable choice (field-ownership reinforced). Board is automatic (issues land in the initial-status column, like Linear, no separate layer). Writer-level deltas for whenever Jira lands: **never map status** (create in the workflow's initial status); **call createmeta** to satisfy per-project required fields or creates fail; **body is ADF JSON**, not markdown ([verified](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)); `type` → a **required Jira issue type**. The graph (v2) maps most natively of the three — native `parent` + issue links + issue types.

### Coordination mapping (the payload builder)

`sync-tracker` walks the ticket corpus and maps each ticket to a **flat** `IssuePayload`:

| safeword | Linear         | GitHub Issues |
| -------- | -------------- | ------------- |
| ticket   | issue          | issue         |
| `status` | workflow state | open/closed   |
| `epic`   | `epic:` label  | `epic:` label |
| `type`   | `type:` label  | `type:` label |

Grouping/filtering by epic and type comes from **labels** (free, stable) — that's the roadmap's grouping without the sub-issue API. Ordering (the dependency graph) is v2.

### What goes in the body (egress default — `figure-it-out` 2026-06-20)

**Fail-safe default:** project **title + status + labels + a link back** to the canonical ticket — **never** the spec/work-log body. That's the whole flat board view; the body is pure nice-to-read. Saltzer & Schroeder fail-safe defaults — the default's worst case is "sparse issue," never "leaked internal reasoning to a world-readable tracker." ([principles](https://nocomplexity.com/documents/securityarchitecture/architecture/saltzer_designprinciples.html))

- Full body is **opt-in per project** (`ticketBridge.body: "minimal" | "full"`, default `minimal`).
- **Public-repo warning:** projecting `body: full` to a **public** GitHub repo emits a loud warning (egress notice). No ack-flag ceremony — the minimal default already makes the leak path opt-in.

### Idempotency (partial-failure-safe)

Re-running reconciles, never duplicates, via a per-ticket `TrackerRef` kept in a **sidecar `.safeword/tracker-map.json`** — _not_ ticket frontmatter, so the canonical files stay pure (no sync write-back into the source of truth). The map distinguishes "created + ref recorded" from "created but ref-write failed" so a crashed mid-corpus run resumes cleanly rather than double-creating. Rate-limited writes with backoff (a first sync is one call per ticket across the corpus). (On Linear, the back-link **attachment** URL is also a native per-issue unique key — a secondary anchor, but the sidecar stays canonical for cross-provider uniformity.)

### Birthplace — internal-first vs external-first (`figure-it-out` 2026-06-22)

Not every unit of work is born as a safeword ticket projected outward. The deciding axis is **execute vs coordinate**, and the heuristic is one question:

> **"Am I starting the work now?"** → **internal-first** (create the safeword ticket — the execution anchor — then project it out). Otherwise → **external-first** (file it straight in the tracker's triage/inbox), and **promote to an internal ticket on pickup.** When in doubt, file external — it's the cheap, reversible choice that lives in triage until someone commits.

- **Internal-first:** work you're executing now — it needs the anchor (spec, scenarios, work log, `blocked_on` gate). The default for agent-driven build work.
- **External-first:** coordination-only items — bug reports, feature requests, process ideas, not-now follow-ups — that humans/users file where they live (the tracker's [Triage inbox](https://linear.app/docs/triage)). Creating a local anchor before there's anything to execute is empty ceremony.
- **Promotion (external → internal) on pickup:** a _creation_, not a back-sync (one-way still holds). `safeword ticket new` makes the anchor, links it to the originating issue (`external: <issue-url>` on the ticket; a "now tracked by ticket X" note on the issue), and from then on it projects file→tracker normally. The issue's prior human discussion stays in the tracker (humans own comments — field ownership). Fire the dedup nudge (1GGD28) at `ticket new` so a promotion doesn't duplicate an existing ticket/issue.

Reconciles with field ownership: an external-first item is a "human-born issue safeword doesn't manage" **until** promoted. _Worked example:_ GitHub issue #333 (a process improvement, out-of-scope for current work, filed for team prioritization) was correctly **external-first**; it becomes an internal ticket only if/when we build it.

### Field ownership — one writer per field (`figure-it-out` 2026-06-21)

The collision risk is that safeword and Linear both move the same issue (Linear auto-statuses off PRs). Resolved by the **single-writer-per-field** rule ([source](https://fintechly.com/infrastructure/infrastructure-system-of-record-vs-source-of-truth/)) — the Terraform `ignore_changes` posture: own the fields you declare, look away from the rest.

| Field                                                                 | Sole writer                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| issue **existence**, **title**, back-link, `epic:`/`type:` **labels** | **safeword** (repo-derived)                                                                          |
| **status** (after creation), **assignee**, **priority**, **cycle**    | **Linear / GitHub** — safeword sets status **once** at creation (`open`), then never writes it again |

- safeword **manages only issues it created** (tracked in the sidecar). Human-born Linear issues are never touched — no parallel jurisdiction.
- Local status and tracker status are allowed to diverge: they're _different fields wearing the same name_ — local status is the agent's **execution phase**; tracker status is the **human workflow state** (Linear derives it from PRs, which it does better than we could).
- On re-sync safeword writes only its own fields (title, labels, closed-state) — fewer fields than a full push, so this also keeps v1 lean.

### Identity — avoid ticket-vs-issue confusion (`figure-it-out` 2026-06-21)

Ride each tracker's native provenance; add one banner. No competing IDs.

- **Bot identity:** create issues through a non-human actor so the tracker flags them machine-made for free — Linear's native [integration actor](https://linear.app/developers/agents), or a **GitHub App** = `safeword[bot]` ([own identity](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app); rate limit ~5k–12.5k/hr by org size/plan, not the Enterprise-only 15k). A GitHub PAT degrades to "created by `<user>`" — App preferred.
- **Back-link:** Linear → native [attachment](https://linear.app/developers/attachments); GitHub → a **body link / cross-reference** (no native attachment object). Either way: `safeword ticket MBGQ89 → <repo URL>`.
- **Body banner:** `🔁 Mirror of safeword ticket MBGQ89. Source of truth is the repo. Status & assignee are yours to set here; title & labels sync from the repo and overwrite edits.`
- **No ID in the title:** the tracker already stamps its own (`LIN-123` / `#123`); a second `[MBGQ89]` prefix is a rival identifier (more confusion). Bind via the back-link; each keeps its own ID.
- **Vocabulary discipline (everywhere):** safeword always says **"ticket"** for the repo file and **"issue"** for the projected Linear/GitHub object — docs, CLI output, and the banner.

### Configuration & setup (secrets stay out of the repo)

> The **interactive wiring** — when connect is triggered and where the human authorizes (OAuth / GitHub App / PAT) + verify-before-sync — is owned by the sibling [tracker-connect-flow (2TK5AD)](../2TK5AD-tracker-connect-flow/ticket.md). This section is the config/secret _shape_ it writes.

Configured during `safeword setup` (opt-in). **Non-secret** provider/target lives in committed config; the **token never does.**

```json
// .safeword/config.json — committed, NO secrets
{
  "ticketBridge": {
    "provider": "none" | "linear" | "github",
    "body": "minimal" | "full",
    "target": { "workspace": "…", "team": "ENG", "repo": "owner/name" },
    "defaultAssignee": "oncall@example.com"
  }
}
```

- **Default `provider: none`** — solo/agent-only repos are never forced into tracker config; `body: minimal` for least egress.
- **Secrets hierarchy** ([verified best practice](https://workos.com/blog/best-practices-for-cli-authentication-a-technical-guide)): OS keychain (preferred) → env var (`LINEAR_API_KEY` / `GITHUB_TOKEN` / Arcade key) → never a committed file, never logged. `safeword setup` writes the token to the OS keychain or prints the env-var to export — it does **not** put it in `.safeword/config.json`.
- **Setup validation:** if `provider !== none` but no credential resolves, setup warns loudly (prevents the silent "CI sync runs, does nothing, exits 0" trap).
- **CI / non-interactive auth:** Arcade Headers mode works, but `Arcade-User-ID` is a **user identity, not a service account** — if that user's OAuth grant lapses, sync fails (often silently). v1 must either pin a dedicated service identity or document the limitation with an explicit CLI warning (see Done-when).

### When no tracker is configured (the base case, not a failure)

The entire **local** system — tickets, work logs, the `blocked_on` gate, the INDEX, the dependency graph — works standalone with **zero** tracker. Projection is purely additive; removing it changes nothing local. (If "no tracker" were degraded, we'd have coupled execution to an external service — the seam refuses exactly that. No-tracker working is the design's proof.) Three unconfigured behaviors:

1. **`provider: none` (default)** — `sync-tracker` is a friendly no-op: prints "no tracker configured; run `safeword setup` to add one", exits 0. Never an error; solo/agent-only repos never see tracker surface at all.
2. **Provider set but no credential resolves** — loud warning, non-zero/visible failure; **never silently exits 0** (the CI "runs, does nothing, looks fine" trap).
3. **An unsupported tracker** (Asana/Trello/plain text/none of the above) — treated as `none` for v1; local system fully functional; the `custom` adapter is the deferred path (out of scope).

## Out of scope

- **The dependency-graph projection** — epic/parent → sub-issues, blocked_on/depends_on → tracker relations, `type` → issue-type, and the topological-parent ordering they require. This is the **v2** ([relations-and-hierarchy projection](../M1FGRJ-tracker-relations-projection/ticket.md)), which `depends_on` this skeleton.
- A pluggable adapter interface, `custom` provider, dynamic adapter loading — deferred to provider #3.
- Two-way sync / read-back of human edits — terminal-state advisory pull is a later, separable follow-up.
- **GitHub Projects v2 placement / board** (and Linear-side rich board arrangement) — on GitHub the board is a Projects v2 layer, not the issues; v1 ships labeled issues (items), the team composes the board. Turnkey Projects-v2 placement → v2 ([M1FGRJ](../M1FGRJ-tracker-relations-projection/ticket.md)).
- The **breach→issue** caller — deferred stub [K51FYZ](../K51FYZ-breach-issue-projection/ticket.md), blocked on signals (1W107W).
- Jira, Slack, and any third provider.

## Open questions

- **Status ownership & ticket-vs-issue confusion** — RESOLVED (`figure-it-out` 2026-06-21): one-writer-per-field (safeword owns existence/title/labels/link, sets status once; Linear owns status/assignee thereafter); safeword manages only issues it created; identity via bot-actor + back-link attachment + body banner; no rival ID in the title. See the Field ownership / Identity sections.
- **CI service identity** — Arcade Headers mode works, but `Arcade-User-ID` is a user identity, not a service account (silent-failure risk on grant lapse). Now a **Done-when** item: support a dedicated service identity or emit an explicit CLI warning. (Promoted from "decide later" — it's the one security-relevant open question.)
- **Cadence** — explicit command only, post-commit, or scheduled CI? Lean: explicit command + optional CI.

## Done when

- `safeword sync-tracker` projects the corpus one-way to the configured provider as **flat issues** (title, status→state, labels for epic+type, assignee, link-back).
- Both Linear and GitHub writers ship, behind one call site + shared `IssuePayload`, using **stable create/update only** (no relations/sub-issue/issue-type calls).
- **Field ownership** holds: safeword writes existence/title/labels/back-link and sets status once at creation; on re-sync it updates only title/labels and **never** writes status/assignee/priority — with **one universal exception**: it closes the issue when local status is terminal (the only status write, supported by every tracker). It touches only issues in its tracker-map.
- **Identity:** issues are created via a safeword bot identity, carry a back-link to the canonical ticket, and a body banner naming the repo as source; no safeword ID in the title.
- **Secrets:** tokens are read from OS keychain / env var, never `.safeword/config.json`, never logged; `setup` warns if `provider !== none` and no credential resolves.
- **No-tracker base case:** with `provider: none` (default), `sync-tracker` is a friendly no-op (exit 0) and the local system is fully unaffected; a set-but-uncredentialed provider warns loudly instead of silently succeeding.
- **CI auth:** the `Arcade-User-ID` user-identity limitation is resolved — either a dedicated service identity is supported, or the CLI emits an explicit warning naming the silent-failure mode.
- Re-running is idempotent via the `.safeword/tracker-map.json` sidecar; **partial-failure resume** is tested (a crash mid-corpus does not double-create). **Missing/corrupt sidecar** at re-run does NOT blind-recreate — it reconciles by scanning for the back-link, or requires an explicit `--reset-tracker-map`.
- **Body egress:** default `minimal` (no spec/work-log body); `full` is opt-in; `full`→public-repo emits a loud egress warning.
- Corpus writes are rate-limited with backoff.
- `.safeword/config.json` carries the `ticketBridge` block (default `provider: none`, `body: minimal`).
- Non-interactive auth path (Arcade Headers + the service-identity caveat) documented.
- Both writers covered by unit tests against mocked MCP/`gh` clients; no live tracker in tests.

## Work Log

- 2026-06-23T03:14:00Z Complete: verify + done-gate. /verify: full suite 3292/3293 pass (1 pre-existing flaky cucumber dogfood test — passes 2/2 in isolation; not JS5K5G), 5 pre-existing skips. /audit passed (0/0 on changed surfaces). /quality-review (≥2-loop done-gate): web-verified the gh interface; independent reviewer found two real holes → fixed: (1) AC8 crash-safety was test-only (markPending never reached in production) → projectOne now persists per ticket (markPending+save→record+save) so a mid-corpus crash reconciles, not double-creates; (2) AC13 retry unreachable live → runGh rethrows RateLimitError on rate-limit signals. Re-review APPROVE. +7 tests (61 tracker-sync total). gh label-preexistence documented as a v1 limitation.
- 2026-06-23T02:40:00Z Complete: implement (6 build steps, bottom-up TDD) — payload (f4c50ee), tracker-map sidecar (827655a), secrets+backoff (fafa40d), writers+TrackerClient seam (1e86033), orchestrator single call site (6412112), CLI command + config read + corpus walk + live gh adapter (1328141). 54 tracker-sync unit tests; all 21 scenarios stamped. Full suite 3286 passed / 5 pre-existing skips (222 files, exit 0); eslint + tsc + gherkin + depcruise (no violations) + jscpd (0 clones) + sync-config (in sync) all clean. impl-plan reconciled → implemented; Linear live client deferred to 2TK5AD (writer logic ships + tested). Advanced to verify.
- 2026-06-23T01:40:00Z Complete: scenario-gate — independent /review-spec pass returned CHANGES REQUESTED (2 blockers: AC5↔AC9 missing-sidecar conflict; vacuous "no writer calls"). Resolved: connect seeds an empty sidecar so present+empty=first-run vs absent=lost-refuse (AC9 now covers missing AND corrupt); AC1 drops the vacuous clause, AC2 → Scenario Outline (linear|github) with a call-recording stub. Applied should-strengthens (AC3 back-link URL, AC7 payload field-set, AC11 sentinel, AC13 fake-timer retry-count, AC10 warn-before-create). Re-review PASS, 0 blocking. Wrote impl-plan.md (tracker-sync/ module, all-unit test layers, 6-step build order); stamped Tier-2 review. 21 scenarios / 11 rules. Advanced to implement.
- 2026-06-23T01:32:00Z Complete: define-behavior — distilled scope/out_of_scope/done_when into frontmatter, authored spec.md (JTBD sync-tracker.TB1, persona TB, 13 ACs), dimensions.md (10 dimensions), features/sync-tracker.feature (20 scenarios across 11 rules, @wip — proof lives in vitest), test-definitions.md R/G/R ledger. AC-coverage clean. Advanced to scenario-gate.
- 2026-05-24T21:44:38.516Z Started: Created ticket JS5K5G.
- 2026-05-24T21:45:00.000Z Drafted: alert-routing scope.
- 2026-06-20T11:58:00Z Reframed alert-routing → generic ticket bridge.
- 2026-06-20T12:32:00Z Collapsed to `safeword sync-tracker` (per the simplify + Linear+GitHub figure-it-out). Dropped the adapter framework (two providers → thin two-writer seam, single call site + shared payload; extract an interface at #3). Absorbed THSPA5's coordination mapping (superseded it). Breach caller split to deferred stub K51FYZ. Removed epic membership (WG3Z2N deleted); slug ticket-bridge → sync-tracker.
- 2026-06-20T16:12:00Z Applied quality-review + figure-it-out fixes (egress default, sidecar TrackerRef, auth resolution, corrected the Arcade-GitHub fact).
- 2026-06-20T16:16:00Z **De-bloated to a walking skeleton** (`/figure-it-out`). Cut the dependency-graph projection — epic/parent→sub-issues, blocked_on/depends_on→relations, type→issue-type, topo-sort — to a **v2** (M1FGRJ), keeping v1 to flat issues on stable create/update. Rationale: the graph is the highest-cost / lowest-adoption / newest-API slice (GitHub deps API is 10 days old), and it already renders locally in the INDEX. `epic`+`type` become **labels** so v1 is still a groupable board. Flatness dissolved the Linear-first question (both providers ship, both stable). Simplified the public-repo guard from refuse+ack to a warning.
- 2026-06-21T15:48:00Z Resolved the projection's two collision points via `/figure-it-out`. **Field ownership** (one-writer-per-field, Terraform `ignore_changes` posture): safeword owns existence/title/labels/link + status-at-creation; Linear owns status/assignee thereafter; safeword manages only issues it created. **Identity** (avoid ticket-vs-issue confusion): ride Linear's native bot-actor + back-link attachment, add one body banner, keep each system's own ID (no `[MBGQ89]` title prefix to fight `LIN-123`), enforce ticket/issue vocabulary discipline. Both close the rebuild-risks from the Linear-baseline sanity check.
- 2026-06-21T16:06:00Z Stress-tested the plan against **GitHub as tracker** (`/figure-it-out`). Architecture holds; field-ownership gets _easier_ (GitHub status = open/closed, only auto-close-on-merge automation). Added a **Provider-shape** section — key finding: on GitHub the board is **Projects v2**, a separate layer, so v1's flat issues are a labeled _list_, not a board. Reframe: **safeword projects items, not the board**; turnkey Projects-v2 placement deferred to v2 (M1FGRJ). Identity generalized: GitHub uses a **GitHub App** (`safeword[bot]`) + body-link back-reference (no native attachment). Flagged egress is sharper on GitHub (issues share the code's, often public, repo).
- 2026-06-21T16:16:00Z Stress-tested against **Jira** (`/figure-it-out`). Plan holds; Jira _validates_ the hardest call — its status is a gated workflow state machine (no arbitrary set; validators can reject), making create-and-cede field-ownership mandatory, not just clean. Board is automatic (initial-status column, like Linear). Captured a compact Jira-readiness note in Provider-shape: never map status, createmeta for required fields, ADF body, type→required issue type; the v2 graph maps most natively (parent + links + issue types). Meta: the seam survived all three trackers — invariant = project items + truth one-way, never own status, tracker arranges them.
- 2026-06-21T16:24:00Z `/quality-review` of the agnostic system + setup-config requirement (web research + independent reviewer). Verdict NEEDS DISCUSSION → applied fixes. Named **the agnostic system** = the cross-tracker invariant; key insight: ceding status is what _makes_ it agnostic (the max-divergence field is the one we don't write; only universal write = close-on-terminal). Documented `IssuePayload`+call-site as the proto-contract (v3 = rename), the `body` markdown→ADF widening, and a queried **capabilities descriptor** for v2 (not a plugin framework). Added **setup + secrets**: provider/target in committed config, **token in OS keychain/env var, never config, never logged** (verified best practice), setup warns if provider set w/o credential. Promoted the **Arcade-User-ID service-identity** gap to Done-when. Fixed GitHub rate-limit (5k–12.5k, not 15k), added sidecar missing/corrupt resilience (no blind recreate), clarified close-on-terminal as the one status write.
