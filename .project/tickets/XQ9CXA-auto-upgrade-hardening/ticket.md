---
id: XQ9CXA
slug: auto-upgrade-hardening
type: task
phase: intake
status: in_progress
created: 2026-06-20T05:50:13.291Z
last_modified: 2026-06-20T05:50:13.291Z
---

# Harden seamless auto-upgrade apply path

**Goal:** Make safeword's existing client-pull auto-upgrade land sooner and stop blocking session start, and make the failure path actionable instead of repeating noise — without changing the core architecture.

**Why:** The current two-hook mechanism is sound but the apply hook (a) runs **synchronously** so a pending upgrade blocks session start on a network fetch, (b) is structurally one session behind the check, and (c) on repeated failure prints a non-actionable line every session that leaks the raw error. A second /figure-it-out pass demoted the provenance item — see below.

## Decision context (from /figure-it-out, revalidated)

Architecture is **settled, not replaced**. Safeword's payload is a multi-agent, in-repo footprint
(`.cursor/rules/*.mdc`, `codex/config.toml`, `AGENTS.md`, `SAFEWORD.md`, committed `.safeword/hooks/*`)
that must be materialized on disk in the customer repo and carried in their git history.

Ruled out — **Claude Code native plugin auto-update**: it only refreshes the plugin cache and only for
Claude Code, so it cannot maintain the cross-agent in-repo footprint. Keep it only for the thin
bootstrap plugin (the "run setup" nudge); consider commit-SHA versioning there so the entry point
self-freshens. Refs: https://code.claude.com/docs/en/discover-plugins.md,
https://code.claude.com/docs/en/plugins-reference.md

Ruled out as default — **stage-don't-commit**: avoids bot commits in customer history but is no longer
seamless (upgrade only persists when a human commits; other sessions see a half-applied diff). Keep it
as an **opt-in mode** (`config.autoUpgrade: "stage" | "commit"`), not the default.

Note: bun is guaranteed present post-install (every hook runs via `bun`), so the `bunx`-vs-`npx`
fallback concern is moot — do not spend effort there.

## Revalidation findings (round 2)

- **#1 strengthened.** Confirmed in `.claude/settings.json`: the auto-upgrade hook has **no `async` flag**
  (it blocks), while only `session-update-check` is `async: true`. So today's design is the worst of both —
  laggy AND blocking. Merging fixes both.
- **#2 reframed.** The current `catch` is **not silent** — it `console.log`s
  "...will retry next session. ${message}" every session, leaking the raw error. The real defect is
  repeating, non-actionable noise that never escalates, not invisibility.
