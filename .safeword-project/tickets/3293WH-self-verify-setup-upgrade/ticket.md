---
id: 3293WH
slug: self-verify-setup-upgrade
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:40:39.708Z
last_modified: 2026-06-06T18:40:39.708Z
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
- 2026-06-06T18:41:00Z Framed: verified setup/upgrade don't self-verify; `checkHealth`/`reportHealthSummary` are private in check.ts (need extraction); check's npm update-check must stay OUT of the self-verify (network + post-upgrade nag). Grepped ~20 `safeword check` references incl. advisory strings in scenario-coverage/glossary/personas that tell users to run it → real doc ripple if demoted. Proposed: extract `verifyHealth(cwd)→issues[]`, call from setup+upgrade, report+non-zero on issues. Core wiring task-sized; feature surface = the demote-public-command decision + doc sweep. Depends on 469YSR for clean output. Left fate-of-`check`, failure semantics, and advisory rewording open.
