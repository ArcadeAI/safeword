---
id: 263422
slug: audit-deps-vs-dependabot
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:26:16.820Z
last_modified: 2026-06-06T18:26:16.820Z
---

# Pull dependency-freshness checks out of audit, delegate to Dependabot — or not

**Goal:** Decide whether `audit`'s dependency-freshness section (the `bun/npm/pip/go outdated` triage at [audit/SKILL.md:87–134](../../../.claude/skills/audit/SKILL.md)) should be removed and the job delegated to Dependabot — which is already configured — or kept, slimmed, or made conditional.

**Why:** Dependabot already opens weekly grouped PRs for this repo's JS / Actions / pip deps, so `audit` re-running `bun outdated` and asking a human to re-triage the same drift is largely duplicate work — and it bloats a code-health audit (whose job is architecture, dead code, test quality) with dependency noise the bot already turns into actionable PRs. But `audit` ships to customer repos that may have **no** Dependabot, so deleting it outright risks silently dropping freshness coverage where nothing replaces it. That tension is the decision.

> Status: **intake**. Records the decision and the options; **does not resolve it**. Resolving it is a real `/figure-it-out` call (cost of being wrong = removing a check from a shipped skill) — cf. [ZBVGPF](../ZBVGPF-embed-figure-it-out/ticket.md). Likely resolves down to a **task** once the call is made (one-to-three skill edits).

> **Sequencing (audit is a shared pivot).** `audit`'s target shape is decided by three tickets at once — trim-vs-Dependabot (here), audit-as-workflow ([9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md)), and the `code-review` overlap ([C2F601](../C2F601-absorb-claude-skills/ticket.md)). Settle the shape **jointly before executing this trim** — trimming the outdated section and then re-architecting audit into a fan-out workflow would be rework.

## Current state (verified this session)

- **Dependabot is configured** — `.github/dependabot.yml`: github-actions (weekly, grouped), bun (weekly, minor+patch grouped — majors get individual PRs), pip in `/.github`. Go and other ecosystems not covered.
- **audit** — [SKILL.md:87–134](../../../.claude/skills/audit/SKILL.md) is the only place running real freshness commands (`bun outdated` / `npm outdated` / `pip list --outdated` / `go list -m -u`) plus a dev/prod × patch/minor/major risk-triage matrix. **The removal candidate.**
- **quality-review** — [SKILL.md:33–45](../../../.claude/skills/quality-review/SKILL.md): overlapping-but-different web-research check ("search latest stable version", flag major/minor behind, security vulns). The decision must say whether this stays — it's the other freshness surface.
- **verify** — documentation drift only (package.json vs ARCHITECTURE.md), **not** freshness. Out of scope.

## Options (for the figure-it-out pass — not decided)

- **A — Remove from audit, delegate fully to Dependabot.** Cleanest audit. Assumes the repo has a bot; un-botted customer repos lose freshness coverage entirely.
- **B — Conditional.** audit detects `.github/dependabot.yml` / renovate and skips the outdated section when present, runs it when absent. Kills the duplication for botted repos, keeps coverage for the rest.
- **C — Slim, don't remove.** audit drops routine minor/patch (the bot's job) and flags only what a bot surfaces poorly in review — security advisories and major-version drift.
- **D — Keep as-is.** Accept the duplication; audit stays a bot-independent one-shot snapshot.
- Seed for the discussion: lean **B or C** — both end the duplication for botted repos without abandoning un-botted ones. But it's the figure-it-out call, not decided here.

## Open questions (converge before spec)

- **Does "delegate" assume safeword ships/encourages a Dependabot (or renovate) config?** If customers won't have one, B (conditional) is the floor, not A.
- **Does `quality-review`'s web-research version check stay, move, or slim too?** It partly overlaps audit; the decision should cover both or explicitly scope it out.
- **Who owns security advisories?** Dependabot _security_ alerts are a separate feature from version bumps — decide whether CVE-surfacing lives with Dependabot alerts, audit, or quality-review.
- **Template sync.** `.claude/skills/audit/SKILL.md` is the dogfood copy; whatever changes must sync to the shipped template per the template-is-canonical rule.

## Related but separate — stale-package-from-memory (per user: "resolve differently")

Agents adding a **new** dependency tend to pin a version from training memory, which can be badly stale. Today's instructions (SAFEWORD.md "Authority: docs and research"; [bdd/DISCOVERY.md:100](../../../.claude/skills/bdd/DISCOVERY.md); [debug/SKILL.md:48](../../../.claude/skills/debug/SKILL.md)) only cover reading the **installed** version's docs — none cover **picking a current version when introducing a new package**. That's an _add-time_ problem, not _drift-over-time_, so audit-vs-Dependabot doesn't solve it (Dependabot would only bump it reactively next week — a freshly-added dep instantly spawning a bot PR is a smell). Likely its own small patch: a one-line extension to SAFEWORD.md "Authority" ("when adding a new dependency, check its current published version before pinning"). **Not folded into this decision** — flagged for a separate ticket.

## Work Log

- 2026-06-06T18:26:16.820Z Started: Created ticket 263422
- 2026-06-06T18:27:00Z Framed: mapped the freshness surfaces before writing scope. Dependabot already configured (`.github/dependabot.yml` — actions/bun-minor-patch/pip). audit (SKILL.md:87–134) is the only real `outdated`-command runner + triage matrix → removal candidate. quality-review (SKILL.md:33–45) is a separate web-research version check that overlaps. verify is doc-drift only, not freshness → out of scope. Recorded four options (remove / conditional / slim / keep), leaning B or C, but explicitly left for a /figure-it-out pass at resolution (dogfoods ZBVGPF). Noted the user's stale-package-from-memory concern as related-but-separate (add-time vs drift-over-time) → its own patch to SAFEWORD.md "Authority", not folded in.
