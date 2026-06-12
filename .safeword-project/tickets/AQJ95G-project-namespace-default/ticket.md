---
id: AQJ95G
slug: project-namespace-default
type: feature
phase: intake
status: in_progress
created: 2026-06-12T04:08:06.464Z
last_modified: 2026-06-12T04:08:06.464Z
---

# Epic: default namespace .safeword-project/ → .project/ (configurable root, legacy detection)

**Goal:** Make `.project/` the default safeword namespace root (replacing `.safeword-project/`), with a configurable root override and automatic legacy detection — converging safeword and arcade on one convention instead of bridging two.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Decisions (locked at intake, driver-confirmed 2026-06-12)

1. **Name: `.project/` (singular)** — byte-for-byte match with arcade's existing convention; safeword reads arcade's real personas/glossary/specs with zero config. Driver confirmed.
2. **Configurable root** — users can point the namespace elsewhere. Extend the K7N2QM `paths.*` machinery with a root-level key (e.g. `paths.projectRoot`); per-file `paths.personas`/`paths.glossary`/`paths.architecture` overrides keep working and resolve against the root. Driver-required.
3. **Back-compat: detect, don't force** — resolution precedence per project: explicit config → `.project/` → legacy `.safeword-project/`. Existing installs untouched; fresh `safeword setup` scaffolds `.project/`; optional `safeword migrate-namespace` command (git-aware move + config check) for converging old installs.
4. **Supersedes P8RJ4M** — the cross-tool coexistence bridge is cancelled-by-convergence once this ships; arcade's temporary `paths.*` overrides (decommission checklist) become removable.

## Scope notes (for intake refinement)

- Pervasive-token sweep: `.safeword-project` appears across packages/cli src (TICKETS_SUBPATH, schema, setup, check, ticket-sync), templates/hooks (quality-state, active-ticket, stop-quality, write-review-stamp, jtbd), skills docs (bdd/\*, SAFEWORD.md), website docs + glossary, and tests — apply the exhaustive-grep discipline (all surfaces, fresh build, subprocess tests can lie on stale dist).
- The resolution precedence must be computed once and shared (single resolver), not re-derived per call site — that's the design center of the epic.
- Both-dirs-present is the ambiguous cell: define it (config wins; otherwise warn via `safeword check` advisory and prefer `.project/`? settle at /figure-it-out).
- Sequencing: ships as 0.45.0; 0.44.0 (M6D315 capabilities) releases first so the arcade decommission isn't blocked on this epic.

## Work Log

- 2026-06-12T04:08:06.464Z Started: Created ticket AQJ95G
- 2026-06-12T04:09:00.000Z Drafted: epic shell with 4 locked decisions (driver-confirmed: .project/ singular + configurable root), scope notes, sequencing after 0.44.0. Supersedes P8RJ4M.

## Work Log

- 2026-06-12T04:08:06.464Z Started: Created ticket AQJ95G
