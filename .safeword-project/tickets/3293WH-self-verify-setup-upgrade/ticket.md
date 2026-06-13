---
id: 3293WH
slug: self-verify-setup-upgrade
parent: VKNF1T-platform-uplift-epic
type: feature
phase: implement
status: in_progress
created: 2026-06-06T18:40:39.708Z
last_modified: 2026-06-13T01:20:00.000Z
scope:
  - extract the config-health core (checkHealth, reportHealthSummary, HealthStatus, find* helpers) from check.ts into a shared module, behavior-neutral
  - call the health verification at the tail of setup and upgrade (after all mutations incl. maybeAutoPatchOrNudge); report issues and exit non-zero
  - parameterize the remediation hint so a post-upgrade failure doesn't say "run safeword upgrade"
  - reword imperative doc surfaces (SAFEWORD.md template+dogfood, website cli.mdx) to present check as automatic + standalone for CI/debugging
out_of_scope:
  - auto-repair loop on post-verify failure (rejected — reconcile already ran; repair masks bugs)
  - removing or hiding the check command (rejected — doctor idiom, CI/debug value)
  - npm update-check inside the self-verify (rejected — network call + wrong "update available" nag post-upgrade)
  - rewording descriptive/advisory "safeword check" references (still point at a valid diagnostic)
  - hook changes (CLI-side only)
done_when:
  - setup that ends with config-health issues reports them and exits non-zero; same for upgrade
  - clean setup/upgrade prints a single health success line and performs no update-check network call
  - post-upgrade failure output does not instruct "run safeword upgrade"
  - standalone safeword check behavior unchanged (existing check tests pass unmodified)
  - SAFEWORD.md pair + website cli.mdx present check as automatic-first
---

# Auto-run health verification after setup & upgrade; stop treating check as a human command

**Goal:** Run safeword's config-health verification automatically at the end of `setup` and `upgrade` (fail loudly if the command left the project broken), and stop presenting `check` as a command humans are expected to run.

**Why:** `setup` and `upgrade` mutate project config and can leave it half-applied — missing files, missing packs, broken patches. Today the only way to catch that is for the user to _know_ to run `safeword check`, which they won't. A mutating command should prove its own postcondition at the moment it runs, where the breakage actually is.

> Status: **intake**. Core wiring is task-sized (call an existing routine from two sites); the feature surface is the **demote-the-public-command decision** plus its doc ripple.

## Current state (verified this session)

- `setup` / `upgrade` do **not** self-verify — no health call in either.
- The health logic — `checkHealth()` (reconcile dryRun → missing files / packs / patches / persona+glossary issues) and `reportHealthSummary()` — is **private** inside [check.ts](../../../packages/cli/src/commands/check.ts); only the `check` command is exported. Reuse requires extracting the health core into a shared, exported module.
- `check` also runs an **npm update-check** (network) — orthogonal to "did this command break the config," and an "update available" nag right after `upgrade` would be wrong. The self-verify must be config-health only.
- `safeword check` is referenced across ~20 surfaces — SAFEWORD.md (template + `.safeword`), bdd DISCOVERY/SCENARIOS, glossary + doc templates, and advisory messages in `scenario-coverage.ts` / `glossary.ts` / `personas.ts` that literally tell users to "run `safeword check`." Demoting it ripples (cf. the exhaustive-grep-on-token-removal learning — sweep all surfaces incl. website docs).

## Proposed shape

Extract `verifyHealth(cwd) → issues[]` (config-health only, no update-check) from check.ts into a shared module; call it at the end of `setup` and `upgrade`; on issues, report and exit non-zero. The update-check stays only on the explicit/standalone path.

## Open questions (converge before spec)

- **Fate of standalone `check`.** Remove / hide (internal, undocumented) / keep public but de-emphasized? Lean: keep callable (CI + debugging value), extract the core so setup/upgrade don't depend on the _command_, and reword docs/advisories so humans aren't routinely told to run it. Full removal is more doc-ripple than it's worth.
- **Failure semantics.** On post-verify issues after `upgrade`: report + non-zero exit with no rollback, or attempt repair? Lean: report-and-fail — surfacing beats silent half-success; user/CI decides.
- **Where advisories point.** The "run `safeword check`" lines in coverage/glossary/persona advisories — if check is demoted, reword to what? (Possibly nothing — those advisories already print during the auto-run.)
- **Idempotence / noise.** `upgrade` after `setup` would self-verify twice in a fresh-install flow; confirm the post-step is quiet on a clean result (no double walls of output).

## Related

- [469YSR-styled-output-leading-newline](../469YSR-styled-output-leading-newline/ticket.md) — the self-verify surfaces check's output _inside_ setup/upgrade, so the orphaned-glyph fix should land first (or together) for clean output.
- [C2F601-absorb-claude-skills](../C2F601-absorb-claude-skills/ticket.md) — Claude Code's `verify` / `run` ("actually exercise it") overlaps the self-verify idea; worth comparing.

## Work Log

- 2026-06-06T18:40:39.708Z Started: Created ticket 3293WH
- 2026-06-13T01:22:00Z Complete: intake - figure-it-out pass settled all four open questions (keep check public/de-emphasized per doctor idiom + CI value; report+exit-1 no repair — reconcile already ran; reword imperative doc surfaces only; reuse reportHealthSummary, brief-on-success). spec.md authored (2 JTBDs, 7 ACs), self-review stamped. Sub-phase gates auto-confirmed (autonomous run; scope pre-accepted in user carry-over prompt).
- 2026-06-13T01:24:00Z Complete: define-behavior - 10 scenarios defined across 6 rules (dimensions.md saved; issues-found partition proven at the health-module seam since a real fresh fixture can't produce it)
- 2026-06-13T01:35:00Z Gate review (Tier 2, fresh subagent): BLOCK on vacuous AC3 pair + 4 should-strengthen. All applied: AC3 anchored to self-verify presence + unit seam scenario; AC5 widened to all three failure branches (Scenario Outline); AC4 setup mirror + advisories-once scenario added; DEV2.AC1 made greppable. Decision on the adversarial note: a health verification that throws mid-tail is caught by the commands' existing try/catch → "Setup/Upgrade failed" + exit 1 — acceptable, no extra scenario.
- 2026-06-13T01:45:00Z Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass: round 1 BLOCK (vacuous AC3) fixed, round 2 PASS; residual literal-pinning applied. impl-plan.md written (test layers + build order in Approach). Stamped.
- 2026-06-06T18:41:00Z Framed: verified setup/upgrade don't self-verify; `checkHealth`/`reportHealthSummary` are private in check.ts (need extraction); check's npm update-check must stay OUT of the self-verify (network + post-upgrade nag). Grepped ~20 `safeword check` references incl. advisory strings in scenario-coverage/glossary/personas that tell users to run it → real doc ripple if demoted. Proposed: extract `verifyHealth(cwd)→issues[]`, call from setup+upgrade, report+non-zero on issues. Core wiring task-sized; feature surface = the demote-public-command decision + doc sweep. Depends on 469YSR for clean output. Left fate-of-`check`, failure semantics, and advisory rewording open.
