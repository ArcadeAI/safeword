---
id: JT852Q
slug: architecture-resync-skill
type: feature
phase: implement
status: in_progress
created: 2026-06-23T03:46:29.788Z
last_modified: 2026-06-23T05:14:00.000Z
scope:
  - parseSectionProse(content) → Map<name, prose> (CRLF-tolerant; excludes the reconciled + stale/orphan marker lines), mirroring parseSectionStamps
  - Thread priorProse through renderDocument/renderSection; existing node → prose verbatim, new node → PURPOSE_PLACEHOLDER
  - Evolve the section format so prose is its own block after the machine-owned `path` code-reference line
  - Stamp-drift still emits the ⚠ stale marker with prose preserved; single-repo + monorepo leaves both persist; root index untouched
  - Update Slice-1/2/3 tests asserting the old inline `path` — purpose format; re-render this repo's committed generated docs once
out_of_scope:
  - The /architecture LLM resync skill (layer B) → deferred ticket RYKVR5
  - Any LLM involvement (this ticket stays deterministic)
  - Changing the shape-fingerprint or the --check/--stage enforcement contracts
  - Root-index per-node prose (the derived index has none)
done_when:
  - A doc with written prose heals to `unchanged` with prose byte-identical (round-trip); a new module gets the placeholder; a moved fingerprint preserves prose and flags ⚠ stale
  - Single-repo and monorepo leaf docs both persist prose; the root index is unaffected
  - Full suite green (old-format assertions updated); this repo's generated docs re-rendered + committed; architecture --check passes
  - All scenarios in features/architecture-prose-persistence.feature pass via the BDD lane
---

# `/architecture` prose persistence (JT852Q, scoped) — LLM resync skill deferred

**Goal:** Make per-section prose in the generated architecture docs **survive
deterministic heals** — today `selfHeal` overwrites every section's purpose with
the placeholder, so prose can never persist. This is the deterministic foundation
the LLM resync skill needs; the LLM skill itself is deferred again (see below).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Reframing (intake, 2026-06-23)

JT852Q was written as "a `/architecture` LLM-prose skill," but framing found the
load-bearing blocker: `renderDocument` always renders `node.purpose`, and
`extractSkeleton` hard-codes `PURPOSE_PLACEHOLDER`. `selfHeal` preserves
per-section _stamps_ but **not prose**, so any prose an LLM writes is clobbered at
the next SessionStart/commit heal. So this ticket splits:

- **(A) Prose persistence — THIS ticket (deterministic, no LLM).** `selfHeal`
  preserves existing per-section prose across heals; new nodes get the
  placeholder; stamp-drift still flags `⚠ stale` (prose preserved but flagged).
- **(B) The `/architecture` LLM resync skill — deferred again** to a new ticket.
  It writes prose into placeholder/stale sections and re-stamps. Sits on (A).

User decision (`/figure-it-out` = my call): build **(A) now, (B) later**.

## Resolved design (/figure-it-out, 2026-06-23)

**Section format evolves** so the machine region is explicitly bounded and the
prose is its own block:

```
### auth

<!-- reconciled: <stamp> -->

`src/auth`

<prose — preserved across heals; placeholder only for a brand-new node>
```

Machine owns: `### name`, the `<!-- reconciled -->` marker, the `` `path` ``
code-reference, and the `⚠ stale`/`⚠ orphaned` markers. Prose = the section body
after the `` `path` `` line, excluding those markers.

**Mechanism** (mirrors `parseSectionStamps`/`priorStamps`): add
`parseSectionProse(content) → Map<name, prose>` (CRLF-tolerant; excludes marker
lines), thread `priorProse` through `renderDocument`; `renderSection` uses
`priorProse.get(name) ?? PURPOSE_PLACEHOLDER`. New node → placeholder; existing
node → prose verbatim; stamp-drift still emits `⚠ stale` with prose preserved.
Single-repo + monorepo leaves identical; root index has no per-node prose
(untouched).

**Rejected:** keep the one-line `` `path` — purpose `` (fragile `—` delimiter,
one-line cap, forces a second migration when the LLM writes paragraphs); sidecar
prose file (second artifact per doc + per leaf, breaks the self-describing
single-doc + colocated model).

**Premortem (pin first):** parse/render not being exact inverses → an unchanged
doc heals byte-different → `--check` churns forever. First RED is the round-trip
property: heal twice ⇒ `unchanged`, prose byte-identical.

## Scope

- `parseSectionProse` + thread `priorProse` through `renderDocument`/`renderSection`.
- New section format (prose as its own block); preserve prose across heals; new
  node → placeholder; stamp-drift preserves prose + flags `⚠ stale`.
- Update Slice-1/2/3 tests that assert the old inline `` `path` — purpose `` format.
- Re-render this repo's committed generated docs once (format change).

## Out of scope

- The `/architecture` LLM resync skill (B) → new deferred ticket.
- Any LLM involvement (this ticket stays deterministic).
- Changing the fingerprint/enforcement contracts.

## Done when

- A doc with hand/LLM-written prose heals to `unchanged` and keeps the prose
  byte-identical (round-trip); a new module gets the placeholder; a moved
  fingerprint preserves prose but flags `⚠ stale`.
- Single-repo + monorepo leaves both preserve prose; root index unchanged.
- Full suite green (with old-format test assertions updated); this repo's
  generated docs re-rendered + committed; `--check` passes.

## Open questions

- none — mechanism + format resolved; round-trip is the first scenario.

## Work Log

- 2026-06-23T03:46:29Z Started: Created ticket JT852Q.
- 2026-06-23T03:47:00Z Deferred to backlog during Slice 4.
- 2026-06-23T05:09:00Z Intake reframed: prose is clobbered today, so JT852Q =
  deterministic prose-persistence (A) + the LLM skill (B, deferred again).
  /figure-it-out resolved the format evolution (prose as its own block) +
  preservation mechanism (parseSectionProse/priorProse). Scope: A now, B later.
  Next: BDD define-behavior, first scenario = the round-trip property.
- 2026-06-23T05:15:00Z Complete: define-behavior — spec.md (TB1 + NTB1, 4 ACs),
  dimensions, 7 scenarios across 3 rules in
  features/architecture-prose-persistence.feature. Advancing to scenario-gate
  for independent /review-spec.
- 2026-06-23T05:25:00Z Complete: scenario-gate — independent /review-spec returned
  BLOCK (round-trip scenarios vacuous: unchanged short-circuits the write, so
  parse→render never ran; placeholder-vs-written never pinned the constant).
  Reworked all scenarios onto the WRITE path (heal triggered by adding a module),
  pinned exact prose/placeholder values, added CRLF + empty-prose + already-stale
  - fixed-point + monorepo-leaf + root-index-untouched; dropped a would-be-vacuous
    legacy-migration scenario (old docs only ever held the placeholder). Re-review
    PASS-WITH-NITS, BLOCK cleared (nits → step defs). 11 scenarios, stamp recorded;
    impl-plan.md written (parseSectionProse/priorProse, 7-task build order).
    Advancing to implement.
