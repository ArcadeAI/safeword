# Impl Plan: Evidence-anchored phase transitions (RM84M8)

**Status:** planned

## Approach

**Riskiest assumption → cheapest proof.** The design rests on: a `phase_anchors:`
block sequence round-trips through the existing zero-dependency `parseFrontmatter`
as a `string[]` of `"<phase>: <sha>"` items — exactly as `phase_skips` already
does — so the detector needs no new frontmatter parser, only a `parseSkips`-shaped
split plus the ledger's `isValidSha`. Cheapest proof is scenario **"Forward
advance with a well-formed anchor for the entered phase is anchored"**: if the
parse/lookup/format round-trip is wrong, that slice fails first and cheapest.
(Already partly dogfooded — this ticket's own frontmatter carries a `phase_anchors`
block that parsed through the live pre-tool gate without error when advancing to
define-behavior and scenario-gate.)

**Proof plan — all scenarios are `unit`.** The deliverable is a single pure
predicate `detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` in
`phase-provenance.ts` with no I/O and, per scope, no blocking caller (enforcement
is #810). By `testing/SKILL.md`'s highest-practical-scope rule that makes unit the
correct and sufficient proof: assert the verdict against in-memory prior/proposed
ticket.md strings, injecting a stub `ShaResolver` for the reachability partitions
(mirrors `ledger-validation.test.ts`). No integration/E2E/wiring test — there is
no entry point wired in #809 (justified: substrate only). The combinatorial edge
set (missing-key, wrong-phase, non-hex, empty-value, unreachable, rebased-
canonicalized, backward, re-declare, non-feature ×4, type-flip birth, at-rest) is
precisely what unit partitions cover.

**Build order — load-bearing slice first.**

1. **Slice 1 (load-bearing):** the anchored happy path — proves parse + policed-
   forward detection + format check. This is where a wrong data-model fails cheap.
2. **Slice 2:** the unanchored partitions (no block, wrong-phase, non-hex, empty).
3. **Slice 3:** the injected-resolver partitions (reachable-after-canonicalization,
   unreachable).
4. **Slice 4:** the silence partitions (backward, re-declare, non-feature outline,
   type-flip birth, at-rest) — the "fires only on forward feature advance" contract.

One pure function, so RED is one failing suite spanning the slices (import fails —
predicate absent), GREEN implements, REFACTOR tidies: three commits with SHAs
distinct per scenario. Batch RED→GREEN is acceptable here per the testing guide —
combinatorial pure logic, no interleaved design risk beyond slice 1, which is
sequenced first.

## Decisions

| Decision           | Choice                                                              | Alternatives considered                        | Rejected because                                                                                                      |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Anchor format      | `phase_anchors:` block sequence (`- <phase>: <sha>`)               | overwritten scalar `phase_anchor:`; anchors file | scalar loses the per-phase history #810 needs; a separate file breaks the "written by the Edit path" channel and duplicates the ticket as state home |
| Predicate location | extend `phase-provenance.ts`                                       | a new lib file                                 | reuses `frontmatterOf` / `scalar` / `canonicalIndex` and the `parseSkips` shape; a new file would duplicate transition parsing |
| SHA validity       | reuse `isValidSha` + injected `ShaResolver` (format-then-resolve)  | new SHA regex; always call git                 | duplication; git at write-time is impure and unavailable — resolver injection keeps the predicate pure and lets #810 supply the rebase-aware resolver |
| Enforcement        | none in #809 (substrate only)                                      | write-time hard-deny; write-time warn          | format-only block catches no forger and taxes honest advances (per independent /quality-review); reachability enforcement belongs at #810's boundary |

## Arch alignment

Records exist in `ARCHITECTURE.md`; this implementation honors:

- **Zero-dependency YAML parser** (`hierarchy.ts` inline `parseFrontmatter`) — `phase_anchors` parses through it as a block sequence; no new runtime dependency.
- **Pure, unit-testable hook libs** (the pattern behind `scenario-format.ts` / `hierarchy.ts` extraction "for direct unit testability") — `detectUnanchoredPhaseTransition` is a pure exported function with injected `ShaResolver`, unit-tested standalone.
- **Templates ↔ `.safeword` schema parity** (schema-drift prevention) — the new code is authored in `templates/hooks/lib/phase-provenance.ts` and synced to `.safeword/hooks/lib/`; the parity gate stays green.

## Known deviations

skip: no deviations planned — conforms to the pure-lib, zero-dependency-parser, and reuse-before-add patterns above.

## Assessment triggers

- #810 needs anchors to also record the writing tool ("channel") or an anchor per *bypassed* phase (not just the entered one) → revisit the format.
- `phase_skips` and `phase_anchors` parsing drift enough to justify a shared `parsePhaseKeyedList` helper (currently two ~10-line `<key>: <value>` parsers) → extract then.
- A future ticket decides write-time enforcement is warranted after all → revisit the "no enforcement in the substrate" call and this plan's Enforcement decision.
