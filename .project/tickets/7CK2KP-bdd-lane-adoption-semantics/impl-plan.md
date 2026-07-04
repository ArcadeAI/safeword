# Impl Plan: BDD lane adoption semantics (lean slice)

**Status:** implemented

Written retroactively (the slice landed as a user-instructed spike in commit
05cdf1d; see ticket work log 2026-07-03T19:35Z), reconciled against what
shipped.

## Approach

Riskiest assumption: a pointer to a host-owned doc is enough for agents to
follow house style — safeword never needs to parse, template, or enforce the
conventions itself. Cheapest proof: the codify pointer scenario
(TB1.AC1.conventions_pointer_prints_to_stderr_when_configured) — if the
pointer surfaces cleanly, everything else is prose.

Scenario ownership and proof:

- TB1.AC1 (pointer when configured / silence when unset) — owned by
  `readBddConventionsPath` (utils/configured-paths.ts) + `printConventionsPointer`
  (commands/codify.ts). Primary proof: e2e via the built CLI
  (tests/commands/codify.test.ts), the highest practical scope — it exercises
  config read, both output sinks, and the stdout/stderr split in one pass. No
  supporting unit proof: the reader shares `readSafewordConfig`/`nonEmptyString`
  defensive behavior already unit-covered for `paths.*`.
- TB1.AC2 (prose deferral) — owned by the three markdown templates (+ this
  repo's installed copies). Proof: diff review; prose is agent-read, not
  executable. Guarded indirectly by template-parity pre-commit checks.

Build order as shipped: reader → codify pointer → e2e tests → prose → docs,
single commit (spike). The load-bearing slice (pointer) was verified first.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Convention carrier | One opaque key `bdd.conventions` pointing at a host-owned doc | Three structured keys (stub template / verify command / excluded tags); auto-detection from cucumber configs | House styles are heterogeneous — N examples validate slots, never values; JS cucumber configs are executable, not statically readable; schema would be semver-committed at N=1 (K7N2QM precedent) |
| Pointer output channel | stderr | stdout alongside the skeleton | `codify > file.test.ts` must stay a clean skeleton; stdout corruption breaks the primary redirect workflow |
| Prose parameterization | Static deferral wording read against config at agent-read time | Generation-time template rendering | No template-var machinery exists for installed skills (verified); rendered snapshots go stale when config changes after install |
| Doc validation | None — pointer surfaced verbatim, existence unchecked | Existence check with warning | A stale pointer should be visible (agent hits it and reports), and validation would make safeword parse territory it deliberately doesn't own; revisit if support burden appears |

## Arch alignment

Follows the `paths.*` configured-read pattern (ticket K7N2QM: config keys are
user-authored read targets, parsed leniently, never auto-written) and 56JCFZ's
augment-not-replace lane discovery. No ADR directory in this project;
architecture.generated.md carries no BDD-lane decisions this contradicts.

## Known deviations

skip: no deviations — the slice adds one leaf reader and one print site; no
architecture guidance touched.

## Assessment triggers

- A second real cucumber-shop host adopts safeword → re-open the structured
  knobs (stub template, verify command, `bdd.excludedTags`) with two-host
  evidence; promote structure only where their conventions docs converge.
- Support reports of agents bypassing host tag exclusions despite the prose →
  build the lint-gherkin/`safeword check` enforcement slice (excludedTags).
- `bdd.` block grows a second key → design the block's schema deliberately
  before it accretes.
