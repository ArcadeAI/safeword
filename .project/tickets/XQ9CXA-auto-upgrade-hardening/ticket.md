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

**Goal:** Make safeword's existing client-pull auto-upgrade land sooner, fail loudly when it can't apply, and verify the package it installs — without changing the core architecture.

**Why:** The current two-hook mechanism is sound but has three edge weaknesses: every upgrade is structurally one session late, persistent apply failures are swallowed silently (customers can rot on an old version forever), and the apply step trusts npm by version-pin + age alone despite us publishing provenance.

## Decision context (from /figure-it-out)

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

## Scope (ordered by leverage)

### 1. Collapse the one-session lag (DX + elegance) — DO FIRST

- Today `session-update-check.ts` (async) writes `.update-cache.json` _this_ session; `session-auto-upgrade.ts`
  (sync) only applies it _next_ session. Every upgrade is one session late, plus the <=24h check cadence.
- Merge into a single async check-and-apply hook: removes the lag, moves the `bunx safeword@X upgrade`
  network call off the blocking session-start path, and deletes the cache-file-as-IPC handoff.
- Preserve all existing guards (dogfood, dirty tree, CI, opt-outs, 24h release-age cooldown) and the
  `bumpType`/`upgradeDecision` policy (patch/minor apply, major notify).

### 2. Surface persistent apply failures (resilience)

- Current `catch` logs "will retry next session" and moves on — a silent infinite no-op when the commit
  keeps failing (commit signing required, `pre-commit` rejects the bot commit, protected branch,
  detached HEAD / mid-merge / mid-rebase).
- Add a strike counter to the update cache; after N consecutive failures switch from silent to a visible
  one-line "auto-upgrade blocked, run `safeword upgrade`" and stop retrying quietly.
- Widen pre-flight beyond dirty-tree to also skip on detached HEAD / in-progress merge or rebase.

### 3. Verify provenance, not just age (resilience frontier)

- We publish with `--provenance` via OIDC, but apply trusts npm by version pin + 24h cooldown only.
- Verify the provenance attestation (built from `arcadeai/safeword` on the release workflow) before
  applying. Cooldown defends the yank window; provenance defends registry compromise.

### Follow-on (smaller, separable)

- `config.autoUpgrade: "stage" | "commit"` opt-in mode for teams that forbid bot commits.
- Bootstrap plugin: commit-SHA versioning so the "run setup" entry point self-freshens via CC native update.

## Acceptance criteria

- [ ] Single async hook performs check + apply; no structural one-session lag; template tests updated and green.
- [ ] All existing guards + the `upgradeDecision` policy preserved (pinned by unit tests).
- [ ] Repeated apply failures become visible after N strikes and stop silently retrying; pre-flight covers detached HEAD / merge / rebase.
- [ ] Provenance verified before apply (or an explicit, tested decision to defer with rationale).
- [ ] Validated via template/unit tests — NOT by live-upgrading the dogfood repo (pinned v0.49.0 vs source v0.52.1).

## Premortem

Most likely failure 6 months out: #2 done badly — the self-commit silently fails on a common enterprise
setup (commit signing or a `pre-commit` gate) and, because failure is swallowed, a cohort silently rots on
an old version while telemetry shows "auto-upgrade enabled." Mitigation: make failure loud after N strikes,
not just logged.

## Work Log

- 2026-06-20T05:50:13.291Z Started: Created ticket XQ9CXA
- 2026-06-20T05:50:00Z Plan captured from /figure-it-out: architecture confirmed (in-repo reconcile + self-commit), three ordered hardening items, native-plugin and stage-only options ruled out with rationale.
- 2026-06-20T05:49:00Z Installed deps: `bun ci` succeeded (2510 packages, build OK, exit 0).
