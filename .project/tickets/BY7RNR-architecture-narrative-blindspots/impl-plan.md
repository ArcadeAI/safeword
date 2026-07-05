# Impl Plan: Architecture narrative reconciliation — paths.architecture + pre-existing drift (BY7RNR)

**Status:** implemented

## Approach

**Riskiest assumption:** the deterministic "mentioned" rule (word-boundary,
full-name-or-scoped-tail, case-insensitive) is generous enough not to nag a
reconciled narrative — proven cheapest by the two TB2.AC2 scenarios "A scoped
package mentioned by its short name counts as mentioned" and "A narrative
mentioning every package stays silent" (unit-level first, then cucumber).
If those partitions can't be made to pass with a simple matcher, the advisory
design is wrong, and that fails on slice 1.

**Build order and proof per slice:**

1. **CLI narrative drift module** (`packages/cli/src/utils/architecture-narrative-drift.ts`):
   pure functions — extract `### <name>` headings under `## Packages` from a
   generated root index; the "mentioned" matcher; advisory formatter (cap 6 +
   "and N more"). Primary proof: **unit** (`packages/cli/tests/utils/…`) —
   pure string→string logic, highest practical scope is unit. Covers the
   word-boundary (`cli` ≠ `click`), case, scoped-tail, and cap partitions.
2. **CLI narrative resolver** (`resolveArchitectureNarrativePath` in
   `configured-paths.ts`: configured `paths.architecture` → root
   `ARCHITECTURE.md` fallback; content reader concatenating
   `listArchitectureRecords` when the target is a directory). Primary proof:
   **unit** with temp dirs (existing `configured-paths` test patterns).
3. **Wire into `safeword architecture`** (`commands/architecture.ts`, a
   `warnNarrativeDrift` beside `warnUnreadableWorkspaces`, all modes, exit
   codes untouched). Primary proof: **acceptance** — cucumber steps in
   `steps/architecture-narrative-drift… (new steps file)` driving the real CLI
   in temp monorepos (TB2 scenarios), the wiring test per entry point.
4. **Hook-side narrative resolution** (`templates/hooks/lib/architecture-document-nudge.ts`:
   read `paths.architecture` from `.safeword/config.json` standalone, fall back
   to root `ARCHITECTURE.md`; accept file or directory; advisory text names the
   resolved narrative). Primary proof: **git-backed integration** (extend
   `tests/hooks/architecture-document-nudge.test.ts` — TB1 scenarios' vitest
   backing). Supporting proof: extend the **differential parity test**
   (`architecture-document-nudge-parity.test.ts`) pinning hook resolver ===
   CLI resolver across config fixtures (P58R22).
5. **Prose surfaces** (`templates/prompts/architecture.md`, audit skill
   structural-drift section): resolve narrative via `paths.architecture`.
   Primary proof: **unit content assertion** (TB1.AC4 scenarios). Then
   `bun run parity:fix` to sync dogfood mirrors, and the schema pair check
   proves parity.
6. **Ledger/cucumber green pass**: run `bun run test:bdd` for TB2, targeted
   vitest for TB1, tick R/G/R per scenario.

Slice 1 is dependency-free and load-bearing → first. Slices 2–3 build on 1;
slice 4 needs 2 (parity target); slice 5 is independent prose, last.

## Decisions

| Decision             | Choice                                                       | Alternatives considered                        | Rejected because                                                                              |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Narrative resolution | configured `paths.architecture` → root `ARCHITECTURE.md`     | full `resolveConfiguredPath` semantics         | unset default (`<namespace>/architecture.md`) silently kills the nudge for existing hosts      |
| Advisory surface     | stateless every-run in `safeword architecture` (all modes)   | one-time at setup; `safeword check` advisory   | setup doesn't generate docs + no once-state exists + incident config arrived post-setup; check isn't guaranteed to run in front of agent sessions |
| Drift detector       | doc-to-doc mention check (generated `## Packages` vs narrative text) | agent-only reconciliation (`/audit`) status quo | never runs unprompted — #848 incident proof; recorded AXRC4D deviation in ticket Decisions     |
| Mention matcher      | word-boundary regex, case-insensitive, full name or scoped tail | exact substring; heading-only match            | substring over-nags (`cli` in `click`); heading-only misses prose mentions and over-nags       |
| Hook config read     | standalone mini-reader in the nudge lib                       | import CLI resolver                            | hooks run standalone under bun in host repos — no import path to the CLI (TAGWZ8)              |
| Matcher boundaries   | trailing `./-` block only when continuing a name (`(?!\w\|[.-]\w)`) | symmetric name-char class on both sides    | sentence-final periods defeated the symmetric class ("…and billing." read as missing) — quality-review pass 1 critical finding, fixed a3b5b0f |
| Advisory timing      | default/`--stage` warn after the heal; `--check` reads disk as-is | warn before healing in every mode           | pre-heal the doc may not exist yet — the stage-mode cucumber scenario caught it                |

## Arch alignment

- **Continuous Quality Gates (LOC + Phase + TDD)** — the nudge stays a Stop-hook advisory inside the existing done-gate flow; no new gate class.
- **Reconciliation Engine / Schema (`src/schema.ts`)** — prompt/skill prose changes ride the existing ownedFiles parity pairs; no new distribution mechanism.
- **Test Structure** — unit next to utils, hook integration under `tests/hooks/`, acceptance in the cucumber lane, matching the documented layout.
- **Architecture Review Gate** — design recorded here + ticket Decisions before implementation, per the gate's evidence requirement.

## Known deviations

- Deviates from AXRC4D's "no deterministic drift module" ruling — narrowly: the new check is deterministic-by-reading (two docs), not source-analyzing; defect fixed: `/audit` reconciliation never runs unprompted (#848). Recorded in ticket Decisions with pre-mortem and mitigations.
- Steps file is `steps/architecture-narrative-blindspots.steps.ts` (ticket-slug naming), not the plan's provisional `architecture-narrative-drift` name.
- Empty configured ADR directory diverges by surface: the nudge counts it as a narrative (`existsSync`), the drift advisory as none (zero records). Deliberate — documented at the hook call site.

## Assessment triggers

- Hosts report advisory fatigue (packages named by prose description) → revisit the matcher's generosity or add an opt-out key.
- A second consumer needs the generated-doc package list → promote the extractor from the drift module into `architecture-document.ts`'s public surface.
- `## Modules` (single-repo) drift demand appears → revisit the Packages-only scope guard.
- Issues #843/#844 land (generator lists more packages) → re-check advisory noise in polyglot hosts.
