---
id: AQJ95G
slug: project-namespace-default
type: feature
phase: define-behavior
status: in_progress
created: 2026-06-12T04:08:06.464Z
last_modified: 2026-06-12T17:19:00.000Z
scope:
  - 'Single namespace-root resolver (extends K7N2QM configured-paths.ts): precedence explicit config (paths.projectRoot) → .project/ → legacy .safeword-project/, computed once and shared. Default subpaths for personas/glossary/architecture/tickets/learnings derive from the resolved root.'
  - 'Migrate ~48 hard-coded .safeword-project src literals + templates/hooks + skills docs + website docs/glossary to consume the resolver. Exhaustive grep across all surfaces, fresh build (subprocess tests can pass on stale dist).'
  - 'Fresh safeword setup scaffolds .project/.'
  - 'Migration folded into safeword upgrade (no standalone command): interactive upgrade on a legacy install prompts to move, defaulting to yes (recommended); git-aware move preserving history; config reconciliation. Scripted runs gate on --migrate-namespace / --no-migrate-namespace. Non-interactive auto-upgrade hook only nudges, never moves.'
  - 'safeword check advisory when both .project/ and .safeword-project/ exist (transient mid-migration state).'
  - 'Per-file paths.personas / paths.glossary / paths.architecture overrides keep working and resolve against the root.'
out_of_scope:
  - 'Permanent both-dirs coexistence as a steady state — migration is the convergence path, both-dirs is transient.'
  - 'Silent or forced migration — the move always requires consent; declining keeps .safeword-project/ working.'
  - 'Standalone migrate-namespace command — superseded by upgrade as the vehicle.'
  - 'Arcade-side changes — arcade already uses .project/; this convergence is one-directional.'
  - 'New per-file paths.* keys — only the root-level paths.projectRoot is added; personas/glossary/architecture keys already exist (K7N2QM).'
done_when:
  - 'A fresh install scaffolds and resolves .project/ (personas, glossary, architecture, tickets, learnings all under it).'
  - 'A legacy-only install that declines the upgrade prompt resolves .safeword-project/ unchanged.'
  - 'A configured paths.projectRoot redirects all namespace reads/writes; per-file paths.* still resolve against it; a paths.architecture override wins over the root default.'
  - 'Interactive upgrade on a legacy install offers the move defaulting to yes; accepting moves the dir preserving git history, after which resolution points at .project/ and the old path is dropped; declining is honored.'
  - 'The non-interactive auto-upgrade hook never moves the dir; it nudges only.'
  - 'safeword check flags the both-dirs state with an advisory.'
  - 'No .safeword-project literal survives outside the resolver + legacy-detection path (exhaustive grep, fresh build).'
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
- 2026-06-12T17:19:00.000Z Complete: intake — 5 JTBDs (4 DEV + SM1 single-resolver), ACs incl. architecture under resolved root (DEV1.AC3), both open questions resolved (both-dirs transient; migration folded into `upgrade` default-recommended, never silent/forced). Scope/out_of_scope/done_when written to frontmatter. Phase → define-behavior.