- **#3 demoted (evidence-based).** Bun **does not run postinstall scripts by default**
  (https://bun.com/docs/pm/lifecycle) — the primary supply-chain RCE vector is already closed at the
  client. Combined with the existing 24h release-age cooldown, the residual threat is only a _valid-but-
  malicious publish_ (CI/token compromise) whose payload is the reconciled hook files themselves —
  which client-side sigstore verification in a Bun hook addresses only at high cost
  (`npm audit signatures --json --include-attestations`, https://docs.npmjs.com/cli/audit/). Disproportionate.
  Decision: **defer the build; document the threat model**; cooldown stays primary.

## Scope (ordered by leverage)

### 1. Make apply non-blocking AND collapse the one-session lag (DX + elegance) — DO FIRST

- Today `session-update-check.ts` (async) writes `.update-cache.json` _this_ session; `session-auto-upgrade.ts`
  (sync, blocking) only applies it _next_ session. Result: upgrades are one session late and they stall
  session start when they do fire.
- Move the apply off the blocking path and have it check + apply in one pass (no cache-as-IPC lag).
- **RESOLVED → Design C (`asyncRewake`).** Per https://code.claude.com/docs/en/hooks.md: a plain
  `async: true` hook has its stdout/stderr **discarded** (can't message the user), but an **`asyncRewake`**
  hook runs detached AND — on exit code 2 — delivers its stderr to Claude as a system reminder. So neither
  design A nor B: a single non-blocking hook that exits 2 to surface "upgraded / major available / blocked"
  and exits 0 to stay silent. Degrades safely — a Claude Code build that doesn't know the flag treats the
  entry as an ordinary sync hook (today's blocking behavior), so worst case is status-quo, not a regression.
- **DONE (increment 1a):** apply flipped to `asyncRewake` (non-blocking) + message paths routed through
  exit-2; transient/opt-out skips now silent. The cache-merge / lag-kill (single check+apply pass, delete
  `session-update-check.ts`) is the next increment (1b).
- Note: a settings.json/hook change from an upgrade only takes effect **next session** anyway (CC reads
  settings.json at start), so async apply loses nothing there — it only removes the blocking stall.
- Preserve all existing guards (dogfood, dirty tree, CI, opt-outs, 24h release-age cooldown) and the
  `bumpType`/`upgradeDecision` policy (patch/minor apply, major notify).

### 2. Make the failure path actionable, not repeating noise (resilience)

- Current `catch` prints "...will retry next session. ${message}" every session and never escalates —
  noisy, non-actionable, and leaks raw `error.message`.
- Add a strike counter to the update cache; after N consecutive failures **stop retrying quietly** and
  switch to a single actionable line ("auto-upgrade blocked after N tries — run `safeword upgrade`, or
  disable with `config.autoUpgrade=false`"). Stop echoing raw errors to the transcript.
- Widen pre-flight beyond dirty-tree to also skip on detached HEAD / in-progress merge or rebase
  (these are the real-world causes of the repeated commit failure).

### 3. Provenance verification — DEFER, document threat model

- Do **not** build client-side sigstore provenance verification now (see Revalidation #3 — disproportionate
  to the residual threat once bun-no-postinstall + 24h cooldown are in place).
- Instead: write a short threat-model note in the hook/docs stating what each layer defends
  (bun-no-scripts → postinstall RCE; cooldown → yank window; provenance → valid-malicious-publish, accepted
  residual risk). Revisit if Arcade ships to higher-assurance customers.

### Follow-on (smaller, separable)

- `config.autoUpgrade: "stage" | "commit"` opt-in mode for teams that forbid bot commits.
- Bootstrap plugin: commit-SHA versioning so the "run setup" entry point self-freshens via CC native update.

## Acceptance criteria

- [~] A pending upgrade no longer blocks session start (DONE via asyncRewake, 1a); no structural one-session lag (1b, pending); template tests updated and green.
- [x] Async-stdout open question resolved → Design C (asyncRewake); notify/upgraded/blocked surfaced via exit-2, pinned by `config.test.ts`.
- [x] All existing guards + the `upgradeDecision` policy preserved (pinned by unit tests; targeted suite + parity green).
- [ ] After N failed attempts the hook stops retrying and prints one actionable line; raw errors no longer echoed; pre-flight covers detached HEAD / merge / rebase.
- [ ] Threat-model note written; provenance verification explicitly deferred with rationale (no sigstore code).
- [ ] Validated via template/unit tests — NOT by live-upgrading the dogfood repo (pinned v0.49.0 vs source v0.52.1).

## Premortem

Most likely failure 6 months out: #1 done badly — moving apply to async introduces a race or swallows the
notify/blocked messages (async stdout not surfaced), so customers silently stop seeing upgrades _and_ stop
getting told why. Mitigation: resolve the async-stdout question first and gate the design on it; never let
"blocked" go invisible.

## Work Log

- 2026-06-20T05:50:13.291Z Started: Created ticket XQ9CXA
- 2026-06-20T05:50:00Z Plan captured from /figure-it-out: architecture confirmed (in-repo reconcile + self-commit), three ordered hardening items, native-plugin and stage-only options ruled out with rationale.
- 2026-06-20T05:49:00Z Installed deps: `bun ci` succeeded (2510 packages, build OK, exit 0).
- 2026-06-20T07:25:00Z Increment 1b DONE (lag-kill + merge). Folded the npm registry fetch into session-auto-upgrade.ts (`fetchLatestFromNpm` + `loadOrRefreshCache`, 24h-throttled, atomic write); check + apply now run in one non-blocking pass so an upgrade lands the session it's discovered. Deleted session-update-check.ts (template + dogfood), its schema ownedFiles entry, config.ts wiring + now-unused `asyncHook` helper, the dogfood settings.json async entry, and the hook-coverage exemption; updated update-cache.ts doc comment. Re-synced dogfood copies (byte-identical). Green: typecheck, bun build-check of merged hook, targeted vitest 86, release/parity suite 7 (incl. dogfood-parity). Full suite running for final pre-commit verification.
- 2026-06-20T07:09:00Z Increment 1a DONE. Resolved async-stdout open question via hooks docs → Design C (asyncRewake degrades to status-quo on old CC). Flipped apply to non-blocking asyncRewake; routed upgraded/major/blocked through exit-2 stderr; silenced transient/opt-out paths; dropped raw-error leak in catch. Files: src/templates/config.ts (asyncRewakeHook helper + wiring), templates/hooks/session-auto-upgrade.ts (+ byte-synced dogfood copy), .claude/settings.json (asyncRewake flag), config.test.ts (design pin). Green: targeted vitest 57, config 19, dogfood-parity release 1, typecheck, eslint. Next: 1b (merge update-check, kill lag), then #2 (strike counter / actionable failure).
- 2026-06-20T05:52:00Z Revalidated (round-2 /figure-it-out). Confirmed apply hook is sync/blocking (settings.json) and the catch prints raw errors every session (not silent). Evidence: bun blocks postinstall by default → demoted #3 (provenance) to deferred-with-threat-model. Reframed #2 (noise, not silence). Strengthened #1 (fixes blocking, not just lag) and added the async-stdout open question gating design A vs B.
