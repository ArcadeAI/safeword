---
id: BY7RNR
slug: architecture-narrative-blindspots
type: feature
phase: implement
status: in_progress
scope:
  - hook-side narrative resolution in architecture-document-nudge.ts — configured paths.architecture (file or ADR directory) with root ARCHITECTURE.md fallback; nudge message names the resolved narrative
  - CLI counterpart resolver (resolveArchitectureNarrativePath in configured-paths.ts) pinned to the hook copy by a differential parity test (P58R22 pattern)
  - narrative-drift advisory in `safeword architecture` (default/--check/--stage, beside warnUnreadableWorkspaces) listing generated `## Packages` entries absent from the narrative — word-boundary case-insensitive match on full name or scoped tail, capped list, exit codes untouched
  - prose surfaces — templates/prompts/architecture.md and audit SKILL.md structural-drift section resolve the narrative via paths.architecture; dogfood mirrors synced via parity:fix
out_of_scope:
  - one-time/setup-time advisory state (no once-marker mechanism exists; continuous advisory chosen — see spec Design notes)
  - single-repo `## Modules` drift (generic names collide with prose; stays /audit judgment)
  - generator quality (#843, #844) and any generated-doc pipeline change (extraction/fingerprint/self-heal)
  - blocking gates or auto-editing the narrative (AXRC4D rulings stand)
  - changing resolveConfiguredPath's <namespace>/architecture.md default for K4BWTQ record listing
done_when:
  - with paths.architecture configured to a non-root file, a fingerprint-moving ticket emits the done-gate nudge naming that narrative; without config, root ARCHITECTURE.md behavior is byte-identical to today
  - "`safeword architecture` prints a drift advisory naming generated packages absent from the narrative; silent when reconciled or no narrative; exit codes unchanged in all modes"
  - architecture prompt + audit skill reference the configured narrative; hook/CLI resolver parity test and templates↔dogfood parity check pass
created: 2026-07-05T19:25:59.867Z
last_modified: 2026-07-05T19:25:59.867Z
---

# Architecture narrative reconciliation: honor paths.architecture + surface pre-existing drift

**Goal:** Done-gate nudge and architecture prompts resolve the narrative via paths.architecture (root ARCHITECTURE.md fallback); safeword architecture emits a non-blocking advisory listing generated packages absent from the narrative

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Decisions (figure-it-out, 2026-07-05)

- **Narrative resolution:** configured `paths.architecture` first, root
  `ARCHITECTURE.md` fallback, in both the done-gate nudge hook and the CLI.
  Full `resolveConfiguredPath` semantics rejected: its unset default
  (`<namespace>/architecture.md`) would silently kill the nudge for every existing
  root-`ARCHITECTURE.md` host — the same silent-no-op bug class inverted.
  `resolveConfiguredPath`'s default stays untouched for K4BWTQ record listing.
- **Advisory surface:** stateless, every-run, in `safeword architecture` (all
  modes), beside `warnUnreadableWorkspaces` — the session-start heal hook shells
  out to this command, so the advisory reaches every agent session and self-clears
  on reconcile. Setup-time one-time advisory rejected: setup doesn't generate
  docs, no once-only state mechanism exists, and the incident host configured
  `paths.architecture` *after* setup — a setup-only check would have missed the
  incident anyway. Continuous drift surfacing is the industry norm (HashiCorp
  well-architected guidance).
- **Deviation from AXRC4D's "no deterministic drift module" ruling** (recorded per
  architecture-guide): that ruling rejected a *source-analyzing* detector and
  blessed "deterministic-by-reading". The new check reads two documents (generated
  `### <name>` headings under `## Packages` vs narrative text) and computes
  nothing from source. Named defect the deviation fixes: agent-judgment-only
  reconciliation (`/audit`) never runs unprompted — #848 is the proof. Pre-mortem:
  a crude mention check nags hosts whose narratives name packages by prose
  description; mitigated by the generous "mentioned" rule (spec Vocabulary), a
  capped list, and `/audit` staying the authoritative pass. Call-site count: one
  (the architecture command); no uplevel ticket needed.
- **Scope guard:** monorepo `## Packages` only. Single-repo `## Modules` names
  (`utils`, `commands`, …) are prose-collision-prone; they stay `/audit`'s
  judgment call.

## Work Log

- 2026-07-05T19:25:59.867Z Started: Created ticket BY7RNR
- 2026-07-05T19:33:00Z Intake: personas/glossary/surfaces loaded; Intake Brief + JTBD (TB1, TB2) + ACs authored in spec.md. Sub-phase gates auto-confirmed (autonomous session, user not live); design settled by figure-it-out — configured-paths-first narrative resolution, stateless every-run advisory in `safeword architecture`. Deviation from AXRC4D "no deterministic drift module" recorded in Decisions.
- 2026-07-05T19:37:00Z Complete: intake - Understanding converged, scope established. Spec self-reviewed (Design notes moved out of spec into ticket Decisions; "mentioned" rule promoted to spec Vocabulary), re-stamped. Reversibility recorded two-way-door → no cold-start check. Phase → define-behavior.
- 2026-07-05T19:45:00Z Complete: define-behavior - 20 scenarios defined across 7 rules (dimensions.md table → partitions). TB1 rules @wip (vitest hook lane backing, bash-ledger-write-gate precedent); TB2 rules cucumber-backed. Saturation: second pass over dimensions surfaced no new partitions. Phase → scenario-gate.
- 2026-07-05T19:41:00Z Complete: scenario-gate - Independent fork review (review-spec procedure): first pass BLOCK (ADR-directory drift uncovered + 5 strengtheners), all applied (+5 scenarios → 22 total), re-review PASS, stamped. impl-plan.md written (proof plan + build order in Approach). Phase → implement.
