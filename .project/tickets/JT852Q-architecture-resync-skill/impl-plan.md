# Impl Plan: Architecture-doc prose persistence (JT852Q, layer A)

**Status:** planned

## Approach

One parse function + one threaded parameter, mirroring the existing
`parseSectionStamps`/`priorStamps` pattern — the prose machinery is the stamp
machinery's twin.

Build order (each builds on the previous green):

1. **`parseSectionProse(content): Map<name, string>`** — for each `### name`
   section, capture the prose block: the lines after the `` `path` `` code-reference
   line, excluding the `<!-- reconciled -->` marker and any `> ⚠ stale`/
   `> ⚠ orphaned` blockquote markers; trim; drop empty → absent from the map (so
   empty prose falls back to the placeholder, honoring the purpose floor).
   CRLF-tolerant (`split(/\r?\n/)`). _Unit_ (`architecture-document.test.ts`).
   Proves the parse half of the inverse in isolation, incl. CRLF + empty.
2. **Section format + `renderSection(node, stamp, status, prose)`** — emit the
   prose as its own block after the `` `path` `` line; the heading, marker, path
   line, and stale marker stay machine-owned. _Unit_. The render half of the inverse.
3. **Thread `priorProse` through `renderDocument`** — parse prior prose from the
   existing doc, pass it down; `renderSection` uses `priorProse.get(name) ??
PURPOSE_PLACEHOLDER`. New node → placeholder; existing → prose verbatim. _Unit_.
4. **Round-trip property** — `render(parse(render(x))) == render(x)`; and a
   `healed` write preserves an unaffected section byte-identical; heal-twice on an
   unchanged doc = `unchanged`. _Unit_ + the premortem property test (first RED).
5. **Wire into `selfHeal`/`healTarget`** — the single-repo + leaf targets read
   prior prose; root index untouched (no per-node prose). _Integration_.
6. **Migrate existing assertions + re-render dogfood docs** — update Slice-1/2/3
   tests that pin the old inline `` `path` — purpose `` substring; re-run
   `safeword architecture` on this repo and commit the re-rendered docs. _Integration_.
7. **Black-box BDD steps** — `steps/architecture-prose-persistence.steps.ts`:
   generate a doc, hand-edit a section's prose block, heal, assert the rendered
   prose. The two-paragraph step binds a real multi-line value (review nit);
   add a whitespace-only boundary check (review nit). _E2E_.

Test-layer rationale: parse/render are pure → unit (fast, the inverse is a
property). The heal wiring + format migration are integration (cross-file output).
The `.feature` lane is the end-to-end acceptance proof over the real CLI.

## Decisions

| Decision              | Choice                                                                          | Alternatives considered          | Rejected because                                                                 |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Prose region          | Section body after the `` `path` `` line, excluding marker lines                | One-line `` `path` — purpose ``  | Fragile `—` delimiter, one-line cap, forces a second migration for the LLM skill |
| Empty prose           | Absent from the prose map → placeholder fallback                                | Render an empty section          | Violates the purpose floor (`purposeFloorViolations` wants non-empty); churns    |
| Persistence mechanism | `parseSectionProse` + `priorProse`, twin of `parseSectionStamps`/`priorStamps`  | Sidecar prose file keyed by node | Second artifact per doc + per leaf; breaks self-describing + colocated model     |
| Legacy migration      | None — old docs only ever held the placeholder, so it's placeholder→placeholder | Parse the old inline format      | No real prose exists to migrate; a dedicated scenario would be vacuous           |

## Arch alignment

Honors `ARCHITECTURE.md` (the `paths.architecture` record):

- **Deterministic, LLM-free engine** (Slice 1 spirit, `Reconciliation Engine`) —
  prose persistence is pure parse/render; no new source of truth, no LLM.
- **`Hard Block … Exit Code 2` / enforcement via exit codes** — the round-trip
  fixed point is what keeps `architecture --check` from churning; this change must
  not move the fingerprint or the enforcement contract.

## Known deviations

- The single-repo doc's **byte output changes** (prose moves to its own block).
  This re-renders every existing generated doc once (a one-time `healed`). Bounded:
  the docs are machine-owned (`generator:` marker), so re-rendering is expected;
  the fingerprint is unaffected (prose isn't a fingerprint input).

## Assessment triggers

- The **LLM resync skill (RYKVR5)** lands — it writes into the prose region this
  ticket defines; if it needs structured prose (sub-headings, code refs), revisit
  the prose-region grammar.
- A future input makes **prose a fingerprint contributor** — would break the
  "prose isn't structural" invariant this relies on.
