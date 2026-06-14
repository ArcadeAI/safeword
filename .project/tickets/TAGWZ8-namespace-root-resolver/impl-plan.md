# Impl Plan: Single namespace-root resolver with legacy detection + literal migration

**Status:** implemented

## Approach

Build order, each step green before the next:

1. **Resolver core** (`packages/cli/src/utils/configured-paths.ts`) — add `resolveNamespaceRoot(cwd)` implementing the precedence (config `paths.projectRoot` → `.project/` → legacy `.safeword-project/`), plus the `projectRoot` config key with the same defensive semantics as existing keys. **Unit layer** — covers the 5 precedence scenarios, 2 path-type scenarios, and 4 malformed-config scenarios (11 of 17).
2. **Default-subpath derivation** — personas/glossary/architecture defaults become `<resolved-root>/<file>.md`; `resolveConfiguredPath` gains root-awareness so per-file overrides still win. **Unit layer** — covers the 3 derivation scenarios and 2 override-interaction scenarios.
3. **CLI literal migration** — route src call sites (TICKETS_SUBPATH, ticket-sync, learning-sync, check, codify, sync-learnings, sync-tickets, ticket-new, duplicate-ids, ticket-writer) through the resolver. **Integration layer** — the sync-tickets decoy scenario (`surface_follows_resolved_root`) proves the representative surface.
4. **Hook-side resolver** — hooks run standalone in customer repos and can't import CLI src; add the resolver to `templates/hooks/lib/` (and `.safeword/hooks/lib/` in lockstep per template-sync discipline), consumed by quality-state, active-ticket, replan, re-entry, etc. Differential test pins hook copy ↔ CLI copy (P58R22 precedent).
5. **Docs/skills sweep** — skills (bdd/\*, SAFEWORD.md), website docs + glossary: replace `.safeword-project` references with the resolved-root convention. Exhaustive grep across ALL surfaces + fresh build before claiming done (subprocess tests pass on stale dist).

Schema (`SAFEWORD_SCHEMA`) static path entries that affect _runtime reads_ are parameterized by the resolved root; _setup-time scaffolding_ entries stay until child N9S5XG, which owns what a fresh setup creates.

## Decisions

| Decision                          | Choice                                                  | Alternatives considered          | Rejected because                                                                                                                                                                            |
| --------------------------------- | ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolver home                     | Extend `configured-paths.ts`                            | New `namespace-root.ts` module   | Would duplicate the config-read/defensive-parse surface K7N2QM centralized; one file owns "where do paths come from"                                                                        |
| Hook access to resolver           | Duplicate in `templates/hooks/lib/` + differential test | Import from CLI src; bundle step | Hooks are standalone bun scripts in customer repos — no import path exists; bundling is new infra for one function. P58R22 already established the duplicate-with-differential-test pattern |
| Precedence on neither-dir-present | Default to `.project/`                                  | Default to legacy                | Fresh contexts should land on the new convention; legacy exists only where a legacy dir actually exists                                                                                     |
| Schema scaffolding entries        | Defer to N9S5XG                                         | Parameterize everything now      | Setup behavior is explicitly the sibling's scope; touching it here widens the blast radius past the resolver                                                                                |

## Arch alignment

Consulted `ARCHITECTURE.md` (repo root — note: the configured-default location `.safeword-project/architecture.md` does not exist; the record predates the namespace convention, which this very epic regularizes):

- **Schema as single manifest** — runtime path knowledge stays derived from one place; the resolver becomes the path authority the schema consumes, not a parallel manifest.
- **Bundled language packs / no external packages** — resolver ships in core, no new dependency.
- **Differential test pinning hook vs CLI parsers (P58R22)** — extended to the duplicated resolver.

## Known deviations

Recorded at reconciliation (implement-phase exit):

- **Schema entries are additive, not parameterized.** The plan said runtime-read schema entries would be "parameterized by the resolved root"; what shipped lists BOTH roots statically (transient-state globs, managed `.gitignore` block with marker bump, prettier exclusions). Simpler, and correct for both install kinds — parameterizing a static manifest would have fought the schema-as-manifest design.
- **Shell-level surfaces don't honor `paths.projectRoot`.** The verify/audit bash injections (skills + command shims) and the statusline script resolve the root by directory presence only (prefer `.project/`, else legacy) — no config read in shell. A configured-root install would log/read at `.project/` while hooks use the configured root. Acceptable: config override is a niche case; follow-up belongs to the epic if it materializes.
- **Helpers grew beyond the plan:** `defaultConfiguredPath`, `resolveTicketsDirectory`, `resolveLearningsDirectory` (CLI) and `isNamespacePath` (hook side) — extracted so call sites stay one-liners.

## Assessment triggers

- A fourth-plus per-file `paths.*` key, or per-surface roots, would revisit K7N2QM's "no logical-filesystem abstraction at N=3" call.
- If hooks ever gain a build/bundle step, collapse the duplicated hook-side resolver into a single import.
- When sibling 9MMWS7 ships, its both-dirs advisory must consume this resolver — if it can't express what it needs, the resolver API was wrong.
